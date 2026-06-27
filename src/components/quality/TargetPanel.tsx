import { TARGET_SIZE_OPTIONS, type TargetConfig } from "../../engine/presets";
import { EncoderToggle, CodecToggle, ResolutionPicker } from "./QualityControls";

interface Props {
  target: TargetConfig;
  sourceHeight: number;
  onChange: (patch: Partial<TargetConfig>) => void;
}

/** Pick an output size; encoder/codec/resolution shape how that size is met. */
export function TargetPanel({ target, sourceHeight, onChange }: Props) {
  return (
    <div className="space-y-5 rounded-xl border border-ink-700 bg-ink-900/60 p-4">
      <div>
        <span className="mb-2 block text-sm font-medium text-zinc-300">Target file size</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="number"
              min={1}
              value={target.targetMB}
              onChange={(e) =>
                onChange({
                  targetMB: Math.max(1, Math.round(Number(e.target.value) || 0)),
                })
              }
              className="w-24 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 pr-9 text-sm tabular-nums text-white outline-none focus:border-accent-bright"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
              MB
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TARGET_SIZE_OPTIONS.map((mb) => {
              const active = target.targetMB === mb;
              return (
                <button
                  key={mb}
                  onClick={() => onChange({ targetMB: mb })}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-accent-bright bg-accent/20 text-white"
                      : "border-ink-700 bg-ink-800 text-zinc-300 hover:border-ink-600"
                  }`}
                >
                  {mb} MB
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <EncoderToggle
        value={target.mode}
        onChange={(mode) => onChange({ mode })}
        softwareHint="Hits size precisely"
      />
      <CodecToggle
        value={target.codec}
        onChange={(codec) => onChange({ codec })}
        h265Hint="Sharper at this size"
      />
      <ResolutionPicker
        value={target.scaleHeight}
        sourceHeight={sourceHeight}
        onChange={(scaleHeight) => onChange({ scaleHeight })}
      />
    </div>
  );
}
