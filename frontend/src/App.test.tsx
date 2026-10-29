import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import {
  getLastNote,
  getNote,
  getShortcutStatus,
  hideWindow,
  listNotes,
  type Note,
  onWindowShown,
  type WindowShownPayload,
} from "./lib/api";

vi.mock("./lib/api", () => ({
  getLastNote: vi.fn(),
  getNote: vi.fn(),
  getShortcutStatus: vi.fn(),
  hideWindow: vi.fn(),
  listNotes: vi.fn(),
  onWindowShown: vi.fn(),
  restoreNote: vi.fn(),
  saveNote: vi.fn(),
  searchNotes: vi.fn(),
}));

let emitWindowShown: (payload: WindowShownPayload) => void = () => {};

function note(id: number, body: string): Note {
  const now = "2026-10-29T12:00:00.000Z";
  return { id, title: body, body, color: null, createdAt: now, updatedAt: now, deletedAt: null };
}

const editor = () => screen.getByLabelText<HTMLTextAreaElement>("Texto da nota");

beforeEach(() => {
  vi.mocked(getLastNote).mockResolvedValue(null);
  vi.mocked(listNotes).mockResolvedValue([]);
  vi.mocked(getShortcutStatus).mockResolvedValue({ shortcut: "Ctrl+Alt+K", registered: true });
  vi.mocked(hideWindow).mockResolvedValue(undefined);
  vi.mocked(onWindowShown).mockImplementation(async (handler) => {
    emitWindowShown = handler;
    return () => {};
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

afterEach(cleanup);

describe("App", () => {
  it("foca o editor quando a janela aparece", async () => {
    render(<App />);
    await act(async () => {});
    await act(async () => emitWindowShown({ reason: "shortcut" }));
    expect(document.activeElement).toBe(editor());
  });

  it("carrega a última nota ao iniciar e a cada window-shown", async () => {
    vi.mocked(getLastNote).mockResolvedValueOnce(note(1, "primeira"));
    render(<App />);
    await act(async () => {});
    expect(editor().value).toBe("primeira");
    vi.mocked(getLastNote).mockResolvedValueOnce(note(2, "mais nova"));
    await act(async () => emitWindowShown({ reason: "shortcut" }));
    expect(editor().value).toBe("mais nova");
  });

  it("Ctrl+H abre o histórico e Esc volta para a nota", async () => {
    render(<App />);
    await act(async () => {});
    await act(async () => {
      fireEvent.keyDown(editor(), { key: "h", ctrlKey: true });
    });
    const search = screen.getByLabelText("Buscar notas");
    expect(document.activeElement).toBe(search);
    await act(async () => {
      fireEvent.keyDown(search, { key: "Escape" });
    });
    expect(editor()).toBeTruthy();
  });

  it("abrir uma nota do histórico mostra o texto dela", async () => {
    vi.mocked(listNotes).mockResolvedValue([
      {
        id: 8,
        title: "lista",
        preview: "",
        color: null,
        updatedAt: "2026-10-29T12:00:00.000Z",
        deletedAt: null,
      },
    ]);
    vi.mocked(getNote).mockResolvedValue(note(8, "lista\ncompleta"));
    render(<App />);
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Histórico/ }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /lista/ }));
    });
    expect(getNote).toHaveBeenCalledWith(8);
    expect(editor().value).toBe("lista\ncompleta");
  });

  it("avisa quando o atalho não foi registrado", async () => {
    vi.mocked(getShortcutStatus).mockResolvedValue({ shortcut: "Ctrl+Alt+K", registered: false });
    render(<App />);
    expect((await screen.findByRole("status")).textContent).toContain("Ctrl+Alt+K");
  });

  it("não avisa quando o atalho está ativo", async () => {
    render(<App />);
    await act(async () => {});
    expect(screen.queryByRole("status")).toBeNull();
  });
});
