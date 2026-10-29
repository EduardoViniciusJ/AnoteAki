import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Note, saveNote } from "./api";
import { SAVE_DELAY_MS, useNoteDraft } from "./useNoteDraft";

vi.mock("./api", () => ({ saveNote: vi.fn() }));

const saveMock = vi.mocked(saveNote);

function note(id: number, body: string, deletedAt: string | null = null): Note {
  const now = "2026-10-29T12:00:00.000Z";
  return { id, title: body, body, color: null, createdAt: now, updatedAt: now, deletedAt };
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
    act(() => result.current.edit("o"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    act(() => result.current.edit("oi"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS - 1);
    });
    expect(saveMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("saving");
    await waitDebounce();
    expect(saveMock).toHaveBeenCalledExactlyOnceWith({ id: null, body: "oi" });
    expect(result.current.noteId).toBe(1);
    expect(result.current.status).toBe("saved");
  });

  it("rascunho id=null: cria uma vez e depois atualiza a mesma nota", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit("a"));
    await waitDebounce();
    act(() => result.current.edit("ab"));
    await waitDebounce();
    expect(saveMock.mock.calls.map(([input]) => input)).toEqual([
      { id: null, body: "a" },
      { id: 1, body: "ab" },
    ]);
  });

  it("flush durante um create em andamento não cria a nota duas vezes", async () => {
    let finish: (n: Note) => void = () => {};
    saveMock.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit("a"));
    await waitDebounce();
    act(() => result.current.edit("ab"));
    let flushed: Promise<boolean> = Promise.resolve(false);
    act(() => {
      flushed = result.current.flush();
    });
    await act(async () => {
      finish(note(7, "a"));
      await flushed;
    });
    expect(saveMock.mock.calls.map(([input]) => input)).toEqual([
      { id: null, body: "a" },
      { id: 7, body: "ab" },
    ]);
  });

  it("não cria nota com o corpo vazio", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit("   "));
    await waitDebounce();
    expect(saveMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("nota existente pode ficar vazia", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.replace(note(3, "x")));
    act(() => result.current.edit(""));
    await waitDebounce();
    expect(saveMock).toHaveBeenCalledExactlyOnceWith({ id: 3, body: "" });
  });

  it("perder o foco da janela salva na hora", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit("oi"));
    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(saveMock).toHaveBeenCalledExactlyOnceWith({ id: null, body: "oi" });
    await waitDebounce();
    expect(saveMock).toHaveBeenCalledOnce();
  });

  it("erro: status de erro e nova tentativa no próximo debounce", async () => {
    saveMock.mockRejectedValueOnce({ code: "DB_ERROR", message: "x" });
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit("oi"));
    await waitDebounce();
    expect(result.current.status).toBe("error");
    expect(result.current.body).toBe("oi");
    act(() => result.current.edit("oi!"));
    await waitDebounce();
    expect(saveMock).toHaveBeenLastCalledWith({ id: null, body: "oi!" });
    expect(result.current.status).toBe("saved");
  });

  it("open salva a atual antes de trocar (Ctrl+N gera 2 notas)", async () => {
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit("primeira"));
    await act(async () => {
      await result.current.open(async () => null);
    });
    expect(result.current.noteId).toBeNull();
    expect(result.current.body).toBe("");
    act(() => result.current.edit("segunda"));
    await waitDebounce();
    expect(saveMock.mock.calls.map(([input]) => input)).toEqual([
      { id: null, body: "primeira" },
      { id: null, body: "segunda" },
    ]);
    expect(result.current.noteId).toBe(2);
  });

  it("open não troca de nota se o salvamento falhar (o texto não se perde)", async () => {
    saveMock.mockRejectedValueOnce({ code: "DB_ERROR", message: "x" });
    const load = vi.fn(async () => note(9, "outra"));
    const { result } = renderHook(() => useNoteDraft());
    act(() => result.current.edit("importante"));
    let opened = true;
    await act(async () => {
      opened = await result.current.open(load);
    });
    expect(opened).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(result.current.body).toBe("importante");
  });

  it("open ignora a nota carregada se o usuário digitou enquanto carregava", async () => {
    let finish: (n: Note | null) => void = () => {};
    const { result } = renderHook(() => useNoteDraft());
    let opening: Promise<boolean> = Promise.resolve(true);
    act(() => {
      opening = result.current.open(() => new Promise((resolve) => (finish = resolve)));
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => result.current.edit("digitando"));
    await act(async () => {
      finish(note(4, "antiga"));
      await opening;
    });
    expect(result.current.body).toBe("digitando");
  });

  it("nota da lixeira abre como somente leitura", async () => {
    const { result } = renderHook(() => useNoteDraft());
    await act(async () => {
      await result.current.open(async () => note(5, "x", "2026-10-29T12:00:00.000Z"));
    });
    expect(result.current.readOnly).toBe(true);
    expect(result.current.noteId).toBe(5);
  });
});
