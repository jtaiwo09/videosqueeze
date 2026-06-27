import type { LucideIcon } from "lucide-react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: LucideIcon;
}

interface Props<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
}

/** A labeled row of mutually-exclusive choices (segmented / radio control). */
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
}: Props<T>) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-zinc-300">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const active = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-accent-bright bg-accent/20"
                  : "border-ink-700 bg-ink-800 hover:border-ink-600"
              }`}
            >
              {Icon && (
                <Icon
                  className={`h-4 w-4 ${active ? "text-accent-bright" : "text-zinc-400"}`}
                />
              )}
              <span>
                <span className="block text-sm font-medium text-white">{option.label}</span>
                {option.hint && (
                  <span className="block text-xs text-zinc-400">{option.hint}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
