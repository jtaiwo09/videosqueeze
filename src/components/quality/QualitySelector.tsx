import type { PresetId, CustomConfig, TargetConfig } from "../../engine/presets";
import { PresetCards } from "./PresetCards";
import { CustomPanel } from "./CustomPanel";
import { TargetPanel } from "./TargetPanel";

interface Props {
  presetId: PresetId;
  custom: CustomConfig;
  target: TargetConfig;
  sourceHeight: number;
  onSelectPreset: (id: PresetId) => void;
  onChangeCustom: (patch: Partial<CustomConfig>) => void;
  onChangeTarget: (patch: Partial<TargetConfig>) => void;
}

/** Preset cards, plus the expanded panel for whichever advanced mode is selected. */
export function QualitySelector({
  presetId,
  custom,
  target,
  sourceHeight,
  onSelectPreset,
  onChangeCustom,
  onChangeTarget,
}: Props) {
  return (
    <div className="space-y-4">
      <PresetCards selected={presetId} onSelect={onSelectPreset} />
      {presetId === "custom" && (
        <CustomPanel custom={custom} sourceHeight={sourceHeight} onChange={onChangeCustom} />
      )}
      {presetId === "target" && (
        <TargetPanel target={target} sourceHeight={sourceHeight} onChange={onChangeTarget} />
      )}
    </div>
  );
}
