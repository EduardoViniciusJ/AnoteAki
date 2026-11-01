import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Note, saveNote } from "./api";
import { SAVE_DELAY_MS, useNoteDraft } from "./useNoteDraft";

vi.mock("./api", () => ({ saveNote: vi.fn() }));

const saveMock = vi.mocked(saveNote);

function note(id: number, body: string, deletedAt: string | null = null): Note {
  const now = "2026-10-29T12:00:00.000Z";
  return {
    id,
    title: body,
    heading: "",
    body,
    color: "pink",
    opacity: 85,
    pinned: false,
    createdAt: now,
    updatedAt: now,
    deletedAt,
  };
}

/** Fake `save_note`: creates ids 1, 2, 3… and returns the saved note. */
function fakeBackend() {
  let nextId = 1;
  saveMock.mockImplementation(async ({ id, body }) => note(id ?? nextId++, body));
}

/** Runs the debounce and lets the save queue finish. */
async function waitDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
  });
}

const sent = () => saveMock.mock.calls.map(([input]) => input);

beforeEach(() => {
  vi.useFakeTimers();
  saveMock.mockReset();
  fakeBackend();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNoteDraft", () => {
  it("salva uma vez, 500 ms depois da última tecla", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit({ body: "o" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    act(() => result.current.edit({ body: "oi" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1);
    });
    expect(saveMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("saving");
    await waitDebounce();
    expect(sent()).toEqual([{ id: null, body: "oi", heading: "", color: "yellow", opacity: 100 }]);
    expect(result.current.noteId).toBe(1);
    expect(result.current.status).toBe("saved");
  });

  it("rascunho id=null: cria uma vez e depois atualiza a mesma nota", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit({ body: "a" }));
    await waitDebounce();
    act(() => result.current.edit({ body: "ab" }));
    await waitDebounce();
    expect(sent().map(({ id, body }) => ({ id, body }))).toEqual([
      { id: null, body: "a" },
      { id: 1, body: "ab" },
    ]);
  });

  it("flush durante um create em andamento não cria a nota duas vezes", async () => {
    let finish: (n: Note) => void = () => {};
    saveMock.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit({ body: "a" }));
    await waitDebounce();
    act(() => result.current.edit({ body: "ab" }));
    let flushed: Promise<boolean> = Promise.resolve(false);
    act(() => {
      flushed = result.current.flush();
    });
    await act(async () => {
      finish(note(7, "a"));
      await flushed;
    });
    expect(sent().map(({ id }) => id)).toEqual([null, 7]);
  });

  it("não cria nota sem título nem texto", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit({ heading: "  ", body: "   " }));
    await waitDebounce();
    expect(saveMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("só o título já cria a nota", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit({ heading: "Mercado" }));
    await waitDebounce();
    expect(sent()[0]).toMatchObject({ id: null, heading: "Mercado", body: "" });
  });

  it("cor e transparência entram no salvamento", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.replace(null, { color: "blue", opacity: 100 }));
    act(() => result.current.edit({ body: "oi" }));
    act(() => result.current.setLook({ color: "green", opacity: 70 }));
    await waitDebounce();
    expect(sent()).toEqual([{ id: null, body: "oi", heading: "", color: "green", opacity: 70 }]);
    expect(result.current.look).toEqual({ color: "green", opacity: 70 });
  });

  it("mudar a cor de um post-it vazio não cria nota", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.setLook({ color: "pink", opacity: 100 }));
    await waitDebounce();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("nota existente pode ficar vazia", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.replace(note(3, "x")));
    act(() => result.current.edit({ body: "" }));
    await waitDebounce();
    expect(sent()[0]).toMatchObject({ id: 3, body: "" });
  });

  it("carrega título, cor e transparência da nota", () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.replace({ ...note(4, "x"), heading: "Plano" }));
    expect(result.current.heading).toBe("Plano");
    expect(result.current.look).toEqual({ color: "pink", opacity: 85 });
  });

  it("perder o foco da janela salva na hora", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit({ body: "oi" }));
    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(saveMock).toHaveBeenCalledOnce();
    await waitDebounce();
    expect(saveMock).toHaveBeenCalledOnce();
  });

  it("erro: status de erro e nova tentativa no próximo debounce", async () => {
    saveMock.mockRejectedValueOnce({ code: "DB_ERROR", message: "x" });
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit({ body: "oi" }));
    await waitDebounce();
    expect(result.current.status).toBe("error");
    expect(result.current.body).toBe("oi");
    act(() => result.current.edit({ body: "oi!" }));
    await waitDebounce();
    expect(sent().at(-1)).toMatchObject({ id: null, body: "oi!" });
    expect(result.current.status).toBe("saved");
  });

  it("flush devolve false se o salvamento falhar", async () => {
    saveMock.mockRejectedValueOnce({ code: "DB_ERROR", message: "x" });
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit({ body: "importante" }));
    let saved = true;
    await act(async () => {
      saved = await result.current.flush();
    });
    expect(saved).toBe(false);
    expect(result.current.body).toBe("importante");
  });

  it("nota da lixeira abre como somente leitura", () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.replace(note(5, "x", "2026-10-29T12:00:00.000Z")));
    expect(result.current.readOnly).toBe(true);
    expect(result.current.noteId).toBe(5);
  });
});
