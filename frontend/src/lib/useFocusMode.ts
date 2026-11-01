import { useCallback, useState } from "react";

/**
 * Focus mode: typing hides the toolbar and the footer; moving the mouse or
 * leaving the editor brings them back. Off: nothing is ever hidden.
 */
export function useFocusMode(enabled: boolean) {
  const [typing, setTyping] = useState(false);
  const onType = useCallback(() => {
    if (enabled) setTyping(true);
  }, [enabled]);
  const reveal = useCallback(() => setTyping(false), []);
  return { hidden: enabled && typing, onType, reveal };
}
