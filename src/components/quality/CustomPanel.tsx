import type { CustomConfig } from "../../engine/presets";
import { EncoderToggle, CodecToggle, ResolutionPicker } from "./QualityControls";

interface Props {
  custom: CustomConfig;
  sourceHeight: number;
  onChange: (patch: Partial<CustomConfig>) => void;
}

/** Manual controls: encoder, codec, a quality slider, and max resolution. */
export function CustomPanel({ custom, sourceHeight, onChange }: Props) {
  return (
    <div className="space-y-5 rounded-xl border border-ink-700 bg-ink-900/60 p-4">
      <EncoderToggle
        value={custom.mode}
        onChange={(mode) => onChange({ mode })}
        softwareHint="Smaller file"
      />
      <CodecToggle
        value={custom.codec}
        onChange={(codec) => onChange({ codec })}
        h265Hint="~30% smaller"
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">Quality</span>
          <span className="text-sm tabular-nums text-accent-bright">{custom.quality}</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          step={1}
          value={custom.quality}
          onChange={(e) => onChange({ quality: Number(e.target.value) })}
          className="w-full accent-indigo-400"
        />
        <div className="mt-1 flex justify-between text-xs text-zinc-500">
          <span>Smaller file</span>
          <span>Better quality</span>
        </div>
      </div>

      <ResolutionPicker
        value={custom.scaleHeight}
        sourceHeight={sourceHeight}
        onChange={(scaleHeight) => onChange({ scaleHeight })}
      />
    </div>
  );
}
