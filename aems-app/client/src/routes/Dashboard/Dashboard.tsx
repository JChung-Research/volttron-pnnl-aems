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
import { cloneDeep, get, isEqualWith, isNil, isObject, merge, set } from "lodash";

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
import Plot from 'react-plotly.js';

import { useLocation } from "react-router-dom";

import { readSensors } from "controllers/units/api";

const BLDG_CHART_OFFSET = 10000;

function withLocation(Component: any) {
  return function WrappedComponent(props: any) {
    const location = useLocation();
    return <Component {...props} location={location} />;
  };
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

const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
const parseAbs = (s: string) => new Date(s.replace(" ", "T"));
const parseRel = (s: string, base = new Date()) => {
  const m = /^now-(\d+)([hmd])$/.exec(s);
  if (!m) return null;
  const n = parseInt(m[1], 10), d = new Date(base);
  if (m[2] === "h") d.setHours(d.getHours() - n);
  else if (m[2] === "d") d.setDate(d.getDate() - n);
  else if (m[2] === "m") d.setMonth(d.getMonth() - n);
  return d;
};

// Convert a token like 'now-6h' or '2025-09-01 08:00:00' to a Date (or null)
const toDateOrNull = (s?: string, base: Date = new Date()): Date | null => {
  if (typeof s !== "string") return null;
  if (s === "now") return base;
  return parseRel(s, base) || parseAbs(s) || null;
};

// Convert token to 'YYYY-MM-DD HH:MM:SS' (or undefined if invalid)
const toTimeString = (s?: string, base: Date = new Date()): string | undefined => {
  const d = toDateOrNull(s, base);
  return d ? fmt(d) : undefined;
};


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

type lineChartDataType = { index: number; time: string; values: Record<string, any> };
type TimeRange = Partial<{ start_time: string; end_time: string }>;

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
      dataTimeRange: TimeRange;
      varList: string[];
      ctrlValues: Record<string, number | string>;
      lineChartData: lineChartDataType[];      
      chartConfigs: { id: number; type: string; selectedVariables: string[]; timeRange?: TimeRange; vizSettings?: Record<string, VizSetting>; }[];
    };
  };
  bldgChartConfigs: Record<
    string,
    { chartConfigs: { id: number; type: string; selectedVariables: string[]; timeRange?: TimeRange; vizSettings?: Record<string, VizSetting> }[] }
  >;
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
      bldgChartConfigs: {},
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
      }, 5000 * 6);
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
    const unit = this.props.units?.find(unit => unit.id === Number(selectedUnitId));
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
        dataTimeRange: {},
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

  userAccessibleBldgs() {
    const { user } = this.props;
    const access = (user?.bldgAccess ?? {}) as Record<string, boolean>;

    return Object.keys(access).filter((k) => access[k]);
  }

  isReadOnlyUser() {
    const { user } = this.props;

    return user?.readOnly;
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
          disabled={!this.isAdmin() || !this.isPush(unit)}
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

  addBldgChart = (bldgName: string) => {
    this.setState(prev => {
      const entry = prev.bldgChartConfigs[bldgName] ?? { chartConfigs: [] as any[] };
      const nextId = entry.chartConfigs.length + BLDG_CHART_OFFSET;
      return {
        bldgChartConfigs: {
          ...prev.bldgChartConfigs,
          [bldgName]: { chartConfigs: [...entry.chartConfigs, { id: nextId, type: "line", selectedVariables: [] }] },
        },
      };
    });
  };

  removeBldgChart = (bldgName: string) => {
    this.setState(prev => {
      const entry = prev.bldgChartConfigs[bldgName];
      if (!entry || entry.chartConfigs.length === 0) return null;
      return {
        bldgChartConfigs: {
          ...prev.bldgChartConfigs,
          [bldgName]: { chartConfigs: entry.chartConfigs.slice(0, -1) },
        },
      };
    });
  };

  handleBldgChartSelect = (bldgName: string, chartId: number, newSelection: string[]) => {
    this.setState(prev => {
      const entry = prev.bldgChartConfigs[bldgName];
      if (!entry) return null;
      const chartConfigs = entry.chartConfigs.map(c => (c.id === chartId ? { ...c, selectedVariables: newSelection } : c));
      return { bldgChartConfigs: { ...prev.bldgChartConfigs, [bldgName]: { chartConfigs } } };
    });
  };

  private toBuildingData = (unitManagerData: any, bldgName?: string) => {
    const units: any[] = Array.isArray(unitManagerData)
      ? unitManagerData
      : Object.values(unitManagerData || {});

    const sameBldg = bldgName ? units.filter(u => u.building === bldgName) : units;
    if (!sameBldg.length) return null;

    const building = sameBldg[0].building;
    const varList = sameBldg[0].varList ?? ["index", "values"];

    // Merge control values with system prefix e.g., "201_ZoneAirHeatingSetpoint"
    const ctrlValues = sameBldg.reduce<Record<string, any>>((acc, u) => {
      Object.entries(u.ctrlValues || {}).forEach(([k, v]) => {
        acc[`${u.system}_${k}`] = v;
      });
      return acc;
    }, {});

    // Merge timeseries by time; prefix variable names with system (201_, 202_, ...)
    const byTime = new Map<string, lineChartDataType>();
    sameBldg.forEach(u => {
      (u.lineChartData || []).forEach((s: lineChartDataType) => {
        const key = s.time;
        const tgt = byTime.get(key) ?? { index: s.index, time: s.time, values: {} };
        Object.entries(s.values || {}).forEach(([k, v]) => {
          tgt.values[`${u.system}_${k}`] = v;
        });
        byTime.set(key, tgt);
      });
    });

    const lineChartData = Array.from(byTime.values()).sort((a, b) => a.index - b.index);
    const chartConfigs = this.state.bldgChartConfigs?.[String(bldgName)]?.chartConfigs ?? [];

    return { id: 0, building, varList, ctrlValues, chartConfigs, lineChartData };
  };

  renderZoneChartSelect = (
    unitId: number,
    chartId: number,
    label: string,
    chartData: lineChartDataType,
    selectedVariables: string[],
    onChange: (selection: string[]) => void
  ) => {
    const usedVariables = Object.keys(chartData.values);
    const selectMetadata = this.state.sensorMetadata.filter(item => usedVariables.includes(item.name));
    const chartConfig = this.state.unitManagerData[unitId].chartConfigs[chartId];
    const chartTypes = ['line', 'scatter', 'box'];
    const nowLocal_mimusHr = (hours: number) => {
        const d = new Date(Date.now() - hours * 60 * 60 * 1000); // now - hours
        const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000); // make it local
        return shifted.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
      };

    const toStored = (s: string | undefined) =>
      s ? s.replace('T', ' ') + (s.length === 16 ? ':00' : '') : '';
    const toInput = (s: string | undefined) =>
      s ? s.replace(' ', 'T').slice(0, 16) : '';

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

        {/* Time Range Selection */}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
          <Label style={{ width: '47%', fontSize: '12pt', margin: '5px 15px'}}>
            <b>Start Time</b>
            <InputGroup
                type="datetime-local"
                value={
                  (this.state.unitManagerData?.[unitId]?.chartConfigs
                    ?.find((c: any) => c.id === chartId)?.timeRange?.start_time as string) ?? nowLocal_mimusHr(6)
                }
                onChange={(e) => {
                  const v = e.currentTarget.value; // "YYYY-MM-DDTHH:MM"
                  const stored = toStored(v);      // "YYYY-MM-DD HH:MM:SS"

                  this.setState((prevState) => {
                    // read end_time from current state
                    const currCfg = prevState.unitManagerData[unitId].chartConfigs.find((c: any) => c.id === chartId);
                    const endStored = currCfg?.timeRange?.end_time || nowLocal_mimusHr(0);                // "YYYY-MM-DD HH:MM:SS" | undefined
                    const endISO = endStored ? endStored.replace(' ', 'T') : ''; // "YYYY-MM-DDTHH:MM:SS"
                    
                    // allow update only if end > start (when end exists)
                    if (endISO && new Date(v).getTime() >= new Date(endISO).getTime()) {
                      console.log("new Date(Start Time): ", new Date(v))
                      console.log(" new Date(endISO): ",  new Date(endISO))
                      return null; // no change
                    }

                    const updatedConfigs = prevState.unitManagerData[unitId].chartConfigs.map((config: any) =>
                      config.id === chartId
                        ? { ...config, timeRange: {...(config.timeRange ?? {}) , start_time: stored } }
                        : config
                    );

                    console.log("updatedConfigs: ", updatedConfigs);
                    return {
                      unitManagerData: {
                        ...prevState.unitManagerData,
                        [unitId]: { ...prevState.unitManagerData[unitId], chartConfigs: updatedConfigs },
                      },
                    };
                  }, () => {
                    this.getVoltData();
                  });
                }}
            />
          </Label>
          <Label style={{ width: '47%', fontSize: '12pt', margin: '5px 15px'}}>
            <b>End Time</b>
            <InputGroup
                type="datetime-local"
                value={
                  (this.state.unitManagerData?.[unitId]?.chartConfigs
                    ?.find((c: any) => c.id === chartId)?.timeRange?.end_time as string) ?? nowLocal_mimusHr(0)
                }
                  onChange={(e) => {
                    const v = e.currentTarget.value; // "YYYY-MM-DDTHH:MM"
                    const stored = toStored(v);      // "YYYY-MM-DD HH:MM:SS"

                    this.setState((prevState) => {
                      // read start_time from current state
                      const currCfg = prevState.unitManagerData[unitId].chartConfigs.find((c: any) => c.id === chartId);
                      const startStored = currCfg?.timeRange?.start_time || nowLocal_mimusHr(0); // "YYYY-MM-DD HH:MM:SS" | undefined
                      const startISO = startStored ? startStored.replace(' ', 'T') : ''; // "YYYY-MM-DDTHH:MM:SS"
                      
                      // allow update only if end > start (when start exists)
                      if (startISO && new Date(v).getTime() <= new Date(startISO).getTime()) {
                        console.log("new Date(End Time): ", new Date(v))
                        console.log(" new Date(startISO): ",  new Date(startISO))
                        return null; // no change
                      }

                      const updatedConfigs = prevState.unitManagerData[unitId].chartConfigs.map((config: any) =>
                        config.id === chartId
                          ? { ...config, timeRange: {...(config.timeRange ?? {}) , end_time: stored } }
                          : config
                      );
                      
                      console.log("updatedConfigs: ", updatedConfigs);
                      return {
                        unitManagerData: {
                          ...prevState.unitManagerData,
                          [unitId]: { ...prevState.unitManagerData[unitId], chartConfigs: updatedConfigs },
                        },
                      };
                    }, () => {
                    this.getVoltData();
                  });
                  }}
            />
          </Label>
        </div>
        
        {/* Quick range buttons */}
        {(() => {
          const presets = [
            { label: 'Past 1 month', start: 'now-1m' },
            { label: 'Past 1 week',  start: 'now-7d' },
            { label: 'Past 24 hours',start: 'now-24h' },
            { label: 'Past 6 hours', start: 'now-6h' },
          ];

          const currCfg = this.state.unitManagerData[unitId].chartConfigs
            .find((c: any) => c.id === chartId);
          const tr = currCfg?.timeRange ?? {};
          const activeStart = presets.find(p => tr.start_time === p.start && (tr.end_time ?? 'now') === 'now')?.start;

          return (
            <div className="quick-range">
              {presets.map(p => (
                <button
                  key={p.start}
                  type="button"
                  className={`quick-range__btn ${activeStart === p.start ? 'is-active' : ''}`}
                  aria-pressed={activeStart === p.start}
                  onClick={() => {
                    this.setState((prevState: any) => {
                      const updated = prevState.unitManagerData[unitId].chartConfigs.map((config: any) =>
                        config.id === chartId
                          ? {
                              ...config, timeRange: {...(config.timeRange ?? {}), start_time: p.start,  end_time: 'now', },
                            } : config
                      );
                      return {
                        unitManagerData: {
                          ...prevState.unitManagerData,
                          [unitId]: { ...prevState.unitManagerData[unitId], chartConfigs: updated },
                        },
                      };
                    }, () => {
                      this.getVoltData();
                    });
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          );
        })()}

      </Label>
    );
  };

  renderBldgChartSelect = (
    bldgName: string,
    chartId: number,
    label: string,
    chartData: lineChartDataType, 
    selectedVariables: string[],
    onChange: (selection: string[]) => void
  ) => {

    Object.fromEntries(
      Object.keys(chartData.values).map(s => {
        const m = s.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
        return [m?.[1].trim() ?? s, (m?.[2] ?? "").trim()];
      })
    );

    const usedVariables = Object.keys(chartData.values);

    const selectMetadata = usedVariables.map((fullName) => {
      // split once: "102_ZoneAirTemperature" -> ["102", "ZoneAirTemperature"]
      const [zoneName, baseName = fullName] = fullName.split(/_(.+)/);
      const meta = this.state.sensorMetadata.find((m) => m.name === baseName);

      // copy meta and update only the label (and name -> full key)
      return meta
        ? { ...meta, name: fullName, label: `[${zoneName}] ${meta.label}` }
        : { name: fullName, label: `[${zoneName}] ${baseName}`, unit: "", type: "environment" };
    });

    const chartConfig = this.state.bldgChartConfigs[bldgName].chartConfigs.find((v) => v.id == chartId);
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
                              const updatedConfigs = prevState.bldgChartConfigs[bldgName].chartConfigs.map((config, idx) => {
                                if (idx + BLDG_CHART_OFFSET !== chartId) return config;

                                const updatedSelectedVars = isChecked
                                  ? [...config.selectedVariables, itemName]
                                  : config.selectedVariables.filter((v) => v !== itemName);
                                return {
                                  ...config,
                                  selectedVariables: updatedSelectedVars,
                                };
                              });

                              return {
                                bldgChartConfigs: {
                                  ...prevState.bldgChartConfigs,
                                  [bldgName]: {
                                    ...prevState.bldgChartConfigs[bldgName],
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
                                const updatedConfigs = prevState.bldgChartConfigs[bldgName].chartConfigs.map((config, idx) => {
                                  if (idx + BLDG_CHART_OFFSET !== chartId) return config;

                                  const updatedSelectedVars = isChecked
                                    ? [...config.selectedVariables, itemName]
                                    : config.selectedVariables.filter((v) => v !== itemName);

                                  return {
                                    ...config,
                                    selectedVariables: updatedSelectedVars,
                                  };
                                });

                                return {
                                  bldgChartConfigs: {
                                    ...prevState.bldgChartConfigs,
                                    [bldgName]: {
                                      ...prevState.bldgChartConfigs[bldgName],
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
                      const updatedConfigs = prevState.bldgChartConfigs[bldgName].chartConfigs.map((config) =>
                        config.id === chartId
                          ? { ...config, type }
                          : config
                      );
                      return {
                        bldgChartConfigs: {
                          ...prevState.bldgChartConfigs,
                          [bldgName]: {
                            ...prevState.bldgChartConfigs[bldgName],
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

  handleZoneChartSelect = (unitId:number, chartId: number, selectedVariables: string[]) => {
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

  buildAxisInfo = (unitData: any, chartId: number, spaceType: string): AxisInfo[] => {
    if (!unitData) return [];
  
    const chartConfig = (unitData.chartConfigs as { id: number; selectedVariables: string[]; timeRange: TimeRange }[])
      .find((c) => c.id === chartId); 
    if (!chartConfig) return [];
    console.log("buildAxisInfo+chartConfig.timeRange: ", chartConfig?.timeRange)
    
    // NEW: resolve any 'now' / 'now-6h' / absolute tokens to strings
    const now = new Date();
    const tr = chartConfig.timeRange ?? {};
    const resolvedStart = toTimeString(tr.start_time, now);
    const resolvedEnd   = toTimeString(tr.end_time,   now);
    console.log("buildAxisInfo resolved range:", { resolvedStart, resolvedEnd });

    return chartConfig.selectedVariables.map((outputName) => {
      const values = unitData.lineChartData
          .map(({ values }: { values: Record<string, number | string | null | undefined> }) => values[outputName])
          .filter((v: number | string): v is number | string => v != null && (typeof v !== "number" || Number.isFinite(v)));

      const yAxisMin = Math.min(...values);
      const yAxisMax = Math.max(...values);

      const match = (spaceType == "building") 
        ? this.state.sensorMetadata.find((o) => o.name === outputName.split(/_(.+)/)[1]) 
        : this.state.sensorMetadata.find((o) => o.name === outputName);

      return {
        name: outputName,
        label: (spaceType == "building") 
          ? `[${outputName.split(/_(.+)/)[0]}] ${outputName.split(/_(.+)/)[1]}` 
          : match?.label || outputName,
        unit: match?.unit || '', 
        min: yAxisMin,
        max: yAxisMax,
        values,
      };
    });
  };  

  // Render a Plotly line chart with dual Y-axes for selected outputs
  renderLineChart = (unitData: any, yAxisInfo: any, chartIndex: number) => {

    // Unit setting for line charts
    const primaryUnit = yAxisInfo[0]?.unit;
    let secondaryIndex: number | null = null;
    const chartConfig = unitData.chartConfigs.find((c: { id: number }) => c.id === chartIndex);

    for (let i = 1; i < yAxisInfo.length; i++) {
      if (yAxisInfo[i].unit !== primaryUnit) {
        secondaryIndex = i;
        break;
      }
    }

    // Separate values based on axis assignment
    const primaryYValues = yAxisInfo
      .filter((_: AxisInfo, idx: number) => idx !== (secondaryIndex ?? -1))
      .flatMap((info: AxisInfo) => info.values);

    const secondaryYValues = secondaryIndex !== null
      ? yAxisInfo[secondaryIndex].values
      : [];

    const getDashStyle = (dash: string | undefined): Plotly.Dash => {
      const valid: Plotly.Dash[] = ["solid", "dot", "dash", "longdash", "dashdot", "longdashdot"];
      return valid.includes(dash as Plotly.Dash) ? (dash as Plotly.Dash) : "solid";
    };

    return (
        <Plot
          key={`${unitData.building}-${chartIndex}`}
          data={yAxisInfo.map((info: AxisInfo, idx: number) => ({
            x: unitData.lineChartData.map((d: { time: string }) => d.time.split(" ")[1]),
            y: info.values,//.slice(-390),
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
  renderScatterPlot = (unitData: any, axisInfo: any, chartIndex: number) => {

    // Unit setting for line charts
    const xVar = axisInfo[0];
    const yVar = axisInfo[1];
    const chartConfig = unitData.chartConfigs.find((c: { id: number }) => c.id === chartIndex);

    return (
        <Plot
          key={`${unitData.building}-${chartIndex}`}
          data={
            xVar && yVar
              ? (Object.entries(
                  unitData.lineChartData.reduce(
                    (
                      acc: Record<string, { x: number[]; y: number[] }>,
                      point: { values: Record<string, number | string | null | undefined> }
                    ) => {
                      const zoneName = xVar.name.split('_')[0];
                      const occ = (Object.keys(unitData).includes("system")) ? String(point.values["Occupancy"] ?? "unknown") : String(point.values[`${zoneName}_Occupancy`] ?? "unknown");
                      const x = parseFloat(String(point.values[xVar.name]));
                      const y = parseFloat(String(point.values[yVar.name]));
                      if (!isNaN(x) && !isNaN(y)) {
                        acc[occ] = acc[occ] || { x: [], y: [] };
                        acc[occ].x.push(x);
                        acc[occ].y.push(y);
                      }
                      return acc;
                    },
                    {} as Record<string, { x: number[]; y: number[] }>
                  )
                ) as [string, { x: number[]; y: number[] }][]).map(([occ, coords], idx) => ({
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
  renderBoxPlot = (unitData: any, axisInfo: any, chartIndex: number) => {
    const yVar = axisInfo[0];
    const chartConfig = unitData.chartConfigs.find((c: { id: number }) => c.id === chartIndex);
    const chartKey = (Object.keys(unitData).includes("system")) ? `${unitData.id}-${chartIndex}` : `${unitData.building}-${chartIndex}`;
    
    return (
        <Plot
          key={chartKey}
          data={
            yVar
              ? (Object.entries(
                  unitData.lineChartData.reduce(
                    (
                      acc: Record<string, { x: string[]; y: number[] }>,
                      point: { time: string; values: Record<string, number | string | null | undefined> }
                    ) => {
                      const hour = new Date(point.time).getHours();
                      const zoneName = yVar.name.split('_')[0];
                      const occ = (Object.keys(unitData).includes("system")) ? String(point.values["Occupancy"] ?? "unknown") : String(point.values[`${zoneName}_Occupancy`] ?? "unknown");
                      const y = parseFloat(String(point.values[yVar.name]));
                      if (hour < 6 || hour > 20 || isNaN(y)) return acc;
                      acc[occ] ??= { x: [], y: [] };
                      acc[occ].x.push(`Hour ${hour}`);
                      acc[occ].y.push(y);
                      return acc;
                    },
                    {} as Record<string, { x: string[]; y: number[] }>
                  )
                ) as Array<[string, { x: string[]; y: number[] }]>)
                  .map(([occ, coords], occIndex) => ({
                    x: coords.x,
                    y: coords.y,
                    type: 'box',
                    name: occ,
                    marker: {
                      color: chartConfig?.vizSettings?.[occ]?.color ?? `hsl(${(occIndex * 90) % 360}, 70%, 40%)`,
                      size: chartConfig?.vizSettings?.[occ]?.marker_size ?? 6,
                    },
                    line: { width: chartConfig?.vizSettings?.[occ]?.line_width ?? 2 },
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

    updateDataTimeRange = (unitId: string | number) => {
      this.setState((prev: any) => {
        const unit = prev.unitManagerData[unitId];
        const charts = unit?.chartConfigs ?? [];

        let earliest: Date | null = null;
        let latest: Date | null = null;
        let endIsNow = false;

        const now = new Date();  
        const defaultStart = new Date(now.getTime() - 6 * 60 * 60 * 1000); // - nowUtc.getTimezoneOffset() * 60000);   
        const defaultEnd = new Date(now.getTime()); // - nowUtc.getTimezoneOffset() * 60000);    

        charts.forEach((cfg: any) => {
          const tr = cfg?.timeRange ?? {};

          // start_time: relative (now-*) or absolute
          const s = toDateOrNull(tr.start_time, defaultEnd);
          if (s && (!earliest || s < earliest)) earliest = s;

          // end_time: 'now' wins; else take latest absolute
          if (tr.end_time === 'now') {
            endIsNow = true;
          } else {
            const e = toDateOrNull(tr.end_time, defaultEnd);
            if (e && (!latest || e > latest)) latest = e;
          }
        });
 
        if (endIsNow) latest = defaultEnd; 

        const dataTimeRange = {
          start_time: fmt(earliest ?? defaultStart),  // 'YYYY-MM-DD HH:MM:SS'
          end_time:   fmt(latest   ?? defaultEnd),    // never 'now' string
        };

        return {
          unitManagerData: {
            ...prev.unitManagerData,
            [unitId]: { ...unit, dataTimeRange },
          },
        };
      });
    };

    // Retrieve sensor data and update chart data    
    getVoltData = async () => {

      for (const unitIdStr of Object.keys(this.state.unitManagerData)) {
        const unitId = Number(unitIdStr);
        this.updateDataTimeRange(unitId);

        const stateUnit: any = this.state.unitManagerData[unitId];
        const propsUnit = (this.props.units || []).find((u: any) => u?.id === unitId);
        const configId = propsUnit?.configuration?.id ?? propsUnit?.configurationId;
        if (!configId) return;

        this.props.updateConfiguration?.({
          id: configId,
          dataTimeRange: stateUnit?.dataTimeRange ?? {},
        } as any);        
      }

      // this.props.updateConfiguration?.({
      //   id: configId,
      //   dataTimeRange: { start_time: "now-6h", end_time: "now"},   // <-- no "value" wrapper
      // } as any);

      readSensors().then((res) => {

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
                lineChartData: lineChartDataType;
              };

          this.setState(prevState => {
            const unitData = prevState.unitManagerData[unitId] || {
              id: unitId,
              ctrlValues: resSensorData.ctrlValues,
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

      const withTimeRangeEverywhere = (chartConfigs: any) => {
        const tr = {};

        if (Array.isArray(chartConfigs)) {
          return chartConfigs.map(it => ({ ...it, timeRange: it?.timeRange ?? tr }));
        }

        if (chartConfigs && typeof chartConfigs === "object") {
          return Object.fromEntries(
            Object.entries(chartConfigs).map(([k, v]: [string, any]) => [
              k,
              { ...(v ?? {}), timeRange: v?.timeRange ?? tr },
            ])
          );
        }

        // if undefined/null, initialize as empty array (or {} if that's your schema)
        return [];
      };


      if (this.state.startCollect && this.props.units) {
        this.setState({ startCollect: false });
        const newUnitManagerData: UnitsState["unitManagerData"] = {}; 

        for (const unit of this.props.units || []) {
          if (!unit?.id) continue; 

          const u = unit as any;
          const configId = u?.configuration?.id ?? u?.configurationId;
          
          const current = u?.configuration?.chartConfigs;
          const nextChartConfigs = withTimeRangeEverywhere(current);
          
          // Initialize the zone-level range of the data time with the default value {}
          this.props.updateConfiguration?.({
            id: configId,
            dataTimeRange: {},
          } as any);

          // Initialize the chart-level range of the data time with the default value {}
          this.props.updateConfiguration?.({
            id: configId,
            chartConfigs: nextChartConfigs,
          } as any);

          const unitId = unit.id;
          console.log("(unit.configuration as any)?.chartConfigs: ", (unit.configuration as any)?.chartConfigs)
          const defaultChartConfigs = convertChartConfigs((unit.configuration as any)?.chartConfigs);

          console.log("this.props.units: ", this.props.units);

          newUnitManagerData[unitId] = {
            id: unitId,
            building: unit.building,
            system: unit.system,
            dataTimeRange: {},
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

    const campusGroups = (filtered ?? []).reduce((acc: Record<string, Record<string, IUnit[]>>, unit) => {
      const campus = unit.campus || "Unknown";
      const bldg   = unit.building || "Unknown";
      (acc[campus] ??= {});
      (acc[campus][bldg] ??= []).push(unit);
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
                            readOnly={!this.isAdmin() && this.isReadOnlyUser()}
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
              const accessibleBldgs = this.userAccessibleBldgs();
              const bldgCount = (this.isAdmin()) ? Object.keys(campusGroups[campusId]).length : Object.keys(campusGroups[campusId]).filter((bldgName) => accessibleBldgs.includes(bldgName)).length;

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
                      {Object.keys(campusGroups[campusId]).sort()
                      .filter((bldgName) => this.isAdmin() || accessibleBldgs.includes(bldgName))
                      .map((bldgName) => {
                        const unitsInBldg = campusGroups[campusId][bldgName];
                        const isOpen = !!this.state.openBuildings?.[bldgName];
                        const zoneCount = unitsInBldg.length;

                        return (
                          // Building lists
                          <Card key={`bldg-${campusId}-${bldgName}`} interactive style={{ marginBottom: "2rem" }}>
                            <div className="row" style={{ alignItems: "center" }}>
                              <div className="col-md-10" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <Icon icon={IconNames.OFFICE} />
                                <h3 style={{ margin: 0 }}>{bldgName}</h3>
                                {/* Tags counting the number of zones in the building */}
                                <Tag minimal round>{zoneCount} zone{zoneCount !== 1 ? "s" : ""}</Tag>
                              </div>
                              <div className="col-md-2" style={{ textAlign: "right" }}>
                                <Button
                                  minimal
                                  icon={isOpen ? IconNames.CARET_DOWN : IconNames.CARET_RIGHT}
                                  onClick={() =>
                                    this.setState(prev => ({
                                      openBuildings: isOpen ? {} : { [bldgName]: true },
                                    }))
                                  }
                                />
                              </div>
                              
                        {isOpen && (
                          <div style={{ marginTop: "15px" }}>
                            {/* SINGLE wrapper per building */}
                            <div className="col-md-12" key={`bldg-chart-wrap-${bldgName}`}>
                              <h2>Building Monitoring</h2>

                              {/* one set of controls for the building */}
                              <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                                <h3 style={{ margin: 0 }}>Add/Remove a chart:&nbsp;</h3>
                                <div style={{ marginTop: "0%", marginLeft: "1%" }}>
                                  <Tooltip2 content="Add" placement={Position.BOTTOM}>
                                    <Button
                                      icon={IconNames.PLUS}
                                      intent={Intent.PRIMARY}
                                      small
                                      className="custom-button"
                                      onClick={() => this.addBldgChart(bldgName)}
                                    />
                                  </Tooltip2>
                                  <Tooltip2 content="Remove" placement={Position.BOTTOM}>
                                    <Button
                                      icon={IconNames.MINUS}
                                      intent={Intent.PRIMARY}
                                      small
                                      className="custom-button"
                                      onClick={() => this.removeBldgChart(bldgName)}
                                    />
                                  </Tooltip2>
                                </div>
                              </div>

                              {/* 2-column grid of building-level charts */}
                              <div
                                style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}
                              >
                                {(this.state.bldgChartConfigs[bldgName]?.chartConfigs ?? []).map((chart) => {
                                  const chartType = chart.type;
                                  var unitData = this.toBuildingData(this.state.unitManagerData, bldgName);
                                  const lineChartData = unitData?.lineChartData?.[0] ?? { index: 0, time: "", values: {} };
                                  const axisInfo = this.buildAxisInfo(unitData, chart.id, "building");
                                  const buildingName = unitsInBldg[0]?.building!;

                                  return (
                                    <div key={`bldg-${bldgName}-chart-${chart.id}`} style={{ marginBottom: 10 }}>
                                      <div className="select">
                                        {this.renderBldgChartSelect(
                                          buildingName,
                                          chart.id,
                                          `Building-Level Chart ${chart.id + 1 - BLDG_CHART_OFFSET}`,
                                          lineChartData, 
                                          chart.selectedVariables,
                                          (newSelection) => this.handleBldgChartSelect(bldgName, chart.id, newSelection)
                                        )}
                                      </div>
                                      {chartType === "line"
                                        ? this.renderLineChart(unitData, axisInfo, chart.id)
                                        : chartType === "scatter"
                                        ? this.renderScatterPlot(unitData, axisInfo, chart.id)
                                        : chartType === "box"
                                        ? this.renderBoxPlot(unitData, axisInfo, chart.id)
                                        : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

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
                                          {(unit.image === '"https://digipedia.tudelft.nl/app/uploads/2024/06/HBRoomSetup_Image_00.jpg"' || unit.image?.startsWith('https://digipedia.tudelft.nl')) && (
                                            <div className="placeholder-overlay">
                                              <div className="placeholder-text">Image Placeholder<br />{unit.building} {unit.system}</div>
                                            </div>
                                          )}
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
                                                readOnly={!this.isAdmin() && this.isReadOnlyUser()}
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
                                          <Setpoints unit={unit} editing={editing} handleChange={this.handleChange} handleSetpointValueChange={(name: string, value: number | string) => this.handleSetpointValueChange(unit.id!, name, value)} readOnly={!this.isAdmin() && this.isReadOnlyUser()}/> 
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
                                            readOnly={!this.isAdmin() && this.isReadOnlyUser()}                          
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
                                            readOnly={!this.isAdmin() && this.isReadOnlyUser()}
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
                                          <Occupancies unit={unit} editing={editing} handleChange={this.handleChange} readOnly={!this.isAdmin() && this.isReadOnlyUser()} />
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
                                          const unitData = this.state.unitManagerData[unit.id!];
                                          const lineChartData = unitData?.lineChartData?.[0] ?? { index: 0, time: "", values: {} };
                                          const axisInfo = this.buildAxisInfo(unitData, chart.id, "zone");
                                          console.log("zone-level axisInfo: ", axisInfo);

                                          return (
                                            <div key={`${unit.id}-${chart.id}`} style={{ marginBottom: "10px" }}>
                                              <div className="select">
                                                {this.renderZoneChartSelect(
                                                  unit.id!,
                                                  chart.id,
                                                  `Zone-Level Chart ${chart.id + 1}`,
                                                  lineChartData,
                                                  chart.selectedVariables,
                                                  (newSelection) => this.handleZoneChartSelect(unit.id!, chart.id, newSelection)
                                                )}
                                              </div>
                                              {chartType === "line" 
                                                ? this.renderLineChart(unitData, axisInfo, chart.id)
                                                : chartType === "scatter"
                                                ? this.renderScatterPlot(unitData, axisInfo, chart.id)
                                                : chartType === "box"
                                                ? this.renderBoxPlot(unitData, axisInfo, chart.id)
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