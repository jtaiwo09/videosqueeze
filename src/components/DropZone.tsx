import { UploadCloud, Film } from "lucide-react";

interface Props {
  dragging: boolean;
  onPick: () => void;
}

export function DropZone({ dragging, onPick }: Props) {
  return (
    <button
      onClick={onPick}
      className={`group flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-16 transition-all ${
        dragging
          ? "border-accent-bright bg-accent/10 scale-[1.01]"
          : "border-ink-600 bg-ink-900/40 hover:border-accent hover:bg-ink-800/60"
      }`}
    >
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
          dragging ? "bg-accent text-white" : "bg-ink-700 text-accent-bright group-hover:bg-ink-600"
        }`}
      >
        {dragging ? <Film className="h-8 w-8" /> : <UploadCloud className="h-8 w-8" />}
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-white">
          {dragging ? "Drop your video here" : "Drop a video, or click to choose"}
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          .mov, .mp4, .m4v, .mkv, .avi, .webm — stays 100% on your Mac
        </p>
      </div>
    </button>
  );
}
