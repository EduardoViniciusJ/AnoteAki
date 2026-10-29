export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Executa agora a chamada pendente, se houver. */
  flush: () => void;
  /** Descarta a chamada pendente. */
  cancel: () => void;
  pending: () => boolean;
}

/** Adia `fn` até `waitMs` depois da última chamada; só os últimos argumentos valem. */
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
