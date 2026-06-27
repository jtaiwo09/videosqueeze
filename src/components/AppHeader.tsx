import { Minimize2 } from "lucide-react";

export function AppHeader() {
  return (
    <header className="flex items-center gap-2.5 px-7 pb-2 pt-7">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
        <Minimize2 className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
      </div>
      <div>
        <h1 className="text-lg font-semibold leading-none text-white">
          VideoSqueeze
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          Fast local compression · stays on your Mac
        </p>
      </div>
    </header>
  );
}
