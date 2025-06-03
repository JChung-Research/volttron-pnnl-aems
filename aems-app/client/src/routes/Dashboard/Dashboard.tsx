import "./style.scss";

import { Alert, Button, Card, Collapse, InputGroup, TextArea, Intent, Label, Position, Tree, Menu, MenuItem } from "@blueprintjs/core";
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
import React from "react";
import { RootProps } from "routes";
import { Setpoints } from "./Setpoints";
import { HolidayType, RoleType, StageType } from "common";
import { Popover2, Tooltip2 } from "@blueprintjs/popover2";
import { connect } from "react-redux";
import { createConfigurationDefault } from "utils/configuration";
import { defaultPollInterval } from "controllers/poll/action";
import { isSetpointValid } from "utils/setpoint";
import { DeepPartial } from "../../utils/types";
import { ISetpoint, updateSetpoint } from "controllers/setpoints/action";
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
      ctrlValues: Record<string, number>;
      lineChartData: { index: number; time: string; values: {[key:string]: number; }}[];
      chartConfigs: { id: number; selectedOutputs: string[] }[];
    };
  };
  startCollect: boolean | null;
  sensorMetadata: MetadataItem[];
}

type AxisInfo = {
  name: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  yList: number[];
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
      sensorMetadata: []
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
      }, 10000);
  }

  // Scroll to selected unit and reinitialize unit data on props update
  componentDidUpdate(prevProps: UnitsProps) {
    const selectedUnitId = this.props.location?.state?.selectedUnitId;
    if (
      selectedUnitId !== undefined &&
      String(selectedUnitId) in this.unitRefs &&
      !this.hasScrolledToUnit
    ) {
      const ref = this.unitRefs[String(selectedUnitId)];
  
      if (ref?.current) {
        this.hasScrolledToUnit = true;
  
        requestAnimationFrame(() => {
          const element = this.unitRefs[String(selectedUnitId)]!.current!;
          const offset = element.getBoundingClientRect().top + window.pageYOffset - 60;
          window.scrollTo({ top: offset, behavior: "smooth" });
        });
      }
    }
  
    if (prevProps.units !== this.props.units && this.props.units && this.props.units.length > 0) {
      this.initializeUnitData();
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
  handleSetpointValueChange = (unitId: number, name: string, value: number) => {

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
      this.setState({ editing: null, expanded: null });
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
      valid &&
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

      return {
        unitManagerData: {
          ...prevState.unitManagerData,
          [unitId]: {
            ...prevState.unitManagerData[unitId],
            chartConfigs: [...currentCharts, { id: nextChartId, selectedOutputs: [] }]
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
    selectedOutputs: string[],
    onChange: (selection: string[]) => void
  ) => {
    const usedVariables = Object.keys(chartData.values);
    const selectMetadata = this.state.sensorMetadata.filter(item => usedVariables.includes(item.name));
    
// HERE!!!
    return (
      <Label>
        <b>{label}</b>
        <Popover2
          content={
            <div style={{ display: 'flex', gap: '5px', padding: '10px' }}>
              {/* Control Column */}
              <Menu style={{ flex: 1, width: '450px' }}>
                <MenuItem text="Control" disabled />
                {selectMetadata?.filter((v) => v.type === "control").map((item) => {      
                  const isChecked = selectedOutputs.includes(item.name);
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
                              const chartConfigs = prevState.unitManagerData[unitId].chartConfigs.map((config, idx) => {
                                if (idx !== chartId) return config;

                                const updatedSelectedOutputs = isChecked
                                  ? [...config.selectedOutputs, itemName]
                                  : config.selectedOutputs.filter((v) => v !== itemName);

                                return {
                                  ...config,
                                  selectedOutputs: updatedSelectedOutputs,
                                };
                              });

                              return {
                                unitManagerData: {
                                  ...prevState.unitManagerData,
                                  [unitId]: {
                                    ...prevState.unitManagerData[unitId],
                                    chartConfigs: chartConfigs,
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
                {selectMetadata?.filter((v) => v.type === "enviroment").map((item) => {
                  const isChecked = selectedOutputs.includes(item.name);
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
                                const chartConfigs = prevState.unitManagerData[unitId].chartConfigs.map((config, idx) => {
                                  if (idx !== chartId) return config;

                                  const updatedSelectedOutputs = isChecked
                                    ? [...config.selectedOutputs, itemName]
                                    : config.selectedOutputs.filter((v) => v !== itemName);

                                  return {
                                    ...config,
                                    selectedOutputs: updatedSelectedOutputs,
                                  };
                                });

                                return {
                                  unitManagerData: {
                                    ...prevState.unitManagerData,
                                    [unitId]: {
                                      ...prevState.unitManagerData[unitId],
                                      chartConfigs: chartConfigs,
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
          {selectedOutputs.length > 0
            ? `${selectedOutputs.length} selected`
            : "Select variables..."}
        </Button>
        </Popover2>
      </Label>
    );
  };

  handleChartSelect = (unitId:number, chartId: number, selectedOutputs: string[]) => {
    this.setState((prevState) => ({
      unitManagerData: {
        ...prevState.unitManagerData,
        [unitId]: {
          ...prevState.unitManagerData[unitId],
          chartConfigs: prevState.unitManagerData[unitId].chartConfigs.map((cfg) =>
            cfg.id === chartId ? { ...cfg, selectedOutputs } : cfg
          ),
        },
      },
    }));
  };

  buildYAxisInfo = (unitId: number, chartId: number): AxisInfo[] => {
    const unitData = this.state.unitManagerData[unitId];
    if (!unitData) return [];
  
    const chartConfig = unitData.chartConfigs.find((c) => c.id === chartId);
    if (!chartConfig) return [];
  
    return chartConfig.selectedOutputs.map((outputName) => {
      const yList = unitData.lineChartData.map((d) => d.values[outputName]);
      const yAxisMin = Math.min(...yList);
      const yAxisMax = Math.max(...yList);
      const match = this.state.sensorMetadata.find(
        (o) => o.name === outputName
      );
      return {
        name: outputName,
        label: match?.label || outputName,
        unit: match?.unit || '', 
        min: yAxisMin,
        max: yAxisMax,
        yList,
      };
    });
  };  

  // Render a Plotly line chart with dual Y-axes for selected outputs
  renderLineChart = (unitId: number, chartIndex: number) => {

    // Unit setting for line charts
    const unitData = this.state.unitManagerData[unitId];
    const yAxisInfo = this.buildYAxisInfo(unitId, chartIndex);
    const primaryUnit = yAxisInfo[0]?.unit;
    let secondaryIndex: number | null = null;

    for (let i = 1; i < yAxisInfo.length; i++) {
      if (yAxisInfo[i].unit !== primaryUnit) {
        secondaryIndex = i;
        break;
      }
    }

    // Separate yLists based on axis assignment
    const primaryYValues = yAxisInfo
      .filter((_, idx) => idx !== secondaryIndex)
      .flatMap((info) => info.yList);

    const secondaryYValues = secondaryIndex !== null
      ? yAxisInfo[secondaryIndex].yList
      : [];

    return (
        <Plot
          key={`${unitId}-${chartIndex}`}
          data={yAxisInfo.map((info, idx) => ({
            x: unitData.lineChartData.map((d) => d.time.split(" ")[1]),
            y: info.yList,
            type: 'scatter',
            mode: 'lines',
            name: `${info.label} (${info.unit})`,
            line: {
              shape: 'spline',
              color: `hsl(${(idx * 60) % 360}, 70%, 40%)`,
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
                text: 'Time from beginning of the year (days)',
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
                  secondaryIndex !== null && yAxisInfo[secondaryIndex]
                  ? `${this.unitLabels.find((o) => o.name === yAxisInfo[secondaryIndex].unit)?.label}`
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

    unitLabels = [
      {name: "°F", label: "Temperature (°F)"},
      {name: "[0-1]", label: "Control signal ([0,1])"},
      {name: "on/off", label: "Pump stage (on/off)"},
      {name: "kg/s", label: "Supply air flow rate (kg/s)"},
      {name: "ppm", label: "CO2 concentration (ppm)"},
      {name: "W", label: "Power consumption (W)"}
    ]

    // Retrieve sensor data and update chart data    
    getVoltData = async () => {
      readSensors().then((res) => {

        console.log("this.state.unitManagerData: ", this.state.unitManagerData);
        console.log("res: ", res);

        if (this.state.sensorMetadata.length == 0) {
          this.setState({sensorMetadata: res.metadata});
        }
        
        for (const unitIdStr of Object.keys(this.state.unitManagerData)) {
          const unitId = Number(unitIdStr);
          const unitData = this.state.unitManagerData[unitId];
          const unitSystem = unitData.system;
          const resSensorData = Object.values(res.sensorData).find((entry: any) => entry.system === unitSystem) as {
                ctrlValues: Record<string, number>;
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

          if (unitData.varList.length == 0) {
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

          newUnitManagerData[unitId] = {
            id: unitId,
            building: unit.building,
            system: unit.system,
            varList: [],
            ctrlValues: {},
            chartConfigs: [{ id: 0, selectedOutputs: [] }], 
            lineChartData: [
              { index: 0, time: "2025-01-01 00:00:00", values: {con_oveTSetCoo_u: 60} },
              { index: 0, time: "2025-01-01 00:00:00", values: {con_oveTSetCoo_u: 62} },
              { index: 0, time: "2025-01-01 00:00:00", values: {con_oveTSetCoo_u: 66} },
              { index: 0, time: "2025-01-01 00:00:00", values: {con_oveTSetCoo_u: 64} },
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

    return (
      <div className={"dashboard"}>
        {this.renderPrompt()}
        <Header {...this.props} />

        <h1>Building Units</h1>
        <div className="list">
          {filtered?.map((unit, i) => {
            unitData = this.state.unitManagerData[unit.id!];
            
            return unit.id === editing?.id ? (
              <div key={unit.id ?? i} ref={this.unitRefs[unit.id!]}>
              <Card interactive style={{ marginBottom: "2rem" }}>
                <div className="row">
                  <div className="col-md-10">
                    <Label>
                      <h2>{unit.label}</h2>
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
                <div className="row">
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
                          <b>Operator (source)</b>
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
                        <Setpoints unit={unit} editing={editing} handleChange={this.handleChange} handleSetpointValueChange={(name: string, value: number) => this.handleSetpointValueChange(unit.id!, name, value)}/> 
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
                        return (
                          <div key={`${unit.id}-${chart.id}`} style={{ marginBottom: "10px" }}>
                            <div className="select">
                              {this.renderChartSelect(
                                unit.id!,
                                chart.id,
                                `Line chart ${chart.id + 1}`,
                                this.state.unitManagerData[unit.id!].lineChartData[0],
                                chart.selectedOutputs,
                                (newSelection) => this.handleChartSelect(unit.id!, chart.id, newSelection)
                              )}
                            </div>
                            {this.renderLineChart(unit.id!, chart.id)}
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
              <div key={unit.id ?? i} ref={this.unitRefs[unit.id!]}>
              <Card interactive style={{ marginBottom: "2rem" }}>
                <div className="row">
                  <div className="col-md-10">
                    <Label>
                      <h3>{unit.label}</h3>
                    </Label>
                  </div>
                  <div className="col-md-2" style={{textAlign: "right", marginTop: "20px"}}>
                    {/* {this.renderStatus(unit)} */}
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
          {this.renderConfirm()}
        </div>
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
