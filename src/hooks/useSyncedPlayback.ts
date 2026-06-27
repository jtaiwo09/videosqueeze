import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";

/** Keep the compressed video locked to the original's playhead within this gap. */
const DRIFT_TOLERANCE = 0.18; // seconds

/**
 * Drives two <video> elements as one: the original is the source of truth and
 * the compressed clip is continuously slaved to its playhead. Handles play/pause,
 * scrubbing, a requestAnimationFrame playhead (timeupdate alone stalls on streamed
 * sources), spacebar control, and restoring state when a layout switch remounts
 * the elements.
 */
export function useSyncedPlayback(fallbackDuration: number) {
  const originalRef = useRef<HTMLVideoElement>(null);
  const compressedRef = useRef<HTMLVideoElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(fallbackDuration);
  const [current, setCurrent] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const syncCompressed = useCallback((force = false) => {
    const original = originalRef.current;
    const compressed = compressedRef.current;
    if (!original || !compressed) return;
    if (
      force ||
      Math.abs(compressed.currentTime - original.currentTime) > DRIFT_TOLERANCE
    ) {
      compressed.currentTime = original.currentTime;
    }
  }, []);

  const togglePlay = useCallback(() => {
    const original = originalRef.current;
    const compressed = compressedRef.current;
    if (!original || !compressed) return;
    if (original.paused) {
      syncCompressed(true);
      void original.play();
      void compressed.play();
      setPlaying(true);
    } else {
      original.pause();
      compressed.pause();
      setPlaying(false);
    }
  }, [syncCompressed]);

  const seek = useCallback((time: number) => {
    const original = originalRef.current;
    const compressed = compressedRef.current;
    if (!original || !compressed) return;
    original.currentTime = time;
    compressed.currentTime = time;
    setCurrent(time);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const beginScrub = useCallback(() => setScrubbing(true), []);
  const endScrub = useCallback(() => setScrubbing(false), []);

  // Bound on the original <video> in JSX so they survive a layout remount.
  const onLoadedMetadata = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) =>
      setDuration(e.currentTarget.duration || fallbackDuration),
    [fallbackDuration],
  );
  const onTimeUpdate = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) => {
      if (!scrubbing) setCurrent(e.currentTarget.currentTime);
      syncCompressed();
    },
    [scrubbing, syncCompressed],
  );
  const onEnded = useCallback(() => {
    setPlaying(false);
    originalRef.current?.pause();
    compressedRef.current?.pause();
  }, []);

  // Smooth playhead while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const original = originalRef.current;
      if (original && !scrubbing) setCurrent(original.currentTime);
      syncCompressed();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, scrubbing, syncCompressed]);

  // Space toggles play/pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  /** Call after a layout switch remounts the videos to restore position/playback. */
  const restoreAfterRemount = useCallback(() => {
    const original = originalRef.current;
    const compressed = compressedRef.current;
    if (!original || !compressed) return;
    original.currentTime = current;
    compressed.currentTime = current;
    if (playing) {
      void original.play();
      void compressed.play();
    }
  }, [current, playing]);

  return {
    originalRef,
    compressedRef,
    playing,
    muted,
    duration,
    current,
    togglePlay,
    seek,
    toggleMute,
    beginScrub,
    endScrub,
    originalVideoHandlers: { onLoadedMetadata, onTimeUpdate, onEnded },
    restoreAfterRemount,
  };
}
