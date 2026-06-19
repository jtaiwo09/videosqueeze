export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatEta(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return "—";
  if (sec < 1) return "<1s";
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

export function fileName(path: string): string {
  return path.split("/").pop() || path;
}

export function deriveOutputName(inputPath: string): string {
  const name = fileName(inputPath);
  const dot = name.lastIndexOf(".");
  const rawBase = dot > 0 ? name.slice(0, dot) : name;
  // Avoid "...-compressed-compressed.mp4" when re-compressing.
  const base = rawBase.replace(/-compressed(-\d+)?$/i, "");
  let candidate = `${base}-compressed.mp4`;
  // Never collide with the input filename (e.g. input was already "X-compressed.mp4").
  if (candidate.toLowerCase() === name.toLowerCase()) {
    candidate = `${base}-compressed-1.mp4`;
  }
  return candidate;
}
