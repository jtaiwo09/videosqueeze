import { Gauge, Zap, Feather, Sliders, HardDrive, type LucideIcon } from "lucide-react";
import { PRESETS, type PresetId } from "../../engine/presets";

interface PresetCard {
  id: PresetId;
  label: string;
  blurb: string;
  icon: LucideIcon;
}

const CARDS: PresetCard[] = [
  { id: "high", label: PRESETS.high.label, blurb: PRESETS.high.blurb, icon: Gauge },
  { id: "medium", label: PRESETS.medium.label, blurb: PRESETS.medium.blurb, icon: Zap },
  { id: "low", label: PRESETS.low.label, blurb: PRESETS.low.blurb, icon: Feather },
  {
    id: "target",
    label: "Target size",
    blurb: "Fit under a size you pick (e.g. 25 MB).",
    icon: HardDrive,
  },
  {
    id: "custom",
    label: "Custom",
    blurb: "Pick codec, quality, and resolution yourself.",
    icon: Sliders,
  },
];

export function PresetCards({
  selected,
  onSelect,
}: {
  selected: PresetId;
  onSelect: (id: PresetId) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {CARDS.map(({ id, label, blurb, icon: Icon }) => {
        const active = selected === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
              active
                ? "border-accent-bright bg-accent/15 ring-1 ring-accent-bright/50"
                : "border-ink-700 bg-ink-800/50 hover:border-ink-600 hover:bg-ink-800"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "text-accent-bright" : "text-zinc-400"}`} />
            <div>
              <div className="font-medium text-white">{label}</div>
              <div className="mt-0.5 text-xs leading-snug text-zinc-400">{blurb}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
