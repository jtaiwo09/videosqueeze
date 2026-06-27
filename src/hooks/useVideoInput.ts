import { useCallback, useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { VIDEO_EXTENSIONS } from "../lib/videoFiles";

/**
 * Bridges the two ways a user supplies files — native drag-and-drop and the
 * open dialog — into a single `onFiles` callback. Filtering/routing of the paths
 * is the caller's concern.
 */
export function useVideoInput(
  onFiles: (paths: string[]) => void,
  disabled = false,
) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === "over" || payload.type === "enter") {
        setDragging(true);
      } else if (payload.type === "drop") {
        setDragging(false);
        if (!disabled && payload.paths?.length) onFiles(payload.paths);
      } else {
        setDragging(false);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onFiles, disabled]);

  const pickFiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: "Video", extensions: [...VIDEO_EXTENSIONS] }],
    });
    if (Array.isArray(selected)) onFiles(selected);
    else if (typeof selected === "string") onFiles([selected]);
  }, [onFiles]);

  return { dragging, pickFiles };
}
