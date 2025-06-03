import {
  COOLING_MAX,
  DEADBAND_MAX,
  DEADBAND_MIN,
  HEATING_MIN,
  SETPOINT_MAX,
  SETPOINT_MIN,
  SETPOINT_PADDING,
  SUPPLYDUCTPRESSURE_MAX,
  SUPPLYDUCTPRESSURE_MIN,
  COOLINGCOILVALVE_MAX,
  COOLINGCOILVALVE_MIN,
  HEATINGCOILVALVE_MAX,
  HEATINGCOILVALVE_MIN,
  COOLINGCOILPUMP_MAX,
  COOLINGCOILPUMP_MIN,
  HEATINGCOILPUMP_MAX,
  HEATINGCOILPUMP_MIN,
  SUPPLYFANSPEED_MAX,
  SUPPLYFANSPEED_MIN,
  SUPPLYAIRSETPOINT_MAX,
  SUPPLYAIRSETPOINT_MIN,
  SUPPLYHEATERSETPOINT_MAX,
  SUPPLYHEATERSETPOINT_MIN,
  OUTSIDEAIRDAMPERPOSITION_MAX,
  OUTSIDEAIRDAMPERPOSITION_MIN,
  RETURNAIRDAMPERPOSITION_MAX,
  RETURNAIRDAMPERPOSITION_MIN,
  ZONEDAMPERPOSITION_MAX,
  ZONEDAMPERPOSITION_MIN,
  ZONEREHEATCONTROL_MAX,
  ZONEREHEATCONTROL_MIN,
  ZONEAIRCOOLINGSETPOINT_MAX,
  ZONEAIRHEATINGSETPOINT_MIN,
  ZONEOPERATIVECOOLINGSETPOINT_MAX,
  ZONEOPERATIVEHEATINGSETPOINT_MIN,
  CONTROLSTAGEPUMP_MAX,
  CONTROLSTAGEPUMP_MIN,
  createSetpointLabel,
  getSetpointMessage,
} from "utils/setpoint";
import {
  HandleInteractionKind,
  HandleType,
  InputGroup,
  Intent,
  Label,
  MultiSlider,
  NumericInput,
} from "@blueprintjs/core";
import { clamp, get, merge } from "lodash";
import { useCallback, useMemo, useEffect } from "react";

import { ISetpoint } from "controllers/setpoints/action";
import { IUnit } from "controllers/units/action";
import { DeepPartial } from "../../utils/types";

export function Setpoint(props: {
  type: "single" | "separate" | "both";
  title: string;
  path: string;
  unit: DeepPartial<IUnit> | IUnit;
  editing: DeepPartial<IUnit> | null;
  setpoint: DeepPartial<ISetpoint> | undefined;
  handleChange: (field: string, unit?: DeepPartial<IUnit> | null) => (value: any) => void;
  readOnly?: Array<"title">;
  handleSetpointValueChange?: (key: string, value: number) => void;
}) {
  const { type, title, path, unit, editing, setpoint, handleChange, handleSetpointValueChange, readOnly = ["title"] } = props;

  const getValue = useCallback((field: string) => get(editing, field, get(unit, field)), [editing, unit]);

  const error = useMemo(
    () => getSetpointMessage(merge({}, get(unit, path), setpoint)) || "\u00A0",
    [path, unit, setpoint]
  );

  const isDefined = (key: string) => getValue(`${path}.${key}`) !== -1;

  useEffect(() => {
    const keys = [
      "setpoint",
      "heating",
      "cooling",
      "supplyDuctPressure",
      "coolingCoilValve",
      "heatingCoilValve",
      "coolingCoilPump",
      "heatingCoilPump",
      "supplyFanSpeed",
      "supplyAirSetpoint",
      "supplyHeaterSetpoint",
      "outsideAirDamperPosition",
      "returnAirDamperPosition",
      "zoneDamperPosition",
      "zoneReheatControl",
      "zoneAirCoolingSetpoint",
      "zoneAirHeatingSetpoint",
      "zoneOperativeCoolingSetpoint",
      "zoneOperativeHeatingSetpoint",
      "controlStagePump",
    ];

    keys.forEach((key) => {
      if (isDefined(key)) {
        const value = getValue(`${path}.${key}`);
        handleSetpointValueChange?.(key, value);
      }
    });
  }, [editing, unit, path]);
  
  const renderSingle = () => (
    <MultiSlider
      min={SETPOINT_MIN}
      max={SETPOINT_MAX}
      stepSize={0.5}
      labelStepSize={5}
      labelRenderer={(v, o) => (o?.isHandleTooltip || (v > HEATING_MIN && v < COOLING_MAX) ? `${v}º\xa0F` : "")}
    >
      <MultiSlider.Handle
        type={HandleType.START}
        interactionKind={HandleInteractionKind.LOCK}
        intentAfter={Intent.WARNING}
        value={getValue(`${path}.heating`)}
        onChange={(v) => {
          const setpoint = getValue(`${path}.setpoint`);
          const deadband = getValue(`${path}.deadband`);
          const padding = SETPOINT_PADDING + deadband / 2;
          const heating = clamp(v, HEATING_MIN, COOLING_MAX);
          const cooling = getValue(`${path}.cooling`);
          const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
          const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
          const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
          const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
          const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
          const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);          
          const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
          const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
          const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
          const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
          const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
          const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
          const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
          const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
          const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
          const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
          const controlStagePump = getValue(`${path}.controlStagePump`);

          const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
          handleChange(`${path}`, editing)({ heating, label });
        }}
      />
      <MultiSlider.Handle
        type={HandleType.START}
        interactionKind={HandleInteractionKind.LOCK}
        intentAfter={Intent.NONE}
        value={getValue(`${path}.setpoint`) - getValue(`${path}.deadband`) / 2}
        onChange={(v) => {
          const deadband = getValue(`${path}.deadband`);
          const padding = SETPOINT_PADDING + deadband / 2;
          const heating = getValue(`${path}.heating`);
          const cooling = getValue(`${path}.cooling`);
          const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
          const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
          const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
          const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
          const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
          const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
          const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
          const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
          const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
          const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
          const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
          const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
          const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
          const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
          const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
          const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
          const controlStagePump = getValue(`${path}.controlStagePump`);
          const value = v + deadband / 2;
          const setpoint = clamp(value, heating + padding, cooling - padding);
          const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
          handleChange(`${path}`, editing)({ setpoint, label });
        }}
      />
      <MultiSlider.Handle
        type={HandleType.END}
        interactionKind={HandleInteractionKind.LOCK}
        intentBefore={Intent.NONE}
        value={getValue(`${path}.setpoint`) + getValue(`${path}.deadband`) / 2}
        onChange={(v) => {
          const deadband = getValue(`${path}.deadband`);
          const padding = SETPOINT_PADDING + deadband / 2;
          const heating = getValue(`${path}.heating`);
          const cooling = getValue(`${path}.cooling`);
          const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
          const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
          const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
          const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
          const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
          const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
          const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
          const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
          const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
          const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
          const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
          const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
          const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
          const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
          const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
          const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
          const controlStagePump = getValue(`${path}.controlStagePump`);
          const value = v - deadband / 2;
          const setpoint = clamp(value, heating + padding, cooling - padding);
          const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
          handleChange(`${path}`, editing)({ setpoint, label });
        }}
      />
      <MultiSlider.Handle
        type={HandleType.END}
        interactionKind={HandleInteractionKind.LOCK}
        intentBefore={Intent.PRIMARY}
        value={getValue(`${path}.cooling`)}
        onChange={(v) => {
          const setpoint = getValue(`${path}.setpoint`);
          const deadband = getValue(`${path}.deadband`);
          const padding = SETPOINT_PADDING + deadband / 2;
          const heating = getValue(`${path}.heating`);
          const cooling = clamp(v, HEATING_MIN, COOLING_MAX);
          const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
          const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
          const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
          const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
          const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
          const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
          const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
          const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
          const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
          const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
          const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
          const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
          const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
          const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
          const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
          const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
          const controlStagePump = getValue(`${path}.controlStagePump`);
          const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
          handleChange(`${path}`, editing)({ cooling, label });
        }}
      />
    </MultiSlider>
  );

  const renderOccupied = () => (
    <Label>
      <b>Occupied</b>
      <MultiSlider
        min={SETPOINT_MIN}
        max={SETPOINT_MAX}
        stepSize={0.5}
        labelStepSize={5}
        intent={Intent.SUCCESS}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > HEATING_MIN && v < COOLING_MAX) ? `${v}º\xa0F` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.START}
          interactionKind={HandleInteractionKind.LOCK}
          intentBefore={Intent.WARNING}
          intentAfter={Intent.SUCCESS}
          value={getValue(`${path}.setpoint`) - getValue(`${path}.deadband`) / 2}
          onChange={(v) => {
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);
            const value = v + deadband / 2;
            const setpoint = clamp(value, heating + padding, cooling - padding);
            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ setpoint, label });
          }}
        />
        <MultiSlider.Handle
          type={HandleType.END}
          interactionKind={HandleInteractionKind.LOCK}
          intentBefore={Intent.SUCCESS}
          intentAfter={Intent.PRIMARY}
          value={getValue(`${path}.setpoint`) + getValue(`${path}.deadband`) / 2}
          onChange={(v) => {
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);
            const value = v - deadband / 2;
            const setpoint = clamp(value, heating + padding, cooling - padding);
            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ setpoint, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderUnoccupied = () => (
    <Label>
      <b>Unoccupied</b>
      <MultiSlider
        min={SETPOINT_MIN}
        max={SETPOINT_MAX}
        stepSize={0.5}
        labelStepSize={5}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > HEATING_MIN && v < COOLING_MAX) ? `${v}º\xa0F` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.START}
          interactionKind={HandleInteractionKind.LOCK}
          intentBefore={Intent.WARNING}
          value={getValue(`${path}.heating`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = clamp(v, HEATING_MIN, COOLING_MAX);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ heating, label });
          }}
        />
        <MultiSlider.Handle
          type={HandleType.END}
          interactionKind={HandleInteractionKind.LOCK}
          intentAfter={Intent.PRIMARY}
          value={getValue(`${path}.cooling`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = getValue(`${path}.heating`);
            const cooling = clamp(v, HEATING_MIN, COOLING_MAX);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ cooling, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderSetpoint = () => (
    <Label>
      <b>Supply Air Temperature Setpoint</b>
      <MultiSlider
        min={SETPOINT_MIN}
        max={SETPOINT_MAX}
        stepSize={0.5}
        labelStepSize={5}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > HEATING_MIN && v < COOLING_MAX) ? `${v}º\xa0F` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.START}
          interactionKind={HandleInteractionKind.LOCK}
          intentBefore={Intent.WARNING}
          intentAfter={Intent.SUCCESS}
          value={getValue(`${path}.heating`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = clamp(v, HEATING_MIN, COOLING_MAX);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("heating", heating);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ heating, label });
          }}
        />
        <MultiSlider.Handle
          type={HandleType.END}
          interactionKind={HandleInteractionKind.LOCK}
          intentBefore={Intent.SUCCESS}
          intentAfter={Intent.PRIMARY}
          value={getValue(`${path}.cooling`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = getValue(`${path}.heating`);
            const cooling = clamp(v, HEATING_MIN, COOLING_MAX);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("cooling", cooling);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ cooling, label });
          }}
        />
      </MultiSlider>
    </Label>
  );


  const renderSupplyDuctPressure = () => (
    <Label>
      <b>Supply Duct Pressure</b>
      <MultiSlider
        min={SUPPLYDUCTPRESSURE_MIN}
        max={SUPPLYDUCTPRESSURE_MAX}
        stepSize={30}
        labelStepSize={60}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > SUPPLYDUCTPRESSURE_MIN && v < SUPPLYDUCTPRESSURE_MAX) ? `${v}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.supplyDuctPressure`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = parseFloat(
              (Math.round(clamp(v, SUPPLYDUCTPRESSURE_MIN, SUPPLYDUCTPRESSURE_MAX) * 10) / 10).toFixed(1)
            );            
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("supplyDuctPressure", supplyDuctPressure);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ supplyDuctPressure, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderCoolingCoilValve = () => (
    <Label>
      <b>Cooling Coil Valve</b>
      <MultiSlider
        min={COOLINGCOILVALVE_MIN}
        max={COOLINGCOILVALVE_MAX}
        stepSize={0.1}
        labelStepSize={0.2}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > COOLINGCOILVALVE_MIN && v < COOLINGCOILVALVE_MAX) ? `${v.toFixed(1)}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.coolingCoilValve`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);          
            const coolingCoilValve = parseFloat(
              (Math.round(clamp(v, COOLINGCOILVALVE_MIN, COOLINGCOILVALVE_MAX) * 10) / 10).toFixed(1)
            );       
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("coolingCoilValve", coolingCoilValve);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ coolingCoilValve, label });
          }}
        />
      </MultiSlider>
    </Label>
  );
  const renderHeatingCoilValve = () => (
    <Label>
      <b>Heating Coil Valve</b>
      <MultiSlider
        min={HEATINGCOILVALVE_MIN}
        max={HEATINGCOILVALVE_MAX}
        stepSize={0.1}
        labelStepSize={0.2}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > HEATINGCOILVALVE_MIN && v < HEATINGCOILVALVE_MAX) ? `${v.toFixed(1)}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.heatingCoilValve`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);      
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = parseFloat(
              (Math.round(clamp(v, HEATINGCOILVALVE_MIN, HEATINGCOILVALVE_MAX) * 10) / 10).toFixed(1)
            );            
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("heatingCoilValve", heatingCoilValve);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ heatingCoilValve, label });
          }}
        />
      </MultiSlider>
    </Label>
  );
  const renderCoolingCoilPump = () => (
    <Label>
      <b>Cooling Coil Pump</b>
      <MultiSlider
        min={COOLINGCOILPUMP_MIN}
        max={COOLINGCOILPUMP_MAX}
        stepSize={0.1}
        labelStepSize={0.2}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > COOLINGCOILPUMP_MIN && v < COOLINGCOILPUMP_MAX) ? `${v.toFixed(1)}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.coolingCoilPump`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = parseFloat(
              (Math.round(clamp(v, COOLINGCOILPUMP_MIN, COOLINGCOILPUMP_MAX) * 10) / 10).toFixed(1)
            );     
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("coolingCoilPump", coolingCoilPump);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ coolingCoilPump, label });
          }}
        />
      </MultiSlider>
    </Label>
  );
  const renderHeatingCoilPump = () => (
    <Label>
      <b>Heating Coil Pump</b>
      <MultiSlider
        min={HEATINGCOILPUMP_MIN}
        max={HEATINGCOILPUMP_MAX}
        stepSize={0.1}
        labelStepSize={0.2}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > HEATINGCOILPUMP_MIN && v < HEATINGCOILPUMP_MAX) ? `${v.toFixed(1)}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.heatingCoilPump`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);            
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = parseFloat(
              (Math.round(clamp(v, HEATINGCOILPUMP_MIN, HEATINGCOILPUMP_MAX) * 10) / 10).toFixed(1)
            );
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("heatingCoilPump", heatingCoilPump);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ heatingCoilPump, label });
          }}
        />
      </MultiSlider>
    </Label>
  );
  const renderSupplyFanSpeed = () => (
    <Label>
      <b>Fan Control Signal as Air Mass Flow Rate</b>
      <MultiSlider
        min={SUPPLYFANSPEED_MIN}
        max={SUPPLYFANSPEED_MAX}
        stepSize={0.1}
        labelStepSize={0.2}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > SUPPLYFANSPEED_MIN && v < SUPPLYFANSPEED_MAX) ? `${v.toFixed(1)}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.supplyFanSpeed`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = parseFloat(
              (Math.round(clamp(v, SUPPLYFANSPEED_MIN, SUPPLYFANSPEED_MAX) * 10) / 10).toFixed(1)
            );
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("supplyFanSpeed", supplyFanSpeed);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ supplyFanSpeed, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderSupplyAirSetpoint = () => (
    <Label>
      <b>Supply Air Setpoint</b>
      <MultiSlider
        min={SUPPLYAIRSETPOINT_MIN}
        max={SUPPLYAIRSETPOINT_MAX}
        stepSize={0.5}
        labelStepSize={5}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > SUPPLYAIRSETPOINT_MIN && v < SUPPLYAIRSETPOINT_MAX) ? `${v}º\xa0F` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.supplyAirSetpoint`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = parseFloat(
              (Math.round(clamp(v, SUPPLYAIRSETPOINT_MIN, SUPPLYAIRSETPOINT_MAX) * 10) / 10).toFixed(1)
            );
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("supplyAirSetpoint", supplyAirSetpoint);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ supplyAirSetpoint, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderSupplyHeaterSetpoint = () => (
    <Label>
      <b>Supply Temperature Setpoint of the Heater</b>
      <MultiSlider
        min={SUPPLYHEATERSETPOINT_MIN}
        max={SUPPLYHEATERSETPOINT_MAX}
        stepSize={0.5}
        labelStepSize={5}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > SUPPLYHEATERSETPOINT_MIN && v < SUPPLYHEATERSETPOINT_MAX) ? `${v}º\xa0F` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.supplyHeaterSetpoint`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = parseFloat(
              (Math.round(clamp(v, SUPPLYHEATERSETPOINT_MIN, SUPPLYHEATERSETPOINT_MAX) * 10) / 10).toFixed(1)
            );
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("supplyHeaterSetpoint", supplyHeaterSetpoint);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ supplyHeaterSetpoint, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderOutsideAirDamperPosition = () => (
    <Label>
      <b>Outside Air Damper Position</b>
      <MultiSlider
        min={OUTSIDEAIRDAMPERPOSITION_MIN}
        max={OUTSIDEAIRDAMPERPOSITION_MAX}
        stepSize={0.1}
        labelStepSize={0.2}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > OUTSIDEAIRDAMPERPOSITION_MIN && v < OUTSIDEAIRDAMPERPOSITION_MAX) ? `${v.toFixed(1)}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.outsideAirDamperPosition`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = parseFloat(
              (Math.round(clamp(v, OUTSIDEAIRDAMPERPOSITION_MIN, OUTSIDEAIRDAMPERPOSITION_MAX) * 10) / 10).toFixed(1)
            );
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("outsideAirDamperPosition", outsideAirDamperPosition);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ outsideAirDamperPosition, label });
          }}
        />
      </MultiSlider>
    </Label>
  );
  
  const renderReturnAirDamperPosition = () => (
    <Label>
      <b>Return Air Damper Position</b>
      <MultiSlider
        min={RETURNAIRDAMPERPOSITION_MIN}
        max={RETURNAIRDAMPERPOSITION_MAX}
        stepSize={0.1}
        labelStepSize={0.2}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > RETURNAIRDAMPERPOSITION_MIN && v < RETURNAIRDAMPERPOSITION_MAX) ? `${v.toFixed(1)}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.returnAirDamperPosition`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = parseFloat(
              (Math.round(clamp(v, RETURNAIRDAMPERPOSITION_MIN, RETURNAIRDAMPERPOSITION_MAX) * 10) / 10).toFixed(1)
            );
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("returnAirDamperPosition", returnAirDamperPosition);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ returnAirDamperPosition, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderZoneDamperPosition = () => (
    <Label>
      <b>Zone Damper Position</b>
      <MultiSlider
        min={ZONEDAMPERPOSITION_MIN}
        max={ZONEDAMPERPOSITION_MAX}
        stepSize={0.1}
        labelStepSize={0.2}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > ZONEDAMPERPOSITION_MIN && v < ZONEDAMPERPOSITION_MAX) ? `${v.toFixed(1)}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.zoneDamperPosition`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = parseFloat(
              (Math.round(clamp(v, ZONEDAMPERPOSITION_MIN, ZONEDAMPERPOSITION_MAX) * 10) / 10).toFixed(1)
            );
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("zoneDamperPosition", zoneDamperPosition);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ zoneDamperPosition, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderZoneReheatControl = () => (
    <Label>
      <b>Zone Reheat Control</b>
      <MultiSlider
        min={ZONEREHEATCONTROL_MIN}
        max={ZONEREHEATCONTROL_MAX}
        stepSize={0.1}
        labelStepSize={0.2}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > ZONEREHEATCONTROL_MIN && v < ZONEREHEATCONTROL_MAX) ? `${v.toFixed(1)}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.zoneReheatControl`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = parseFloat(
              (Math.round(clamp(v, ZONEREHEATCONTROL_MIN, ZONEREHEATCONTROL_MAX) * 10) / 10).toFixed(1)
            );
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("zoneReheatControl", zoneReheatControl);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ zoneReheatControl, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderZoneAirTempSetpoint = () => (
    <Label>
      <b>Zone Air Temperature Setpoint</b>
      <MultiSlider
        min={SETPOINT_MIN}
        max={SETPOINT_MAX}
        stepSize={0.5}
        labelStepSize={5}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > HEATING_MIN && v < COOLING_MAX) ? `${v}º\xa0F` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.START}
          interactionKind={HandleInteractionKind.LOCK}
          intentBefore={Intent.WARNING}
          intentAfter={Intent.SUCCESS}
          value={getValue(`${path}.zoneAirHeatingSetpoint`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = parseFloat(
              (Math.round(clamp(v, HEATING_MIN, COOLING_MAX) * 10) / 10).toFixed(1)
            );
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("zoneAirHeatingSetpoint", zoneAirHeatingSetpoint);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ zoneAirHeatingSetpoint, label });
          }}
        />
      <MultiSlider.Handle
          type={HandleType.END}
          interactionKind={HandleInteractionKind.LOCK}
          intentBefore={Intent.SUCCESS}
          intentAfter={Intent.PRIMARY}
          value={getValue(`${path}.zoneAirCoolingSetpoint`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = parseFloat(
              (Math.round(clamp(v, HEATING_MIN, COOLING_MAX) * 10) / 10).toFixed(1)
            );
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("zoneAirCoolingSetpoint", zoneAirCoolingSetpoint);
            
            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ zoneAirCoolingSetpoint, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderZoneOperativeTempSetpoint = () => (
    <Label>
      <b>Zone Operative Temperature Setpoint</b>
      <MultiSlider
        min={SETPOINT_MIN}
        max={SETPOINT_MAX}
        stepSize={0.5}
        labelStepSize={5}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > HEATING_MIN && v < COOLING_MAX) ? `${v}º\xa0F` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.START}
          interactionKind={HandleInteractionKind.LOCK}
          intentBefore={Intent.WARNING}
          intentAfter={Intent.SUCCESS}
          value={getValue(`${path}.zoneOperativeHeatingSetpoint`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = parseFloat(
              (Math.round(clamp(v, HEATING_MIN, COOLING_MAX) * 10) / 10).toFixed(1)
            );
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("zoneOperativeHeatingSetpoint", zoneOperativeHeatingSetpoint);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ zoneOperativeHeatingSetpoint, label });
          }}
        />
      <MultiSlider.Handle
          type={HandleType.END}
          interactionKind={HandleInteractionKind.LOCK}
          intentBefore={Intent.SUCCESS}
          intentAfter={Intent.PRIMARY}
          value={getValue(`${path}.zoneOperativeCoolingSetpoint`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);              
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = parseFloat(
              (Math.round(clamp(v, HEATING_MIN, COOLING_MAX) * 10) / 10).toFixed(1)
            );
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = getValue(`${path}.controlStagePump`);

            props.handleSetpointValueChange?.("zoneOperativeCoolingSetpoint", zoneOperativeCoolingSetpoint);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ zoneOperativeCoolingSetpoint, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderControlStagePump = () => (
    <Label>
      <b>Control Signal for the Stage of the Pump</b>
      <MultiSlider
        min={CONTROLSTAGEPUMP_MIN}
        max={CONTROLSTAGEPUMP_MAX}
        stepSize={1}
        labelStepSize={1}
        labelRenderer={(v, o) => (o?.isHandleTooltip || (v > CONTROLSTAGEPUMP_MIN && v < CONTROLSTAGEPUMP_MAX) ? `${v.toFixed(1)}` : "")}
      >
        <MultiSlider.Handle
          type={HandleType.FULL}
          interactionKind={HandleInteractionKind.LOCK}
          value={getValue(`${path}.controlStagePump`)}
          onChange={(v) => {
            const setpoint = getValue(`${path}.setpoint`);
            const deadband = getValue(`${path}.deadband`);
            const padding = SETPOINT_PADDING + deadband / 2;
            const heating = getValue(`${path}.heating`);
            const cooling = getValue(`${path}.cooling`);
            const supplyDuctPressure = getValue(`${path}.supplyDuctPressure`);
            const coolingCoilValve = getValue(`${path}.coolingCoilValve`);
            const heatingCoilValve = getValue(`${path}.heatingCoilValve`);
            const coolingCoilPump = getValue(`${path}.coolingCoilPump`);
            const heatingCoilPump = getValue(`${path}.heatingCoilPump`);
            const supplyFanSpeed = getValue(`${path}.supplyFanSpeed`);          
            const supplyAirSetpoint = getValue(`${path}.supplyAirSetpoint`);
            const supplyHeaterSetpoint = getValue(`${path}.supplyHeaterSetpoint`);
            const outsideAirDamperPosition = getValue(`${path}.outsideAirDamperPosition`);
            const returnAirDamperPosition = getValue(`${path}.returnAirDamperPosition`);
            const zoneDamperPosition = getValue(`${path}.zoneDamperPosition`);
            const zoneReheatControl = getValue(`${path}.zoneReheatControl`);
            const zoneAirCoolingSetpoint = getValue(`${path}.zoneAirCoolingSetpoint`);
            const zoneAirHeatingSetpoint = getValue(`${path}.zoneAirHeatingSetpoint`);
            const zoneOperativeCoolingSetpoint = getValue(`${path}.zoneOperativeCoolingSetpoint`);
            const zoneOperativeHeatingSetpoint = getValue(`${path}.zoneOperativeHeatingSetpoint`);
            const controlStagePump = parseFloat(
              (Math.round(clamp(v, CONTROLSTAGEPUMP_MIN, CONTROLSTAGEPUMP_MAX) * 10) / 10).toFixed(1)
            );

            props.handleSetpointValueChange?.("controlStagePump", controlStagePump);

            const label = createSetpointLabel("all", { setpoint, deadband, heating, cooling, supplyDuctPressure, coolingCoilValve, heatingCoilValve, coolingCoilPump, heatingCoilPump, supplyFanSpeed, supplyAirSetpoint, supplyHeaterSetpoint, outsideAirDamperPosition, returnAirDamperPosition, zoneDamperPosition, zoneReheatControl, zoneAirCoolingSetpoint, zoneAirHeatingSetpoint, zoneOperativeCoolingSetpoint, zoneOperativeHeatingSetpoint, controlStagePump });
            handleChange(`${path}`, editing)({ controlStagePump, label });
          }}
        />
      </MultiSlider>
    </Label>
  );

  const renderSliders = () => {
    switch (type) {
      case "both":
        return (
          <div className="row">
            <div className="setpoint">{renderSetpoint()}</div>
            <div className="break" />
            <div className="setpoint">{renderSupplyAirSetpoint()}</div>
            <div className="break" /> 
            <div className="setpoint">{renderSupplyHeaterSetpoint()}</div>
            <div className="break" /> 
            <div className="setpoint">{renderSupplyDuctPressure()}</div>
            <div className="break" />
            <div className="setpoint">{renderCoolingCoilValve()}</div>
            <div className="break" />
            <div className="setpoint">{renderHeatingCoilValve()}</div>
            <div className="break" />
            <div className="setpoint">{renderCoolingCoilPump()}</div>
            <div className="break" />
            <div className="setpoint">{renderHeatingCoilPump()}</div>
            <div className="break" />
            <div className="setpoint">{renderSupplyFanSpeed()}</div>
            <div className="break" /> 
            <div className="setpoint">{renderOutsideAirDamperPosition()}</div>
            <div className="break" /> 
            <div className="setpoint">{renderReturnAirDamperPosition()}</div>
            <div className="break" /> 
            <div className="setpoint">{renderZoneDamperPosition()}</div>
            <div className="break" /> 
            <div className="setpoint">{renderZoneReheatControl()}</div>
            <div className="break" /> 
            <div className="setpoint">{renderZoneAirTempSetpoint()}</div>
            <div className="break" /> 
            <div className="setpoint">{renderZoneOperativeTempSetpoint()}</div>
            <div className="break" /> 
            <div className="setpoint">{renderControlStagePump()}</div>
            <div className="break" /> 
            <div />
          </div>
        );
      case "single":
        return (
          <div className="row">
            <div className="setpoint">{renderSingle()}</div>
            <div className="break" />
            <div />
          </div>
        );
      case "separate":
      default:
        return (
          <div className="row">
          {isDefined("setpoint") && (
            <>
              <div className="setpoint">{renderSetpoint()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("supplyDuctPressure") && (
            <>
              <div className="setpoint">{renderSupplyDuctPressure()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("coolingCoilValve") && (
            <>
              <div className="setpoint">{renderCoolingCoilValve()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("heatingCoilValve") && (
            <>
              <div className="setpoint">{renderHeatingCoilValve()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("coolingCoilPump") && (
            <>
              <div className="setpoint">{renderCoolingCoilPump()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("heatingCoilPump") && (
            <>
              <div className="setpoint">{renderHeatingCoilPump()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("supplyFanSpeed") && (
            <>
              <div className="setpoint">{renderSupplyFanSpeed()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("supplyAirSetpoint") && (
            <>
              <div className="setpoint">{renderSupplyAirSetpoint()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("supplyHeaterSetpoint") && (
            <>
              <div className="setpoint">{renderSupplyHeaterSetpoint()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("outsideAirDamperPosition") && (
            <>
              <div className="setpoint">{renderOutsideAirDamperPosition()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("returnAirDamperPosition") && (
            <>
              <div className="setpoint">{renderReturnAirDamperPosition()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("zoneDamperPosition") && (
            <>
              <div className="setpoint">{renderZoneDamperPosition()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("zoneReheatControl") && (
            <>
              <div className="setpoint">{renderZoneReheatControl()}</div>
              <div className="break" />
            </>
          )}
          {(isDefined("zoneAirCoolingSetpoint") || isDefined("zoneAirHeatingSetpoint")) && (
            <>
              <div className="setpoint">{renderZoneAirTempSetpoint()}</div>
              <div className="break" />
            </>
          )}
          {(isDefined("zoneOperativeCoolingSetpoint") || isDefined("zoneOperativeHeatingSetpoint")) && (
            <>
              <div className="setpoint">{renderZoneOperativeTempSetpoint()}</div>
              <div className="break" />
            </>
          )}
          {isDefined("controlStagePump") && (
            <>
              <div className="setpoint">{renderControlStagePump()}</div>
              <div className="break" />
            </>
          )}
            <div />
          </div>
        );
    }
  };

  return (
    <>
      <div className="row" style={{ marginBottom: "1.5rem" }}>
        <h2>Controllers</h2>
      </div>
      {renderSliders()}
    </>
  );
}
