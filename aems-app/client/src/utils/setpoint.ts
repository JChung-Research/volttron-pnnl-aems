import { isNumber, sum } from "lodash";

import { ISetpoint } from "controllers/setpoints/action";
import { ValidateType } from "common";
import { DeepPartial } from "./types";

const SETPOINT_PADDING = parseInt(process.env.REACT_APP_SETPOINT_PADDING || "2");
const DEADBAND_MIN = (ValidateType.DeadbandType.options?.min as number) || 2;
const DEADBAND_MAX = (ValidateType.DeadbandType.options?.max as number) || 6;
const DEADBAND_DEFAULT = (ValidateType.DeadbandType.options?.default as number) || 4;
const HEATING_MIN = (ValidateType.HeatingType.options?.min as number) || 55;
const HEATING_DEFAULT = (ValidateType.HeatingType.options?.default as number) || 60;
const COOLING_MAX = (ValidateType.CoolingType.options?.max as number) || 85;
const COOLING_DEFAULT = (ValidateType.CoolingType.options?.default as number) || 80;
const SETPOINT_MIN = HEATING_MIN;
const SETPOINT_MAX = COOLING_MAX;
const SETPOINT_DEFAULT = (ValidateType.SetpointType.options?.default as number) || 70;
const SUPPLYDUCTPRESSURE_MAX = (ValidateType.SupplyDuctPressureType.options?.max as number) || 1;
const SUPPLYDUCTPRESSURE_MIN = (ValidateType.SupplyDuctPressureType.options?.min as number) || 0;
const SUPPLYDUCTPRESSURE_DEFAULT = (ValidateType.SupplyDuctPressureType.options?.default as number) || 0.5;
const COOLINGCOILVALVE_MAX = (ValidateType.CoolingCoilValveType.options?.max as number) || 1;
const COOLINGCOILVALVE_MIN = (ValidateType.CoolingCoilValveType.options?.min as number) || 0;
const COOLINGCOILVALVE_DEFAULT = (ValidateType.CoolingCoilValveType.options?.default as number) || 0.5;
const HEATINGCOILVALVE_MAX = (ValidateType.HeatingCoilValveType.options?.max as number) || 1;
const HEATINGCOILVALVE_MIN = (ValidateType.HeatingCoilValveType.options?.min as number) || 0;
const HEATINGCOILVALVE_DEFAULT = (ValidateType.HeatingCoilValveType.options?.default as number) || 0.5;
const COOLINGCOILPUMP_MAX = (ValidateType.CoolingCoilPumpType.options?.max as number) || 1;
const COOLINGCOILPUMP_MIN = (ValidateType.CoolingCoilPumpType.options?.min as number) || 0;
const COOLINGCOILPUMP_DEFAULT = (ValidateType.CoolingCoilPumpType.options?.default as number) || 0.5;
const HEATINGCOILPUMP_MAX = (ValidateType.HeatingCoilPumpType.options?.max as number) || 1;
const HEATINGCOILPUMP_MIN = (ValidateType.HeatingCoilPumpType.options?.min as number) || 0;
const HEATINGCOILPUMP_DEFAULT = (ValidateType.HeatingCoilPumpType.options?.default as number) || 0.5;
const SUPPLYFANSPEED_MAX = (ValidateType.SupplyFanSpeedType.options?.max as number) || 1;
const SUPPLYFANSPEED_MIN = (ValidateType.SupplyFanSpeedType.options?.min as number) || 0;
const SUPPLYFANSPEED_DEFAULT = (ValidateType.SupplyFanSpeedType.options?.default as number) || 0.5;
const SUPPLYAIRSETPOINT_MAX = COOLING_MAX;
const SUPPLYAIRSETPOINT_MIN = HEATING_MIN;
const SUPPLYAIRSETPOINT_DEFAULT = (ValidateType.SupplyAirSetpointType.options?.default as number) || 70;
const SUPPLYHEATERSETPOINT_MAX = COOLING_MAX;
const SUPPLYHEATERSETPOINT_MIN = HEATING_MIN;
const SUPPLYHEATERSETPOINT_DEFAULT = (ValidateType.SupplyHeaterSetpointType.options?.default as number) || 70;
const OUTSIDEAIRDAMPERPOSITION_MAX = (ValidateType.OutsideAirDamperPositionType.options?.max as number) || 1;
const OUTSIDEAIRDAMPERPOSITION_MIN = (ValidateType.OutsideAirDamperPositionType.options?.min as number) || 0;
const OUTSIDEAIRDAMPERPOSITION_DEFAULT = (ValidateType.OutsideAirDamperPositionType.options?.default as number) || 0.5;
const RETURNAIRDAMPERPOSITION_MAX = (ValidateType.ReturnAirDamperPositionType.options?.max as number) || 1;
const RETURNAIRDAMPERPOSITION_MIN = (ValidateType.ReturnAirDamperPositionType.options?.min as number) || 0;
const RETURNAIRDAMPERPOSITION_DEFAULT = (ValidateType.ReturnAirDamperPositionType.options?.default as number) || 0.5;
const ZONEDAMPERPOSITION_MAX = (ValidateType.ZoneDamperPositionType.options?.max as number) || 1;
const ZONEDAMPERPOSITION_MIN = (ValidateType.ZoneDamperPositionType.options?.min as number) || 0;
const ZONEDAMPERPOSITION_DEFAULT = (ValidateType.ZoneDamperPositionType.options?.default as number) || 0.5;
const ZONEREHEATCONTROL_MAX = (ValidateType.ZoneReheatControlType.options?.max as number) || 1;
const ZONEREHEATCONTROL_MIN = (ValidateType.ZoneReheatControlType.options?.min as number) || 0;
const ZONEREHEATCONTROL_DEFAULT = (ValidateType.ZoneReheatControlType.options?.default as number) || 0.5;
const ZONEAIRCOOLINGSETPOINT_MAX = (ValidateType.ZoneAirCoolingSetpointType.options?.max as number) || 85;
const ZONEAIRCOOLINGSETPOINT_DEFAULT = (ValidateType.ZoneAirCoolingSetpointType.options?.default as number) || 80;
const ZONEAIRHEATINGSETPOINT_MIN = (ValidateType.ZoneAirHeatingSetpointType.options?.min as number) || 55;
const ZONEAIRHEATINGSETPOINT_DEFAULT = (ValidateType.ZoneAirHeatingSetpointType.options?.default as number) || 60;
const ZONEOPERATIVECOOLINGSETPOINT_MAX = (ValidateType.ZoneOperativeCoolingSetpointType.options?.max as number) || 85;
const ZONEOPERATIVECOOLINGSETPOINT_DEFAULT = (ValidateType.ZoneOperativeCoolingSetpointType.options?.default as number) || 80;
const ZONEOPERATIVEHEATINGSETPOINT_MIN = (ValidateType.ZoneOperativeHeatingSetpointType.options?.min as number) || 55;
const ZONEOPERATIVEHEATINGSETPOINT_DEFAULT = (ValidateType.ZoneOperativeHeatingSetpointType.options?.default as number) || 60;
const CONTROLSTAGEPUMP_MAX = (ValidateType.ControlStagePumpType.options?.max as number) || 1;
const CONTROLSTAGEPUMP_MIN = (ValidateType.ControlStagePumpType.options?.min as number) || 0;
const CONTROLSTAGEPUMP_DEFAULT = (ValidateType.ControlStagePumpType.options?.default as number) || 1;
const HVACMODE_DEFAULT = (ValidateType.HVACMode.options?.default as string) || "auto";

type Required = "setpoint" | "deadband" | "heating" | "cooling" | "supplyDuctPressure" | "coolingCoilValve" | "heatingCoilValve" | "coolingCoilPump" | "heatingCoilPump" | "supplyFanSpeed" | "supplyAirSetpoint" | "supplyHeaterSetpoint" | "outsideAirDamperPosition" | "returnAirDamperPosition" | "zoneDamperPosition" | "zoneReheatControl" | "zoneAirCoolingSetpoint" | "zoneAirHeatingSetpoint" | "zoneOperativeCoolingSetpoint" | "zoneOperativeHeatingSetpoint" | "controlStagePump" | "hvacMode" ;

const createSetpointLabel = (
  type: "all" | Required,
  setpoint: DeepPartial<ISetpoint> & Pick<ISetpoint, Required>
): string => {
  switch (type) {
    case "all":
      return `Occupied Setpoint: ${createSetpointLabel("setpoint", setpoint)} Deadband: ${createSetpointLabel(
        "deadband",
        setpoint
      )} Unoccupied Heating: ${createSetpointLabel("heating", setpoint)} Cooling: ${createSetpointLabel(
        "cooling",
        setpoint
      )}`;
    case "setpoint":
    case "deadband":
    case "heating":
    case "cooling":
    case "supplyDuctPressure":
    case "coolingCoilValve":
    case "heatingCoilValve":
    case "coolingCoilPump":
    case "heatingCoilPump":
    case "supplyFanSpeed":
    case "supplyAirSetpoint":
    case "supplyHeaterSetpoint":
    case "outsideAirDamperPosition":
    case "returnAirDamperPosition":
    case "zoneDamperPosition":
    case "zoneReheatControl":
    case "zoneAirCoolingSetpoint":
    case "zoneAirHeatingSetpoint":
    case "zoneOperativeCoolingSetpoint":
    case "zoneOperativeHeatingSetpoint":
    case "controlStagePump":
    case "hvacMode":
    default:
      return `${setpoint[type]}º\xa0F`;
  }
};

const getSetpointMessage = (setpoint: DeepPartial<ISetpoint> & Pick<ISetpoint, Required>): string | undefined => {
  if (setpoint.deadband < DEADBAND_MIN || setpoint.deadband > DEADBAND_MAX) {
    return `Deadband must be in the range [${DEADBAND_MIN},${DEADBAND_MAX}].`;
  } else if (
    setpoint.setpoint < setpoint.heating + SETPOINT_PADDING + setpoint.deadband / 2 ||
    setpoint.setpoint > setpoint.cooling - SETPOINT_PADDING - setpoint.deadband / 2
  ) {
    return `Occupied setpoint must be in the range [${setpoint.heating + SETPOINT_PADDING + setpoint.deadband / 2},${
      setpoint.cooling - SETPOINT_PADDING - setpoint.deadband / 2
    }]`;
  } else if (setpoint.heating < HEATING_MIN || setpoint.cooling > COOLING_MAX) {
    return `Unoccupied heating and cooling must be in the range [${HEATING_MIN},${COOLING_MAX}]`;
  } else if (setpoint.setpoint % 0.5 !== 0) {
    return "Occupied setpoint must be a whole or half degree.";
  } else if (setpoint.deadband % 1 !== 0) {
    return "Deadband must be a whole degree.";
  } else if (setpoint.heating % 0.5 !== 0 || setpoint.cooling % 0.5 !== 0) {
    return "Unoccupied heating or cooling must be a whole or half degree.";
  } else if (setpoint.heating % 0.5 !== 0 || setpoint.cooling % 0.5 !== 0) {
    return "Unoccupied heating or cooling must be a whole or half degree.";
  }
};

const isSetpointValid = (setpoint: DeepPartial<ISetpoint> | undefined): boolean => {
  if (
    !setpoint ||
    !isNumber(setpoint.setpoint) ||
    !isNumber(setpoint.deadband) ||
    !isNumber(setpoint.heating) ||
    !isNumber(setpoint.cooling)
  ) {
    return false;
  }
  return getSetpointMessage(setpoint as DeepPartial<ISetpoint> & Pick<ISetpoint, Required>) === undefined;
};

const isSetpointDelete = (setpoint: DeepPartial<ISetpoint>) => {
  return sum(Object.values(setpoint?._count || {})) === 0;
};

export {
  SETPOINT_PADDING,
  DEADBAND_MIN,
  DEADBAND_MAX,
  DEADBAND_DEFAULT,
  HEATING_MIN,
  HEATING_DEFAULT,
  COOLING_MAX,
  COOLING_DEFAULT,
  SETPOINT_MIN,
  SETPOINT_MAX,
  SETPOINT_DEFAULT,
  SUPPLYDUCTPRESSURE_MAX,
  SUPPLYDUCTPRESSURE_MIN,
  SUPPLYDUCTPRESSURE_DEFAULT,
  COOLINGCOILVALVE_MAX,
  COOLINGCOILVALVE_MIN,
  COOLINGCOILVALVE_DEFAULT,
  HEATINGCOILVALVE_MAX,
  HEATINGCOILVALVE_MIN,
  HEATINGCOILVALVE_DEFAULT,
  COOLINGCOILPUMP_MAX,
  COOLINGCOILPUMP_MIN,
  COOLINGCOILPUMP_DEFAULT,
  HEATINGCOILPUMP_MAX,
  HEATINGCOILPUMP_MIN,
  HEATINGCOILPUMP_DEFAULT,
  SUPPLYFANSPEED_MAX,
  SUPPLYFANSPEED_MIN,
  SUPPLYFANSPEED_DEFAULT,
  SUPPLYAIRSETPOINT_MAX,
  SUPPLYAIRSETPOINT_MIN,
  SUPPLYAIRSETPOINT_DEFAULT,
  SUPPLYHEATERSETPOINT_MAX,
  SUPPLYHEATERSETPOINT_MIN,
  SUPPLYHEATERSETPOINT_DEFAULT,
  OUTSIDEAIRDAMPERPOSITION_MAX,
  OUTSIDEAIRDAMPERPOSITION_MIN,
  OUTSIDEAIRDAMPERPOSITION_DEFAULT,
  RETURNAIRDAMPERPOSITION_MAX,
  RETURNAIRDAMPERPOSITION_MIN,
  RETURNAIRDAMPERPOSITION_DEFAULT,
  ZONEDAMPERPOSITION_MAX,
  ZONEDAMPERPOSITION_MIN,
  ZONEDAMPERPOSITION_DEFAULT,
  ZONEREHEATCONTROL_MAX,
  ZONEREHEATCONTROL_MIN,
  ZONEREHEATCONTROL_DEFAULT,
  ZONEAIRCOOLINGSETPOINT_MAX,
  ZONEAIRCOOLINGSETPOINT_DEFAULT,
  ZONEAIRHEATINGSETPOINT_MIN,
  ZONEAIRHEATINGSETPOINT_DEFAULT,
  ZONEOPERATIVECOOLINGSETPOINT_MAX,
  ZONEOPERATIVECOOLINGSETPOINT_DEFAULT,
  ZONEOPERATIVEHEATINGSETPOINT_MIN,
  ZONEOPERATIVEHEATINGSETPOINT_DEFAULT,
  CONTROLSTAGEPUMP_MAX,
  CONTROLSTAGEPUMP_MIN,
  CONTROLSTAGEPUMP_DEFAULT,
  HVACMODE_DEFAULT,
  createSetpointLabel,
  getSetpointMessage,
  isSetpointValid,
  isSetpointDelete,
};