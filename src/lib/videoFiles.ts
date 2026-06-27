/** Video container extensions VideoSqueeze accepts (lowercase, no dot). */
export const VIDEO_EXTENSIONS = [
  "mov",
  "mp4",
  "m4v",
  "mkv",
  "avi",
  "webm",
  "flv",
  "wmv",
  "mpg",
  "mpeg",
] as const;

/** True if the path ends in one of the supported video extensions. */
export function isVideoPath(path: string): boolean {
  const lower = path.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`));
}
