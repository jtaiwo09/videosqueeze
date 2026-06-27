import { Cpu, CircuitBoard } from "lucide-react";
import type { CodecId, EncoderMode } from "../../engine/types";
import { SegmentedControl } from "../ui/SegmentedControl";

const RESOLUTION_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Original", value: null },
  { label: "1080p", value: 1080 },
  { label: "720p", value: 720 },
  { label: "480p", value: 480 },
];

/** Hardware vs software encoder. The software trade-off differs by mode, so the hint is passed in. */
export function EncoderToggle({
  value,
  onChange,
  softwareHint,
}: {
  value: EncoderMode;
  onChange: (value: EncoderMode) => void;
  softwareHint: string;
}) {
  return (
    <SegmentedControl<EncoderMode>
      label="Encoder"
      value={value}
      onChange={onChange}
      options={[
        { value: "hardware", label: "Hardware", hint: "Fastest (M3)", icon: CircuitBoard },
        { value: "software", label: "Software", hint: softwareHint, icon: Cpu },
      ]}
    />
  );
}

/** H.264 vs H.265. The H.265 benefit reads differently per mode, so the hint is passed in. */
export function CodecToggle({
  value,
  onChange,
  h265Hint,
}: {
  value: CodecId;
  onChange: (value: CodecId) => void;
  h265Hint: string;
}) {
  return (
    <SegmentedControl<CodecId>
      label="Codec"
      value={value}
      onChange={onChange}
      options={[
        { value: "h264", label: "H.264", hint: "Universal" },
        { value: "h265", label: "H.265", hint: h265Hint },
      ]}
    />
  );
}

/** Max output height. Resolutions above the source are disabled (never upscale). */
export function ResolutionPicker({
  value,
  sourceHeight,
  onChange,
}: {
  value: number | null;
  sourceHeight: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-zinc-300">Max resolution</span>
      <div className="flex flex-wrap gap-2">
        {RESOLUTION_OPTIONS.map((option) => {
          const disabled = option.value != null && option.value > sourceHeight;
          const active = value === option.value;
          return (
            <button
              key={option.label}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-accent-bright bg-accent/20 text-white"
                  : "border-ink-700 bg-ink-800 text-zinc-300 hover:border-ink-600"
              } ${disabled ? "cursor-not-allowed opacity-30" : ""}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
