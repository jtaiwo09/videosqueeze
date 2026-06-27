import { useCallback, useState } from "react";
import {
  DEFAULT_CUSTOM,
  DEFAULT_TARGET,
  type PresetId,
  type CustomConfig,
  type TargetConfig,
} from "../engine/presets";

/** The quality selection shared by the single-file and batch flows. */
export interface QualitySettings {
  presetId: PresetId;
  custom: CustomConfig;
  target: TargetConfig;
  selectPreset: (id: PresetId) => void;
  changeCustom: (patch: Partial<CustomConfig>) => void;
  changeTarget: (patch: Partial<TargetConfig>) => void;
}

export function useQualitySettings(): QualitySettings {
  const [presetId, setPresetId] = useState<PresetId>("medium");
  const [custom, setCustom] = useState<CustomConfig>(DEFAULT_CUSTOM);
  const [target, setTarget] = useState<TargetConfig>(DEFAULT_TARGET);

  const selectPreset = useCallback((id: PresetId) => setPresetId(id), []);
  const changeCustom = useCallback(
    (patch: Partial<CustomConfig>) => setCustom((prev) => ({ ...prev, ...patch })),
    [],
  );
  const changeTarget = useCallback(
    (patch: Partial<TargetConfig>) => setTarget((prev) => ({ ...prev, ...patch })),
    [],
  );

  return { presetId, custom, target, selectPreset, changeCustom, changeTarget };
}
