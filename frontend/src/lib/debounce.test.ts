import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "./debounce";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("debounce", () => {
  it("só chama depois do intervalo sem novas chamadas", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 500);
    debounced("a");
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith("a");
  });

  it("cada chamada reinicia o intervalo e vale o último argumento", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 500);
    debounced("a");
    vi.advanceTimersByTime(400);
    debounced("b");
    vi.advanceTimersByTime(400);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledExactlyOnceWith("b");
  });

  it("flush executa a chamada pendente na hora, uma vez só", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 500);
    debounced("a");
    expect(debounced.pending()).toBe(true);
    debounced.flush();
    expect(fn).toHaveBeenCalledExactlyOnceWith("a");
    expect(debounced.pending()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("flush sem chamada pendente não faz nada", () => {
    const fn = vi.fn();
    debounce(fn, 500).flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel descarta a chamada pendente", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 500);
    debounced("a");
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    expect(debounced.pending()).toBe(false);
  });
});
