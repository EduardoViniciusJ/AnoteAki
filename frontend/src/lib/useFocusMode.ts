import { useCallback, useRef, useState } from "react";

/** Below this the "move" was jitter or no movement at all. */
const MIN_MOVE_PX = 3;

/**
 * Focus mode: typing hides the toolbar and the footer; really moving the
 * mouse or leaving the editor brings them back. Off: nothing is hidden.
 * Typing reflows the text under the cursor and the browser then fires
 * mousemove without the mouse moving, so reveal only on actual movement.
 */
export function useFocusMode(enabled: boolean) {
  const [typing, setTyping] = useState(false);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const onType = useCallback(() => {
    if (!enabled) return;
    // The next mouse event only records the reference position.
    pointerRef.current = null;
    setTyping(true);
  }, [enabled]);

  const reveal = useCallback(() => setTyping(false), []);

  const onMouseMove = useCallback((event: { screenX: number; screenY: number }) => {
    const last = pointerRef.current;
    pointerRef.current = { x: event.screenX, y: event.screenY };
    if (!last) return;
    if (Math.abs(event.screenX - last.x) + Math.abs(event.screenY - last.y) < MIN_MOVE_PX) return;
    setTyping(false);
  }, []);

  return { hidden: enabled && typing, onType, reveal, onMouseMove };
}
