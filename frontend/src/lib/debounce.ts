export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Runs the pending call now, if any. */
  flush: () => void;
  /** Drops the pending call. */
  cancel: () => void;
  pending: () => boolean;
}

/** Delays `fn` until `waitMs` after the last call; only the last arguments are used. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const run = () => {
    const args = lastArgs;
    timer = undefined;
    lastArgs = undefined;
    if (args) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, waitMs);
  };

  debounced.flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    run();
  };

  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    lastArgs = undefined;
  };

  debounced.pending = () => timer !== undefined;

  return debounced;
}
