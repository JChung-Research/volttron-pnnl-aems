import "./style.scss";

import { Alert, Button, Card, Collapse, InputGroup, TextArea, Intent, Label, Position, Tree, Menu, MenuItem, Tabs, Tab, Tag, Classes, Icon } from "@blueprintjs/core";
import { Header, Prompt } from "components";
import {
  IConfiguration,
  createConfiguration,
  deleteConfiguration,
  readConfigurations,
  readConfigurationsPoll,
  selectReadConfigurations,
  updateConfiguration,
} from "controllers/configurations/action";
import {
  IFilter,
  IUnit,
  filterUnits,
  readUnits,
  readUnit,
  readUnitsPoll,
  selectFilterUnits,
  selectReadUnits,
  updateUnit
} from "controllers/units/action";
import { IconName, IconNames } from "@blueprintjs/icons";
import { cloneDeep, get, isEqualWith, isNil, isObject, merge, isString, set } from "lodash";

import { Configuration } from "./Configuration";
import { Holidays } from "./Holidays";
import { Occupancies } from "./Occupancies";
import React from "react";
import { RootProps } from "routes";
import { Schedules } from "./Schedules";
import { Setpoints } from "./Setpoints";
import { HolidayType, RoleType, StageType } from "common";
import { Popover2, Tooltip2 } from "@blueprintjs/popover2";
import { connect } from "react-redux";
import { createConfigurationDefault } from "utils/configuration";
import { defaultPollInterval } from "controllers/poll/action";
import { isSetpointValid } from "utils/setpoint";
import { DeepPartial } from "../../utils/types";
import { ISetpoint, updateSetpoint } from "controllers/setpoints/action";
import { getCommon } from "utils/util";
import { Holiday } from "./Holiday";
import { IEnum } from "common/types";
import Plot from 'react-plotly.js';
import axios from "axios";

import { useLocation } from "react-router-dom";

import { readSensors } from "controllers/units/api";

function withLocation(Component: any) {
  return function WrappedComponent(props: any) {
    const location = useLocation();
    return <Component {...props} location={location} />;
  };
}

function tempFtoK(f: number): number {
  return ((f - 32) * 5) / 9 + 273.15;
}

function tempKtoF(k: number): number {
  return ((k - 273.15) * 9) / 5 + 32;
}

function getSecondsFromStartOfYear(simDate: Date): number {
  const startOfYear = new Date(Date.UTC(simDate.getUTCFullYear(), 0, 1)); 
  const diffMs = simDate.getTime() - startOfYear.getTime(); 
  return Math.floor(diffMs / 1000) - 18000; 
}

function convertChartConfigs(input: Record<string, any>) {
  return Object.entries(input).map(([_, config], id) => {
    const type = config.chartConfigType as string;
    const selectedVariables = Object.values(config.chartSelectVars) as string[];

    let vizSettings;
    if (type === "line") {
      vizSettings = Object.values(config.chartVizSetting);
    } else if (type === "scatter") {
      vizSettings = config.chartVizSetting;
    } else if (type === "box") {
      vizSettings = config.chartVizSetting;
    }

    return {
      id,
      type,
      selectedVariables,
      vizSettings
    };
  });
}

interface UnitsProps extends RootProps {
  readUnits: () => void;
  readUnit: () => void;
  readUnitsPoll: (payload?: number) => void;
  filterUnits: (payload: IFilter) => void;
  updateUnit: (payload: DeepPartial<IUnit>) => void;
  units?: IUnit[];
  filtered?: IUnit[];
  readConfigurations: () => void;
  readConfigurationsPoll: (payload?: number) => void;
  createConfiguration: (payload: DeepPartial<IConfiguration>) => void;
  updateConfiguration: (payload: DeepPartial<IConfiguration>) => void;
  deleteConfiguration: (payload: number) => void;
  configurations?: IConfiguration[];
  updateSetpoint: (payload: DeepPartial<ISetpoint>) => void;
  location?: Location & {
    state?: {
      selectedUnitId?: string | number;
    };
  };
}

interface MetadataItem {
  name: string;
  label: string;
  unit: string;
  type: string; 
}

interface VizSetting {
  color?: string;
  marker_size?: number;
  line_width?: number;
  marker_symbol?: string;
  line_dash?: string;
}

interface UnitsState {
  editing: DeepPartial<IUnit> | null;
  editingAll: DeepPartial<IUnit> | null;
  expanded: string | null;
  confirm: (() => void) | null; 
  unitManagerData: {
    [unitId: string]: {
      id: number; 
      building: string;
      system: string;
      varList: string[];
      ctrlValues: Record<string, number | string>;
      lineChartData: { index: number; time: string; values: {[key:string]: number; }}[];
      chartConfigs: { id: number; type: string; selectedVariables: string[]; vizSettings?: Record<string, VizSetting>; }[];
    };
  };
  startCollect: boolean | null;
  sensorMetadata: MetadataItem[];
  openBuildings?: Record<string, boolean>;
  activeCampus?: string;
}

type AxisInfo = {
  name: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  values: number[];
};

type OutputOption = {
  name: string;
  label: string;
  unit: string;
  type: string;
};

class Dashboard extends React.Component<UnitsProps, UnitsState> {
  private configRouteIsHidden: boolean;
  private unitRefs: Record<string, React.RefObject<HTMLDivElement>> = {};
  private hasScrolledToUnit = false;
  private sensorDataInterval?: NodeJS.Timeout;

  constructor(props: UnitsProps) {
    super(props);
    const configRoute = Object.values(props.routes.map).find((v) => v.data?.name === "configuration")?.data;
    const selectedUnitId = props.location?.state?.selectedUnitId ?? null;
    this.configRouteIsHidden = !!configRoute?.hidden;
    
    this.state = {
      editing: typeof selectedUnitId === "number" ? { id: selectedUnitId } : null,    
      editingAll: { configuration: { holidays: HolidayType.values.map(() => ({})) } },
      expanded: null,
      confirm: null,
      unitManagerData: {},
      startCollect: true,
      sensorMetadata: [],
      openBuildings: {},
      activeCampus: undefined
    };      
  }

  // Initial data load and start data-collation interval
  componentDidMount() {
    this.props.readUnits();    
    this.props.readUnitsPoll(defaultPollInterval);

    if (!this.configRouteIsHidden) {
      this.props.readConfigurations();
      this.props.readConfigurationsPoll(defaultPollInterval);
    }

    this.initializeUnitData();

    // Automatically run 'readSensors()' function every 10 seconds
    this.sensorDataInterval = setInterval(() => {
      // const now = new Date();
      // console.log(`[${now.toLocaleTimeString()}] The sensor data in the selected unit was retrieved`);

      this.getVoltData();      
      }, 5000);
  }

  // Scroll to selected unit and reinitialize unit data on props update
componentDidUpdate(prevProps: UnitsProps) {
  const selectedUnitId = this.props.location?.state?.selectedUnitId;

  // If units changed, reinit data (kept)
  if (prevProps.units !== this.props.units && this.props.units && this.props.units.length > 0) {
    this.initializeUnitData();
  }

  // Auto-open building & scroll to the selected unit
  if (
    selectedUnitId !== undefined &&
    String(selectedUnitId) in this.unitRefs &&
    !this.hasScrolledToUnit
  ) {
    const unit = this.props.units?.find(u => u.id === Number(selectedUnitId));
    const bldgKey = unit?.building || "Unknown";
    const doScroll = () => {
      const ref = this.unitRefs[String(selectedUnitId)];
      if (ref?.current) {
        this.hasScrolledToUnit = true;
        requestAnimationFrame(() => {
          const element = ref.current!;
          const offset = element.getBoundingClientRect().top + window.pageYOffset - 60;
          window.scrollTo({ top: offset, behavior: "smooth" });
        });
      }
    };

    // Open the containing building if it's closed, then scroll
    if (unit && !this.state.openBuildings?.[bldgKey]) {
      this.setState(
        prev => ({ openBuildings: { ...(prev.openBuildings || {}), [bldgKey]: true } }),
        doScroll
      );
    } else {
      doScroll();
    }
  }
}

  // Clean up polling and intervals
  componentWillUnmount() {
    this.props.readUnitsPoll();
    this.props.readConfigurationsPoll();

    if (this.sensorDataInterval) {
      clearInterval(this.sensorDataInterval);
    }
  }

  getValue = (field: string, editing?: DeepPartial<IUnit> | null, unit?: DeepPartial<IUnit> | null) => {
    const { units } = this.props;
    const temp = unit ? unit : units?.find((v) => v.id === editing?.id);
    return get(editing, field, get(temp, field));
  };

  // Update control values for a unit
  handleSetpointValueChange = (unitId: number, name: string, value: number | string) => {

    this.setState(prevState => {
      const unitData = prevState.unitManagerData[unitId] || {
        id: unitId,
        building: "",
        system: "",
        varList: [],
        ctrlValues: {},
        chartConfigs: [],
        lineChartData: []
      };
  
      return {
        unitManagerData: {
          ...prevState.unitManagerData,
          [unitId]: {
            ...unitData,
            ctrlValues: {
              ...unitData.ctrlValues,
              [name]: value,
            }
          }
        }
      };
    });
  };

  // Handle general field value updates for editing
  handleChange = (field: string, editing?: DeepPartial<IUnit> | null) => {
    return (value: any) => {
      const doDefault = (value: any) => {
        if (editing) {
          if (isObject(this.getValue(field, editing))) {
            set(editing, field, merge(cloneDeep(get(editing, field)), value));
          } else {
            set(editing, field, value);
          }
          this.setState({ editing });
        }
      };
      switch (field) {
        case "configurationId":
          this.props.updateUnit({ id: editing?.id, configurationId: value as number });
          break;
        default:
          doDefault(value);
      }
    };
  };

  handleCreate = (unit: DeepPartial<IUnit>) => {
    const configuration = createConfigurationDefault();
    configuration.unitId = unit.id;
    this.props.createConfiguration(configuration);
    this.setState({
      editing: null,
      expanded: null,
    });
  };

  handleEdit = (unit: IUnit) => {
    const { filtered } = this.props;
    const { editing } = this.state;
    const current = editing && filtered?.find((v) => v.id === editing.id);
    if (current && this.isSave(current)) {
      this.setState({ confirm: () => this.setState({ editing: { id: unit.id } }) });
    } else {
      this.setState({ editing: { id: unit.id } });
    }
  };

  handleCancel = () => {
    const { filtered } = this.props;
    const { editing } = this.state;
    const current = editing && filtered?.find((v) => v.id === editing.id);
    if (current && this.isSave(current)) {
      this.setState({ confirm: () => this.setState({ editing: null, expanded: null }) });
    } else {
      this.setState({ editing: null, expanded: null });
    }
  };

  handleConfirm = () => {
    const { confirm } = this.state;
    this.setState({ confirm: null }, confirm ?? undefined);
  };

  handleSave = () => {
    const { editing } = this.state;
    if (editing) {
      this.props.updateUnit(editing);
      // this.setState({ editing: null, expanded: null });
    }
  };

  handleClearAll = () => {
    this.setState({ editingAll: { configuration: { holidays: HolidayType.values.map(() => ({})) } }, expanded: null });
  };

  handleSaveAll = () => {
    const { editingAll } = this.state;
    const { filtered } = this.props;
    if (editingAll) {
      filtered?.forEach((unit) => {
        if (!this.unitRefs[unit.id!]) {
          this.unitRefs[unit.id!] = React.createRef<HTMLDivElement>();
        }

        const id = unit.id;
        const location = {
          name: editingAll.location?.name,
          latitude: editingAll.location?.latitude,
          longitude: editingAll.location?.longitude,
        };
        const configuration = {
          id: unit.configuration?.id,
          holidays: HolidayType.values
            .map((holiday, i) => {
              const type = editingAll.configuration?.holidays?.[i]?.type;
              if (type) {
                const id = unit.configuration?.holidays?.find((h) => h?.label === holiday?.label)?.id;
                return { id, type };
              } else {
                return undefined;
              }
            })
            .filter((v) => v),
        };
        if (location.name || configuration.holidays.length) {
          this.props.updateUnit({
            id,
            ...(location.name ? { location } : {}),
            ...(configuration.holidays.length ? { configuration } : {}),
          });
        }
      });
      this.handleClearAll();
    }
  };

  handleDelete = (configuration: DeepPartial<IConfiguration>) => {
    const { id } = configuration;
    if (id !== undefined) {
      this.props.deleteConfiguration(id);
    }
  };

  handlePush = (unit: DeepPartial<IUnit>) => {
    const { id } = unit;
    if (id !== undefined) {
      this.props.updateUnit({ id, stage: StageType.UpdateType.label });
    }
  };

  isSave = (unit: DeepPartial<IUnit> | IUnit, editing?: DeepPartial<IUnit> | null) => {
    editing = editing ?? this.state.editing;
    const temp = merge({}, unit, editing);
    const valid = temp.configuration?.setpoint ? isSetpointValid(temp.configuration.setpoint) : true;
    return (
      // valid &&
      !isEqualWith(unit, temp, (_a, _b, k) =>
        ["createdAt", "updatedAt", "action"].includes(k as any) ? true : undefined
      )
    );
  };

  isPush = (unit: IUnit) => {
    switch (unit.stage) {
      case StageType.UpdateType.label:
      case StageType.DeleteType.label:
      case StageType.ProcessType.label:
        return false;
      case StageType.CreateType.label:
      case StageType.CompleteType.label:
      case StageType.FailType.label:
      default:
        return !this.isSave(unit);
    }
  };

  isAdmin() {
    const { user } = this.props;
    return RoleType.Admin.granted(...(user?.role.split(" ") ?? [""]));
  }

  renderStatus(unit: IUnit) {
    let icon: IconName = IconNames.ISSUE;
    let intent: Intent = Intent.WARNING;
    let message: string = "Push Unit Configuration";
    switch (unit.stage) {
      case StageType.UpdateType.label:
        icon = IconNames.REFRESH;
        intent = Intent.PRIMARY;
        break;
      case StageType.ProcessType.label:
        icon = IconNames.REFRESH;
        intent = Intent.SUCCESS;
        break;
      case StageType.CreateType.label:
        icon = IconNames.ISSUE;
        intent = Intent.WARNING;
        break;
      case StageType.DeleteType.label:
        icon = IconNames.DELETE;
        intent = Intent.DANGER;
        break;
      case StageType.CompleteType.label:
        icon = IconNames.CONFIRM;
        intent = Intent.SUCCESS;
        break;
      case StageType.FailType.label:
        icon = IconNames.ERROR;
        intent = Intent.DANGER;
        break;
      default:
    }
    return (
      <Tooltip2 content={message} placement={Position.TOP} disabled={!this.isPush(unit)}>
        <Button
          icon={icon}
          intent={intent}
          minimal
          onClick={() => this.handlePush(unit)}
          disabled={!this.isPush(unit)}
        />
      </Tooltip2>
    );
  }

  renderConfirm() {
    const { confirm } = this.state;
    if (confirm === null) {
      return null;
    }
    return (
      <Alert
        intent={Intent.DANGER}
        isOpen={true}
        confirmButtonText="Yes"
        cancelButtonText="Cancel"
        onConfirm={() => this.handleConfirm()}
        onClose={() => this.setState({ confirm: null })}
      >
        <p>There are changes which have not been saved. Do you still want to continue?</p>
      </Alert>
    );
  }

  renderPrompt() {
    const { filtered } = this.props;
    const { editing } = this.state;
    const current = editing && filtered?.find((v) => v.id === editing.id);
    const prompt = !isNil(current) && this.isSave(current);
    return (
      <Prompt when={prompt} message="There are changes which have not been saved. Do you still want to continue?" />
    );
  }

  addChart = (unitId: number) => {
    this.setState((prevState) => {
      const currentCharts = prevState.unitManagerData[unitId]?.chartConfigs || [];
      const nextChartId = currentCharts.length > 0 
        ? Math.max(...currentCharts.map(c => c.id)) + 1 
        : 0;
      const nextChartType = "line";

      return {
        unitManagerData: {
          ...prevState.unitManagerData,
          [unitId]: {
            ...prevState.unitManagerData[unitId],
            chartConfigs: [...currentCharts, { id: nextChartId, type: nextChartType, selectedVariables: [], vizSettings: [] }]
          }
        }
      };
    });
  };
  
  removeChart = (unitId: number) => {
    this.setState((prevState) => {
      const currentCharts = prevState.unitManagerData[unitId]?.chartConfigs || [];
  
      if (currentCharts.length > 1) {
        return {
          unitManagerData: {
            ...prevState.unitManagerData,
            [unitId]: {
              ...prevState.unitManagerData[unitId],
              chartConfigs: currentCharts.slice(0, -1),
            }
          }
        };
      }
  
      return null;
    });
  };

  renderChartSelect = (
    unitId: number,
    chartId: number,
    label: string,
    chartData: { index: number; time: string; values: {[key:string]: number}; }, //OutputOption[],
    selectedVariables: string[],
    onChange: (selection: string[]) => void
  ) => {
    const usedVariables = Object.keys(chartData.values);
    const selectMetadata = this.state.sensorMetadata.filter(item => usedVariables.includes(item.name));
    const chartConfig = this.state.unitManagerData[unitId].chartConfigs[chartId];
    const chartTypes = ['line', 'scatter', 'box'];

    return (
      <Label>
        <b>{label}</b>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
        <Popover2
          content={
            <div style={{ display: 'flex', gap: '5px', padding: '10px' }}>
              {/* Control Column */}
              <Menu style={{ flex: 1, width: '450px' }}>
                <MenuItem text="Control" disabled />
                {selectMetadata?.filter((v) => v.type === "control").map((item) => {
                  const isChecked = selectedVariables.includes(item.name);
                  return (
                    <MenuItem
                      key={item.label}
                      text={
                        <Label style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            const itemName = item.name;

                            this.setState(prevState => {
                              const updatedConfigs = prevState.unitManagerData[unitId].chartConfigs.map((config, idx) => {
                                if (idx !== chartId) return config;

                                const updatedSelectedVars = isChecked
                                  ? [...config.selectedVariables, itemName]
                                  : config.selectedVariables.filter((v) => v !== itemName);

                                return {
                                  ...config,
                                  selectedVariables: updatedSelectedVars,
                                };
                              });

                              return {
                                unitManagerData: {
                                  ...prevState.unitManagerData,
                                  [unitId]: {
                                    ...prevState.unitManagerData[unitId],
                                    chartConfigs: updatedConfigs,
                                  }
                                }
                              };
                            });
                          }}
                        />
                          {" " + item.label}
                        </Label>
                      }
                      shouldDismissPopover={false}
                    />
                  );
                })}
              </Menu>

              {/* Environmental Column */}
              <Menu style={{ flex: 1 }}>
                <MenuItem text="Environment" disabled />
                {selectMetadata?.filter((v) => v.type === "environment").map((item) => {
                  const isChecked = selectedVariables.includes(item.name);
                  return (
                    <MenuItem
                      key={item.label}
                      text={
                        <Label style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              const itemName = item.name;

                              this.setState(prevState => {
                                const updatedConfigs = prevState.unitManagerData[unitId].chartConfigs.map((config, idx) => {
                                  if (idx !== chartId) return config;

                                  const updatedSelectedVars = isChecked
                                    ? [...config.selectedVariables, itemName]
                                    : config.selectedVariables.filter((v) => v !== itemName);

                                  return {
                                    ...config,
                                    selectedVariables: updatedSelectedVars,
                                  };
                                });

                                return {
                                  unitManagerData: {
                                    ...prevState.unitManagerData,
                                    [unitId]: {
                                      ...prevState.unitManagerData[unitId],
                                      chartConfigs: updatedConfigs,
                                    }
                                  }
                                };
                              });
                            }}
                          />
                          {" " + item.label}
                        </Label>
                      }
                      shouldDismissPopover={false}
                    />
                  );
                })}
              </Menu>
            </div>
          }
          placement="bottom-start"
        >
        <Button rightIcon={IconNames.CARET_DOWN} minimal>
          {selectedVariables.length > 0
            ? `${selectedVariables.length} selected`
            : "Select variables..."}
        </Button>
        </Popover2>

        {/* Chart Type Dropdown */}
        <Popover2
          content={
            <Menu>
              {chartTypes.map((type) => (
                <MenuItem
                  key={type}
                  text={type === 'line' 
                          ? 'Line Chart' 
                          : type === 'scatter' 
                          ? 'Scatter Plot'
                          : type === 'box'
                          ? 'Box Plot'
                          : 'Unknown Plot Type'}
                  onClick={() => {
                    this.setState((prevState) => {
                      const updatedConfigs = prevState.unitManagerData[unitId].chartConfigs.map((config) =>
                        config.id === chartId
                          ? { ...config, type }
                          : config
                      );
                      return {
                        unitManagerData: {
                          ...prevState.unitManagerData,
                          [unitId]: {
                            ...prevState.unitManagerData[unitId],
                            chartConfigs: updatedConfigs,
                          },
                        },
                      };
                    });
                  }}
                />
              ))}
            </Menu>
          }
          placement="bottom-start"
        >
          <Button rightIcon={IconNames.CARET_DOWN} minimal>
            {chartConfig?.type === 'scatter'
              ? 'Scatter Plot'
              : chartConfig?.type === 'line'
              ? 'Line Chart'
              : chartConfig?.type === 'box'
              ? 'Box Plot'
              : 'Select Chart Type'}
          </Button>
        </Popover2>
        </div>

      </Label>
    );
  };

  handleChartSelect = (unitId:number, chartId: number, selectedVariables: string[]) => {
    this.setState((prevState) => ({
      unitManagerData: {
        ...prevState.unitManagerData,
        [unitId]: {
          ...prevState.unitManagerData[unitId],
          chartConfigs: prevState.unitManagerData[unitId].chartConfigs.map((cfg) =>
            cfg.id === chartId ? { ...cfg, selectedVariables } : cfg
          ),
        },
      },
    }));
  };

  buildAxisInfo = (unitId: number, chartId: number): AxisInfo[] => {
    const unitData = this.state.unitManagerData[unitId];
    if (!unitData) return [];
  
    const chartConfig = unitData.chartConfigs.find((c) => c.id === chartId);
    if (!chartConfig) return [];
  
    return chartConfig.selectedVariables.map((outputName) => {
      const values = unitData.lineChartData.map((d) => d.values[outputName]);
      const yAxisMin = Math.min(...values);
      const yAxisMax = Math.max(...values);
      const match = this.state.sensorMetadata.find(
        (o) => o.name === outputName
      );
      return {
        name: outputName,
        label: match?.label || outputName,
        unit: match?.unit || '', 
        min: yAxisMin,
        max: yAxisMax,
        values,
      };
    });
  };  

  // Render a Plotly line chart with dual Y-axes for selected outputs
  renderLineChart = (unitId: number, chartIndex: number) => {

    // Unit setting for line charts
    const unitData = this.state.unitManagerData[unitId];
    const yAxisInfo = this.buildAxisInfo(unitId, chartIndex);
    const primaryUnit = yAxisInfo[0]?.unit;
    let secondaryIndex: number | null = null;
    const chartConfig = unitData.chartConfigs.find((c) => c.id === chartIndex);

    for (let i = 1; i < yAxisInfo.length; i++) {
      if (yAxisInfo[i].unit !== primaryUnit) {
        secondaryIndex = i;
        break;
      }
    }

    // Separate values based on axis assignment
    const primaryYValues = yAxisInfo
      .filter((_, idx) => idx !== secondaryIndex)
      .flatMap((info) => info.values);

    const secondaryYValues = secondaryIndex !== null
      ? yAxisInfo[secondaryIndex].values
      : [];

    const getDashStyle = (dash: string | undefined): Plotly.Dash => {
      const valid: Plotly.Dash[] = ["solid", "dot", "dash", "longdash", "dashdot", "longdashdot"];
      return valid.includes(dash as Plotly.Dash) ? (dash as Plotly.Dash) : "solid";
    };

    return (
        <Plot
          key={`${unitId}-${chartIndex}`}
          data={yAxisInfo.map((info, idx) => ({
            x: unitData.lineChartData.slice(-50).map((d) => d.time.split(" ")[1]),
            y: info.values.slice(-50),
            type: 'scatter',
            mode: 'lines',
            name: `${info.label} (${info.unit})`,
            line: {
              shape: 'spline',
              color: chartConfig?.vizSettings?.[idx]?.color ?? `hsl(${(idx * 60) % 360}, 70%, 40%)`,
              width: chartConfig?.vizSettings?.[idx]?.line_width ?? 2,
              dash: getDashStyle(chartConfig?.vizSettings?.[idx]?.line_dash)
            },
            yaxis: idx === secondaryIndex ? 'y2' : 'y', 
            hovertemplate: `%{y} ${info.unit}<extra>${info.label}</extra>`,
          }))}
          layout={{
            autosize: true,
            height: 420,
            margin: { l: 40, r: 20, t: 0, b: 130 },
            xaxis: {
              title: {
                text: 'Time (hh:mm:ss)',
                font: { size: 14 },
                standoff: 14,
              },
              tickfont: { size: 12, family: 'Arial' },
              showline: true,
              tickmode: 'auto',
              nticks: 5
            },
            yaxis: {
              title: {
                text: yAxisInfo[0] ? `${this.unitLabels.find((o) => o.name === yAxisInfo[0].unit)?.label}` : 'Y Axis',
                font: { size: 14 },
                standoff: 10,
              },
              tickfont: { size: 12, family: 'Arial' },
              range: [
                Math.min(...primaryYValues) * 0.95,
                Math.max(...primaryYValues) * 1.05
              ],
              showline: true,
              automargin: true,
            },
            yaxis2: {
              title: {
                text: 
                  secondaryIndex !== null && yAxisInfo[secondaryIndex as number]
                    ? `${this.unitLabels.find((o) => o.name === yAxisInfo[secondaryIndex as number].unit)?.label}`
                    : '',
                font: { size: 14 },
                standoff: 10,
              },
              overlaying: 'y',
              side: 'right', 
              range: secondaryYValues.length
              ? [
                  Math.min(...secondaryYValues) * 0.95,
                  Math.max(...secondaryYValues) * 1.05
                ]
              : undefined,
              tickfont: { size: 12, family: 'Arial' },
              showline: true,
              automargin: true,
            },
            legend: {
              font: { size: 14, family: 'Arial' },
              orientation: 'h',
              x: 0.5,
              y: -0.19,
              xanchor: 'center',
              yanchor: 'top',
            },
          }}
          config={{ responsive: true }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      );

    };


  // Render a Plotly scatter plot for selected outputs
  renderScatterPlot = (unitId: number, chartIndex: number) => {

    // Unit setting for line charts
    const unitData = this.state.unitManagerData[unitId];
    const axisInfo = this.buildAxisInfo(unitId, chartIndex);    
    const xVar = axisInfo[0];
    const yVar = axisInfo[1];
    const chartConfig = unitData.chartConfigs.find((c) => c.id === chartIndex);

    return (
        <Plot
          key={`${unitId}-${chartIndex}`}
          data={xVar && yVar ? Object.entries(
                  unitData.lineChartData.reduce((acc, point) => {
                    const occ = point.values["Occupancy"] ?? "unknown";
                    const x = parseFloat(String(point.values[xVar.name]));
                    const y = parseFloat(String(point.values[yVar.name]));

                    if (!isNaN(x) && !isNaN(y)) {
                      acc[occ] = acc[occ] || { x: [], y: [] };
                      acc[occ].x.push(x);
                      acc[occ].y.push(y);
                    }
                    return acc;
                  }, {} as Record<string, { x: number[]; y: number[] }>)
                ).map(([occ, coords], idx) => ({
                  x: coords.x,
                  y: coords.y,
                  type: 'scatter',
                  mode: 'markers',
                  name: `${occ}`,
                  marker: {
                    color: chartConfig?.vizSettings?.[occ]?.color ?? `hsl(${(idx * 90) % 360}, 70%, 40%)`,
                    size: chartConfig?.vizSettings?.[occ]?.marker_size ?? 6,
                    symbol: chartConfig?.vizSettings?.[occ]?.marker_symbol ?? "circle"
                  },
                  xaxis: 'x',
                  yaxis: 'y', 
                  hovertemplate: `%{x} ${xVar.unit}, %{y} ${yVar.unit}<br>Occupancy: ${occ}`,
                }))
              : []}              
          layout={{
            autosize: true,
            height: 370,
            margin: { l: 40, r: 20, t: 0, b: 80 },

            xaxis: {
              title: {
                text: xVar ? `${xVar.label} (${xVar.unit})` : 'X Axis',
                font: { size: 14 },
                standoff: 14,
              },
              tickfont: { size: 12, family: 'Arial' },
              range:
                xVar?.values?.length
                  ? [Math.min(...xVar.values) * 0.99, Math.max(...xVar.values) * 1.01]
                  : undefined,
              showline: true,
              tickmode: 'auto',
              nticks: 5
            },
            yaxis: {
              title: {
                text: yVar ? `${yVar.label} (${yVar.unit})` : 'Y Axis',
                font: { size: 14 },
                standoff: 10,
              },
              tickfont: { size: 12, family: 'Arial' },
              range:
                yVar?.values?.length
                  ? [Math.min(...yVar.values) * 0.99, Math.max(...yVar.values) * 1.01]
                  : undefined,
              showline: true,
              automargin: true,
            },

            legend: {
              font: { size: 14, family: 'Arial' },
              orientation: 'h',
              x: 0.5,
              y: -0.19,
              xanchor: 'center',
              yanchor: 'top',
            },
          }}
          config={{ responsive: true }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      );

    };

  // Render a Plotly box plot with a selected outputs
  renderBoxPlot = (unitId: number, chartIndex: number) => {

    // Unit setting for line charts
    const unitData = this.state.unitManagerData[unitId];
    const axisInfo = this.buildAxisInfo(unitId, chartIndex);    
    const yVar = axisInfo[0];
    const chartConfig = unitData.chartConfigs.find((c) => c.id === chartIndex);
    
    return (
        <Plot
          key={`${unitId}-${chartIndex}`}
          data={
            yVar
              ? Object.entries(
                  unitData.lineChartData.reduce((acc, point) => {
                    const hour = new Date(point.time).getHours();
                    const occ = point.values["Occupancy"] ?? "unknown";
                    const y = parseFloat(String(point.values[yVar.name]));

                    if (hour < 6 || hour > 20 || isNaN(y)) return acc;

                    acc[occ] = acc[occ] || { x: [], y: [] };
                    acc[occ].x.push(`Hour ${hour}`);
                    acc[occ].y.push(y);

                    return acc;
                  }, {} as Record<string, { x: string[]; y: number[] }>)
                ).map(([occ, coords], occIndex) => ({
                  x: coords.x,
                  y: coords.y,
                  type: 'box',
                  name: occ,
                  // width: 0.9,
                  marker: {
                    color: chartConfig?.vizSettings?.[occ]?.color ?? `hsl(${(occIndex * 90) % 360}, 70%, 40%)`,
                    size: chartConfig?.vizSettings?.[occ]?.marker_size ?? 6,
                  },
                  line: {
                    width: chartConfig?.vizSettings?.[occ]?.line_width ?? 2,
                  },
                  boxpoints: 'outliers',
                  hovertemplate: `%{y}<br>Occupancy: ${occ}`,
                }))
              : []
          }         
          layout={{
            autosize: true,
            height: 390,
            margin: { l: 40, r: 20, t: 0, b: 100 },

            xaxis: {
              title: {
                text: 'Hour of Day',
                font: { size: 14 },
                standoff: 14,
              },
              tickfont: { size: 12, family: 'Arial' },
              categoryorder: 'array',
              categoryarray: [
                'Hour 6', 'Hour 7', 'Hour 8', 'Hour 9', 'Hour 10',
                'Hour 11', 'Hour 12', 'Hour 13', 'Hour 14', 'Hour 15',
                'Hour 16', 'Hour 17', 'Hour 18', 'Hour 19', 'Hour 20'
              ],
              showline: true,
            },
            yaxis: {
              title: {
                text: yVar ? `${yVar.label} (${yVar.unit})` : 'Y Axis',
                font: { size: 14 },
                standoff: 10,
              },
              tickfont: { size: 12, family: 'Arial' },
              range:
                yVar?.values?.length
                  ? [Math.min(...yVar.values) * 0.99, Math.max(...yVar.values) * 1.01]
                  : undefined,
              showline: true,
              automargin: true,
            },
            boxmode: 'group',
            legend: {
              font: { size: 14, family: 'Arial' },
              orientation: 'h',
              x: 0.5,
              y: -0.26,
              xanchor: 'center',
              yanchor: 'top',
            },
          }}
          config={{ responsive: true }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      );

    };

    unitLabels = [
      {name: "°F", label: "Temperature (°F)"},
      {name: "[0-1]", label: "Control signal ([0,1])"},
      {name: "on/off", label: "Pump stage (on/off)"},
      {name: "kg/s", label: "Supply air flow rate (kg/s)"},
      {name: "ppm", label: "CO2 concentration (ppm)"},
      {name: "W", label: "Power consumption (W)"},
      {name: "CFM", label: "Supply air flow rate (CFM)"}
    ]

    // Retrieve sensor data and update chart data    
    getVoltData = async () => {
      readSensors().then((res) => {

        console.log("this.state.unitManagerData: ", this.state.unitManagerData);
        console.log("res: ", res);

        if (this.state.sensorMetadata.length === 0) {
          this.setState({sensorMetadata: res.metadata});
        }
        
        for (const unitIdStr of Object.keys(this.state.unitManagerData)) {
          const unitId = Number(unitIdStr);
          const unitData = this.state.unitManagerData[unitId];
          const unitSystem = unitData.system;
          const resSensorData = Object.values(res.sensorData).find((entry: any) => entry.system === unitSystem) as {
                ctrlValues: Record<string, number | string>;
                lineChartData: { index: number; time: string; values: { [key: string]: number }; };
              };

          this.setState(prevState => {
            const unitData = prevState.unitManagerData[unitId] || {
              id: unitId,
              building: "",
              system: "",
              ctrlValues: resSensorData.ctrlValues,
              chartConfigs: [],
              lineChartData: resSensorData.lineChartData,
            };
        
            return {
              unitManagerData: {
                ...prevState.unitManagerData,
                [unitId]: {
                  ...unitData,
                  ctrlValues: resSensorData.ctrlValues,
                  lineChartData: resSensorData.lineChartData,
                },
              },
            };
          });

          if (unitData.varList.length === 0) {
            this.setState(prevState => { 
              const unitData = prevState.unitManagerData[unitId];
              const unitVarList = Object.keys(unitData.lineChartData[0]).filter(key => key !== "time");

              return {
                unitManagerData: {
                  ...prevState.unitManagerData,
                  [unitId]: {
                    ...unitData,
                    varList: unitVarList
                  }
                }
              }              
            })
          };          
        }
      });
      
    };    

    // Initialize default unit manager configuration for each unit
    initializeUnitData = () => {

      if (this.state.startCollect && this.props.units) {
        this.setState({ startCollect: false });
        const newUnitManagerData: UnitsState["unitManagerData"] = {}; 

        for (const unit of this.props.units || []) {
          if (!unit?.id) continue; 

          const unitId = unit.id;
          const defaultChartConfigs = convertChartConfigs((unit.configuration as any)?.chartConfigs);

          newUnitManagerData[unitId] = {
            id: unitId,
            building: unit.building,
            system: unit.system,
            varList: [],
            ctrlValues: {},
            chartConfigs: defaultChartConfigs, //[{ id: 0, type: "line", selectedVariables: [] }], 
            lineChartData: [
              { index: 0, time: "2025-01-01 00:00:00", values: {con_oveTSetCoo_u: 60} },
              { index: 1, time: "2025-01-01 00:00:00", values: {con_oveTSetCoo_u: 62} },
              { index: 2, time: "2025-01-01 00:00:00", values: {con_oveTSetCoo_u: 66} },
              { index: 3, time: "2025-01-01 00:00:00", values: {con_oveTSetCoo_u: 64} },
            ],
          };
      
        }
        this.setState(prevState => ({
          unitManagerData: {
            ...prevState.unitManagerData,
            ...newUnitManagerData,
          }
        }));
      }
    };

  render() {
    const { filtered, configurations } = this.props;
    const { editingAll, editing, expanded } = this.state;
    const copy = cloneDeep(filtered) ?? [];
    copy.forEach((v) => {
      v.configuration!.holidays = HolidayType.values.map(
        (t) => v.configuration?.holidays?.find((h) => h?.label === t.label) ?? {}
      );
    });

    filtered?.forEach((unit) => {
      const id = String(unit.id);
      if (!this.unitRefs[id]) {
        this.unitRefs[id] = React.createRef<HTMLDivElement>();
      }
    });    

    const selectedUnitId = Number(this.props.location?.state?.selectedUnitId);
    var unitData = !isNaN(selectedUnitId) ? this.state.unitManagerData[selectedUnitId] : undefined;  

    const defaultUnit = {
      location: filtered
        ? getCommon(
            filtered.map((f) => f.location ?? {}),
            ["createdAt", "updatedAt", "action", "terms"]
          )
        : {},
      configuration: {
        holidays: HolidayType.values.map((t) =>
          filtered
            ? getCommon(
                filtered.map((f) => f.configuration?.holidays?.find((h) => h?.label === t.label) ?? {}),
                ["createdAt", "updatedAt", "action", "terms"]
              )
            : {}
        ),
      },
    };

    const campusGroups = (filtered ?? []).reduce((acc: Record<string, Record<string, IUnit[]>>, u) => {
      const campus = u.campus || "Unknown";
      const bldg   = u.building || "Unknown";
      (acc[campus] ??= {});
      (acc[campus][bldg] ??= []).push(u);
      return acc;
    }, {});

    const campusIds = Object.keys(campusGroups).sort();
    const activeCampus = this.state.activeCampus ?? campusIds[0]; // default once we have data

    return (
      <div className={"dashboard"}>
        {this.renderPrompt()}
        <Header {...this.props} />
        {defaultUnit && (
          <div className="list padding update-all-units">
            <Card interactive>
              <div className="row">
                <div>
                  <Label>
                    <h3>Update All Units</h3>
                  </Label>
                </div>
                <div>
                  {this.isSave(defaultUnit, editingAll) ? (
                    <>
                      <Tooltip2 content="Save" placement={Position.TOP}>
                        <Button
                          icon={IconNames.FLOPPY_DISK}
                          intent={Intent.PRIMARY}
                          minimal
                          onClick={() => this.handleSaveAll()}
                        />
                      </Tooltip2>
                      <Tooltip2 content="Exit" placement={Position.TOP}>
                        <Button
                          icon={IconNames.CROSS}
                          intent={Intent.PRIMARY}
                          minimal
                          onClick={() => this.handleClearAll()}
                        />
                      </Tooltip2>
                    </>
                  ) : null}
                </div>
              </div>
              <div>
                <Tree
                  contents={[
                    {
                      id: "holidays-all",
                      label: "Holidays",
                      icon: IconNames.SERIES_CONFIGURATION,
                      hasCaret: true,
                      isExpanded: expanded === "holidays-all",
                    },
                  ]}
                  onNodeExpand={(e) => this.setState({ expanded: e.id as string })}
                  onNodeCollapse={() => this.setState({ expanded: null })}
                  onNodeClick={(e) => this.setState({ expanded: e.id === expanded ? null : (e.id as string) })}
                />
                <Collapse isOpen={expanded === "holidays-all"}>
                  <Label>
                    <h3>Predefined Holidays</h3>
                    <ul>
                      {defaultUnit?.configuration?.holidays?.map((holiday, i) => (
                        <li key={holiday?.label ?? i}>
                          <Holiday
                            key={holiday?.label}
                            path={`configuration.holidays.${i}`}
                            unit={defaultUnit}
                            editing={editingAll}
                            holiday={holiday!}
                            handleChange={this.handleChange}
                            readOnly={!this.isAdmin()}
                          />
                        </li>
                      ))}
                    </ul>
                  </Label>
                </Collapse>
              </div>
            </Card>
          </div>
        )}

        <h1>Units</h1>
        <Card className="campus-tabs" elevation={1}>
          <Tabs
            id="campus-tabs"
            className={Classes.LARGE}
            renderActiveTabPanelOnly
            selectedTabId={activeCampus}
            onChange={(id) => this.setState({ activeCampus: String(id), openBuildings: {} })}
          >
            {campusIds.map((campusId) => {
              const bldgCount = Object.keys(campusGroups[campusId]).length;

              return (
                <Tab
                  id={campusId}
                  key={campusId}
                  title={
                    // Campus tabs
                    <span className="campus-tab-title">
                      <Icon icon={IconNames.MAP_MARKER} />
                      <span className="campus-tab-text">{campusId}</span>
                      {/* Tags counting the number of buildings on the campus */}
                      <Tag minimal round>{bldgCount} bldg{bldgCount > 1 ? "s" : ""}</Tag>
                    </span>
                  }
                  panel={
                    <div className="list campus-panel">
                      {Object.keys(campusGroups[campusId]).sort().map((bldgId) => {
                        const unitsInBldg = campusGroups[campusId][bldgId];
                        const isOpen = !!this.state.openBuildings?.[bldgId];
                        const zoneCount = unitsInBldg.length;

                        return (
                          // Building lists
                          <Card key={`bldg-${campusId}-${bldgId}`} interactive style={{ marginBottom: "2rem" }}>
                            <div className="row" style={{ alignItems: "center" }}>
                              <div className="col-md-10" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <Icon icon={IconNames.OFFICE} />
                                <h3 style={{ margin: 0 }}>{bldgId}</h3>
                                {/* Tags counting the number of zones in the building */}
                                <Tag minimal round>{zoneCount} zone{zoneCount !== 1 ? "s" : ""}</Tag>
                              </div>
                              <div className="col-md-2" style={{ textAlign: "right" }}>
                                <Button
                                  minimal
                                  icon={isOpen ? IconNames.CARET_DOWN : IconNames.CARET_RIGHT}
                                  onClick={() =>
                                    this.setState(prev => ({
                                      openBuildings: isOpen ? {} : { [bldgId]: true },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                            {/* Zone lists */}
                            <Collapse isOpen={isOpen}>
                            <div style={{marginTop: "15px"}}>
                              {unitsInBldg.map((unit, i) => {
                                const selectedUnitId = Number(this.props.location?.state?.selectedUnitId);
                                var unitData = !isNaN(selectedUnitId) ? this.state.unitManagerData[selectedUnitId] : undefined;
                                unitData = this.state.unitManagerData[unit.id!];

                                return unit.id === this.state.editing?.id ? (
                                  // Selected zones
                                  <div key={unit.id ?? i} ref={this.unitRefs[unit.id!]}>
                                <Card interactive style={{ marginBottom: "2rem" }}>
                                  <div className="row" style={{ marginBottom: 20 }}>
                                    <div className="col-md-10">
                                      <Label>
                                        <h2>{unit.system}</h2>
                                      </Label>
                                    </div>
                                    <div className="col-md-2" style={{textAlign: "right", marginTop: "20px"}}>
                                      {this.renderStatus(unit)}
                                      <Tooltip2 content="Save" placement={Position.TOP} disabled={!this.isSave(unit)}>
                                        <Button
                                          icon={IconNames.FLOPPY_DISK}
                                          intent={Intent.PRIMARY}
                                          minimal
                                          onClick={() => this.handleSave()}
                                          disabled={!this.isSave(unit)}
                                        />
                                      </Tooltip2>
                                      <Tooltip2 content="Exit" placement={Position.TOP}>
                                        <Button
                                          icon={IconNames.CROSS}
                                          intent={Intent.PRIMARY}
                                          minimal
                                          onClick={() => this.handleCancel()}
                                        />
                                      </Tooltip2>
                                    </div>
                                  </div>
                                  <div className="row"  style={{marginBottom: "20px"}}>
                                    <div className="col-md-6">
                                      <div className="row">
                                        <div className="col-md-6">
                                          <Label>
                                            <b>Campus</b>
                                            <InputGroup type="text" value={unit.campus} readOnly />
                                          </Label>
                                        </div>
                                        <div className="col-md-6">
                                          <Label>
                                            <b>Building</b>
                                            <InputGroup type="text" value={unit.building} readOnly />
                                          </Label>
                                        </div>
                                        <div className="col-md-6">
                                          <Label>
                                            <b>Building Type</b>
                                            <InputGroup type="text" value={unit.bldgType} readOnly />
                                          </Label>
                                        </div>
                                        <div className="col-md-6">
                                          <Label>
                                            <b>System</b>
                                            <InputGroup type="text" value={unit.system} readOnly />
                                          </Label>
                                        </div>
                                        <div className="col-md-6">
                                          <Label>
                                            <b>Operator</b>
                                            <InputGroup type="text" value={`${unit.operator}`} readOnly />
                                          </Label>
                                        </div>
                                        <div className="col-md-6">
                                          <Label>
                                            <b>Timezone</b>
                                            <InputGroup type="text" value={unit.timezone} readOnly />
                                          </Label>
                                        </div>
                                        <div />
                                      </div>
                                      <div className="row">
                                        <h3>Building Description</h3>                
                                        <div className="placeholder-container">
                                          <img src={unit.image} alt={`Image for ${unit.label}`}/>
                                          <div className="placeholder-overlay">
                                            <div className="placeholder-text">Image Placeholder<br/>{unit.building} {unit.system}</div>
                                          </div>
                                        </div>
                                        <TextArea value={unit.description} 
                                          readOnly
                                          fill
                                          growVertically
                                          large
                                        />
                                      </div>
                                      <Collapse isOpen={true}>
                                        {!this.configRouteIsHidden && (
                                          <>
                                            <Tree
                                              contents={[
                                                {
                                                  id: "configuration",
                                                  label: "Configuration",
                                                  icon: IconNames.SERIES_CONFIGURATION,
                                                  hasCaret: true,
                                                  isExpanded: expanded === "configuration",
                                                },
                                              ]}
                                              onNodeExpand={(e) => this.setState({ expanded: e.id as string })}
                                              onNodeCollapse={() => this.setState({ expanded: null })}
                                              onNodeClick={(e) => this.setState({ expanded: e.id === expanded ? null : (e.id as string) })}
                                            />
                                            <Collapse isOpen={expanded === "configuration"}>
                                              <Configuration
                                                unit={unit}
                                                editing={editing}
                                                configurations={configurations}
                                                handleChange={this.handleChange}
                                                handleCreate={this.handleCreate}
                                                readOnly={!this.isAdmin()}
                                              />
                                            </Collapse>
                                          </>
                                        )}
                                        <div className="row" style={{  marginTop: "1.5rem", marginBottom: "1rem" }}>
                                          <h2>Controllers</h2>
                                        </div>
                                        <Tree
                                          contents={[
                                            {
                                              id: "setpoints",
                                              label: "Setpoints",
                                              icon: IconNames.TEMPERATURE,
                                              hasCaret: true,
                                              isExpanded: expanded === "setpoints",
                                            },
                                          ]}
                                          onNodeExpand={(e) => this.setState({ expanded: e.id as string })}
                                          onNodeCollapse={() => this.setState({ expanded: null })}
                                          onNodeClick={(e) => this.setState({ expanded: e.id === expanded ? null : (e.id as string) })}
                                        />
                                        <Collapse isOpen={expanded === "setpoints"}>
                                        <div style={{ marginTop: "20px" }}>
                                          <Setpoints unit={unit} editing={editing} handleChange={this.handleChange} handleSetpointValueChange={(name: string, value: number | string) => this.handleSetpointValueChange(unit.id!, name, value)}/> 
                                        </div>
                                        </Collapse>
                                        <Tree
                                          contents={[
                                            {
                                              id: "schedules",
                                              label: "Occupancy Schedules",
                                              icon: IconNames.TIME,
                                              hasCaret: true,
                                              isExpanded: expanded === "schedules",
                                            },
                                          ]}
                                          onNodeExpand={(e) => this.setState({ expanded: e.id as string })}
                                          onNodeCollapse={() => this.setState({ expanded: null })}
                                          onNodeClick={(e) => this.setState({ expanded: e.id === expanded ? null : (e.id as string) })}
                                        />
                                        <Collapse isOpen={expanded === "schedules"}>
                                        <div style={{ marginTop: "20px" }}>
                                          <Schedules
                                            unit={unit}
                                            editing={editing}
                                            handleChange={this.handleChange}
                                            readOnly={!this.isAdmin()}                          
                                          />
                                        </div>
                                        </Collapse>
                                        <Tree
                                          contents={[
                                            {
                                              id: "holidays",
                                              label: "Holidays",
                                              icon: IconNames.TIMELINE_EVENTS,
                                              hasCaret: true,
                                              isExpanded: expanded === "holidays",
                                            },
                                          ]}
                                          onNodeExpand={(e) => this.setState({ expanded: e.id as string })}
                                          onNodeCollapse={() => this.setState({ expanded: null })}
                                          onNodeClick={(e) => this.setState({ expanded: e.id === expanded ? null : (e.id as string) })}
                                        />
                                        <Collapse isOpen={expanded === "holidays"}>
                                          <Holidays
                                            unit={unit}
                                            editing={editing}
                                            handleChange={this.handleChange}
                                            readOnly={!this.isAdmin()}
                                          />
                                        </Collapse>
                                        <Tree
                                          contents={[
                                            {
                                              id: "occupancies",
                                              label: "Temporary Occupancy",
                                              icon: IconNames.HOME,
                                              hasCaret: true,
                                              isExpanded: expanded === "occupancies",
                                            },
                                          ]}
                                          onNodeExpand={(e) => this.setState({ expanded: e.id as string })}
                                          onNodeCollapse={() => this.setState({ expanded: null })}
                                          onNodeClick={(e) => this.setState({ expanded: e.id === expanded ? null : (e.id as string) })}
                                        />
                                        <Collapse isOpen={expanded === "occupancies"}>
                                          <Occupancies unit={unit} editing={editing} handleChange={this.handleChange} />
                                        </Collapse>
                                      </Collapse>
                                    </div>
                                    <div className="col-md-6">
                                      <h2>Data Monitoring</h2>

                                      <div style={{display:"flex"}}>
                                        <h3>Add/Remove a chart: </h3>
                                        <div style={{marginTop:"2.9%", marginLeft: "1%"}}>
                                          <Tooltip2 content="Add" placement={Position.BOTTOM}>
                                                  <Button
                                                    icon={IconNames.PLUS}
                                                    intent={Intent.PRIMARY}
                                                    small
                                                    className="custom-button"
                                                    onClick={() => this.addChart(unit.id!)}                          
                                                  />
                                          </Tooltip2>
                                          <Tooltip2 content="Remove" placement={Position.BOTTOM}>
                                                  <Button
                                                    icon={IconNames.MINUS}
                                                    intent={Intent.PRIMARY}
                                                    small
                                                    className="custom-button"
                                                    onClick={() => this.removeChart(unit.id!)}           
                                                  />
                                          </Tooltip2>
                                        </div>
                                      </div>

                                      <div className="row">
                                        {unitData?.chartConfigs?.map((chart) => { 
                                          const chartType = chart.type;
                                          
                                          return (
                                            <div key={`${unit.id}-${chart.id}`} style={{ marginBottom: "10px" }}>
                                              <div className="select">
                                                {this.renderChartSelect(
                                                  unit.id!,
                                                  chart.id,
                                                  `Chart ${chart.id + 1}`,
                                                  this.state.unitManagerData[unit.id!].lineChartData[0],
                                                  chart.selectedVariables,
                                                  (newSelection) => this.handleChartSelect(unit.id!, chart.id, newSelection)
                                                )}
                                              </div>
                                              {chartType === "line" 
                                                ? this.renderLineChart(unit.id!, chart.id)
                                                : chartType === "scatter" 
                                                ? this.renderScatterPlot(unit.id!, chart.id)
                                                : chartType === "box"
                                                ? this.renderBoxPlot(unit.id!, chart.id)
                                                : null}
                                            </div>
                                          );
                                        })}
                                      </div>      
                                      <div className="row">
                                      </div>                  
                                    </div>
                                  </div>

                                </Card>
                                </div>
                                ) : (
                                  // Rest of the zones
                                  <div key={unit.id ?? i} ref={this.unitRefs[unit.id!]}>
                                    <Card interactive style={{ marginBottom: "2rem" }}>
                                      <div className="row">
                                        <div className="col-md-10" style={{ display: "flex", alignItems: "center", gap: "0px" }}>
                                          <Icon icon={IconNames.COG} />
                                          <h3 style={{ margin: 10 }}>{unit.system}</h3>
                                        </div>
                                        <div className="col-md-2" style={{ textAlign: "right", marginTop: 0 }}>
                                          {this.renderStatus(unit)}
                                          <Tooltip2 content="Edit" placement={Position.TOP}>
                                            <Button
                                              icon={IconNames.EDIT}
                                              intent={Intent.PRIMARY}
                                              minimal
                                              onClick={() => this.handleEdit(unit)}
                                            />
                                          </Tooltip2>
                                        </div>
                                      </div>
                                    </Card>
                                  </div>
                                );
                              })}
                              </div>
                            </Collapse>
                          </Card>
                        );
                      })}
                    </div>
                  }
                />
              );
            })}
          </Tabs>
        </Card>
      </div>


    );
  }
}

const mapStateToProps = (state: any) => ({
  units: selectReadUnits(state),
  filtered: selectFilterUnits(state),
  configurations: selectReadConfigurations(state),
});

const mapActionToProps = {
  readUnits,
  readUnit,
  readUnitsPoll,
  filterUnits,
  updateUnit,
  readConfigurations,
  readConfigurationsPoll,
  createConfiguration,
  updateConfiguration,
  deleteConfiguration,
  updateSetpoint,
};

export default connect(mapStateToProps, mapActionToProps)(withLocation(Dashboard));
