import type { CompressionSettings, CodecId, EncoderMode } from "./types";

export type PresetId = "high" | "medium" | "low" | "custom";

/** Don't let the target drop below this — avoids unwatchable output. */
const FLOOR_KBPS = 200;

export interface Preset {
  id: PresetId;
  label: string;
  blurb: string;
  /** Target video bitrate as a fraction of the SOURCE bitrate. < 1 ⇒ always smaller. */
  factor: number;
  codec: CodecId;
  mode: EncoderMode;
  scaleHeight: number | null;
  audioKbps: number;
}

export const PRESETS: Record<Exclude<PresetId, "custom">, Preset> = {
  high: {
    id: "high",
    label: "High",
    blurb: "~60% of original bitrate. Crisp — best for re-sharing screen recordings.",
    factor: 0.6,
    codec: "h264",
    mode: "hardware",
    scaleHeight: null,
    audioKbps: 160,
  },
  medium: {
    id: "medium",
    label: "Medium",
    blurb: "~40% of original bitrate. Balanced — a good default.",
    factor: 0.4,
    codec: "h264",
    mode: "hardware",
    scaleHeight: null,
    audioKbps: 128,
  },
  low: {
    id: "low",
    label: "Low",
    blurb: "~25% of original bitrate, downscaled to 1080p. Smallest file.",
    factor: 0.25,
    codec: "h264",
    mode: "hardware",
    scaleHeight: 1080,
    audioKbps: 96,
  },
};

/** Custom panel state (UI). Quality slider 10–100 maps to a bitrate factor. */
export interface CustomConfig {
  codec: CodecId;
  mode: EncoderMode;
  quality: number;
  scaleHeight: number | null;
  audioKbps: number;
}

export const DEFAULT_CUSTOM: CustomConfig = {
  codec: "h264",
  mode: "hardware",
  quality: 55,
  scaleHeight: null,
  audioKbps: 128,
};

/** quality 10..100 → bitrate factor ~0.20..0.90 of source. */
export function qualityToFactor(q: number): number {
  const qc = Math.max(10, Math.min(100, q));
  return 0.12 + (qc / 100) * 0.78;
}

/**
 * Compute the target video bitrate from the source bitrate and a factor.
 * H.265 is ~30% more efficient, so we can lower the target further for the same
 * visual quality. Result is always below the source video bitrate.
 */
function targetVideoKbps(sourceTotalKbps: number, factor: number, codec: CodecId): number {
  const sourceVideo = Math.max(FLOOR_KBPS, Math.round(sourceTotalKbps * 0.95));
  const codecAdj = codec === "h265" ? 0.75 : 1;
  const v = Math.round(sourceVideo * factor * codecAdj);
  return Math.max(FLOOR_KBPS, Math.min(v, sourceVideo - 1));
}

export function settingsFromPreset(p: Preset, sourceTotalKbps: number): CompressionSettings {
  return {
    codec: p.codec,
    mode: p.mode,
    videoBitrateKbps: targetVideoKbps(sourceTotalKbps, p.factor, p.codec),
    scaleHeight: p.scaleHeight,
    fps: null,
    audioKbps: p.audioKbps,
  };
}

export function settingsFromCustom(c: CustomConfig, sourceTotalKbps: number): CompressionSettings {
  return {
    codec: c.codec,
    mode: c.mode,
    videoBitrateKbps: targetVideoKbps(sourceTotalKbps, qualityToFactor(c.quality), c.codec),
    scaleHeight: c.scaleHeight,
    fps: null,
    audioKbps: c.audioKbps,
  };
}

/** Accurate size estimate: bitrate × duration. */
export function estimateBytes(s: CompressionSettings, durationSec: number): number {
  return Math.max(1, Math.round(((s.videoBitrateKbps + s.audioKbps) * 1000 / 8) * durationSec));
}
