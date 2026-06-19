import { Gauge, Zap, Feather, Sliders, Cpu, CircuitBoard } from "lucide-react";
import type { CodecId, EncoderMode } from "../engine/types";
import { PRESETS, type PresetId, type CustomConfig } from "../engine/presets";

interface Props {
  presetId: PresetId;
  custom: CustomConfig;
  sourceHeight: number;
  onSelectPreset: (id: PresetId) => void;
  onChangeCustom: (patch: Partial<CustomConfig>) => void;
}

const PRESET_ICONS: Record<string, typeof Gauge> = {
  high: Gauge,
  medium: Zap,
  low: Feather,
  custom: Sliders,
};

const RES_OPTIONS = [
  { label: "Original", value: null },
  { label: "1080p", value: 1080 },
  { label: "720p", value: 720 },
  { label: "480p", value: 480 },
];

export function QualitySelector({
  presetId,
  custom,
  sourceHeight,
  onSelectPreset,
  onChangeCustom,
}: Props) {
  const cards = [
    PRESETS.high,
    PRESETS.medium,
    PRESETS.low,
    {
      id: "custom" as const,
      label: "Custom",
      blurb: "Pick codec, quality, and resolution yourself.",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => {
          const Icon = PRESET_ICONS[c.id];
          const active = presetId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelectPreset(c.id as PresetId)}
              className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                active
                  ? "border-accent-bright bg-accent/15 ring-1 ring-accent-bright/50"
                  : "border-ink-700 bg-ink-800/50 hover:border-ink-600 hover:bg-ink-800"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-accent-bright" : "text-zinc-400"}`} />
              <div>
                <div className="font-medium text-white">{c.label}</div>
                <div className="mt-0.5 text-xs leading-snug text-zinc-400">{c.blurb}</div>
              </div>
            </button>
          );
        })}
      </div>

      {presetId === "custom" && (
        <div className="space-y-5 rounded-xl border border-ink-700 bg-ink-900/60 p-4">
          {/* Speed vs size */}
          <Toggle<EncoderMode>
            label="Encoder"
            value={custom.mode}
            onChange={(mode) => onChangeCustom({ mode })}
            options={[
              { value: "hardware", label: "Hardware", hint: "Fastest (M3)", icon: CircuitBoard },
              { value: "software", label: "Software", hint: "Smaller file", icon: Cpu },
            ]}
          />

          {/* Codec */}
          <Toggle<CodecId>
            label="Codec"
            value={custom.codec}
            onChange={(codec) => onChangeCustom({ codec })}
            options={[
              { value: "h264", label: "H.264", hint: "Universal" },
              { value: "h265", label: "H.265", hint: "~30% smaller" },
            ]}
          />

          {/* Quality slider */}
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
              onChange={(e) => onChangeCustom({ quality: Number(e.target.value) })}
              className="w-full accent-indigo-400"
            />
            <div className="mt-1 flex justify-between text-xs text-zinc-500">
              <span>Smaller file</span>
              <span>Better quality</span>
            </div>
          </div>

          {/* Resolution */}
          <div>
            <span className="mb-2 block text-sm font-medium text-zinc-300">Max resolution</span>
            <div className="flex flex-wrap gap-2">
              {RES_OPTIONS.map((r) => {
                const disabled = r.value != null && r.value > sourceHeight;
                const active = custom.scaleHeight === r.value;
                return (
                  <button
                    key={r.label}
                    disabled={disabled}
                    onClick={() => onChangeCustom({ scaleHeight: r.value })}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-accent-bright bg-accent/20 text-white"
                        : "border-ink-700 bg-ink-800 text-zinc-300 hover:border-ink-600"
                    } ${disabled ? "cursor-not-allowed opacity-30" : ""}`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ToggleOption<T> {
  value: T;
  label: string;
  hint?: string;
  icon?: typeof Cpu;
}

function Toggle<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: ToggleOption<T>[];
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-zinc-300">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const Icon = o.icon;
          const active = value === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-accent-bright bg-accent/20"
                  : "border-ink-700 bg-ink-800 hover:border-ink-600"
              }`}
            >
              {Icon && <Icon className={`h-4 w-4 ${active ? "text-accent-bright" : "text-zinc-400"}`} />}
              <span>
                <span className="block text-sm font-medium text-white">{o.label}</span>
                {o.hint && <span className="block text-xs text-zinc-400">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
