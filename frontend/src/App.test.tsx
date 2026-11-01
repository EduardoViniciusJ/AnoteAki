import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import {
  closeNoteWindow,
  getNote,
  getSettings,
  getShortcutStatus,
  getWindowState,
  hideWindow,
  listNotes,
  type MoveModePayload,
  type Note,
  onMoveMode,
  onWindowShown,
  openLink,
  openNoteWindow,
  saveNote,
  setMoveMode,
  setWindowPinned,
  setWindowSize,
  type WindowShownPayload,
} from "./lib/api";

vi.mock("./lib/api", () => ({
  closeNoteWindow: vi.fn(),
  getNote: vi.fn(),
  getSettings: vi.fn(),
  getShortcutStatus: vi.fn(),
  getWindowState: vi.fn(),
  hideWindow: vi.fn(),
  listNotes: vi.fn(),
  onMoveMode: vi.fn(),
  onWindowShown: vi.fn(),
  openLink: vi.fn(),
  openNoteWindow: vi.fn(),
  restoreNote: vi.fn(),
  saveNote: vi.fn(),
  searchNotes: vi.fn(),
  setMoveMode: vi.fn(),
  setWindowPinned: vi.fn(),
  setWindowSize: vi.fn(),
}));

let emitWindowShown: (payload: WindowShownPayload) => void = () => {};
let emitMoveMode: (payload: MoveModePayload) => void = () => {};

function note(id: number, body: string): Note {
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
    deletedAt: null,
  };
}

const editor = () => screen.getByLabelText<HTMLTextAreaElement>("Texto da nota");
const title = () => screen.getByLabelText<HTMLInputElement>("Título da nota");

async function renderApp() {
  render(<App />);
  await act(async () => {});
}

beforeEach(() => {
  vi.mocked(getWindowState).mockResolvedValue({
    noteId: null,
    color: "blue",
    opacity: 100,
    pinned: true,
  });
  vi.mocked(setWindowPinned).mockResolvedValue(undefined);
  vi.mocked(setWindowSize).mockResolvedValue(undefined);
  vi.mocked(openLink).mockResolvedValue(undefined);
  vi.mocked(listNotes).mockResolvedValue([]);
  vi.mocked(getSettings).mockResolvedValue({
    theme: "system",
    shortcut: "Ctrl+Alt+K",
    hideOnBlur: true,
  });
  vi.mocked(getShortcutStatus).mockResolvedValue({ shortcut: "Ctrl+Alt+K", registered: true });
  vi.mocked(hideWindow).mockResolvedValue(undefined);
  vi.mocked(openNoteWindow).mockResolvedValue(undefined);
  vi.mocked(closeNoteWindow).mockResolvedValue(undefined);
  vi.mocked(saveNote).mockImplementation(async ({ body }) => note(1, body));
  vi.mocked(onWindowShown).mockImplementation(async (handler) => {
    emitWindowShown = handler;
    return () => {};
  });
  vi.mocked(setMoveMode).mockResolvedValue(undefined);
  vi.mocked(onMoveMode).mockImplementation(async (handler) => {
    emitMoveMode = handler;
    return () => {};
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-theme");
});

describe("App", () => {
  it("post-it novo: foco no título e cor da janela", async () => {
    await renderApp();
    expect(document.activeElement).toBe(title());
    expect(document.documentElement.style.getPropertyValue("--sticker")).toBe(
      "var(--sticker-blue)",
    );
  });

  it("carrega a nota da janela com cor e transparência", async () => {
    vi.mocked(getWindowState).mockResolvedValue({
      noteId: 4,
      color: "pink",
      opacity: 85,
      pinned: true,
    });
    vi.mocked(getNote).mockResolvedValue(note(4, "lista"));
    await renderApp();
    expect(getNote).toHaveBeenCalledWith(4);
    expect(editor().value).toBe("lista");
    expect(document.activeElement).toBe(editor());
    expect(document.documentElement.style.getPropertyValue("--sticker-opacity")).toBe("85%");
  });

  it("foca de novo quando a janela aparece", async () => {
    await renderApp();
    editor().blur();
    await act(async () => emitWindowShown({ reason: "shortcut" }));
    expect(document.activeElement).toBe(title());
  });

  it("Enter no título pula para o texto", async () => {
    await renderApp();
    fireEvent.change(title(), { target: { value: "Mercado" } });
    fireEvent.keyDown(title(), { key: "Enter" });
    expect(document.activeElement).toBe(editor());
  });

  it("Ctrl+N abre outro post-it, sem mexer neste", async () => {
    await renderApp();
    fireEvent.change(editor(), { target: { value: "fica aqui" } });
    await act(async () => {
      fireEvent.keyDown(editor(), { key: "n", ctrlKey: true });
    });
    expect(openNoteWindow).toHaveBeenCalledWith(null);
    expect(editor().value).toBe("fica aqui");
  });

  it("fechar salva antes e depois fecha o post-it", async () => {
    await renderApp();
    fireEvent.change(editor(), { target: { value: "oi" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Fechar post-it/ }));
    });
    expect(saveNote).toHaveBeenCalled();
    expect(closeNoteWindow).toHaveBeenCalledOnce();
  });

  it("Ctrl+M pede o modo mover; o evento liga em todas as janelas", async () => {
    await renderApp();
    fireEvent.keyDown(editor(), { key: "m", ctrlKey: true });
    expect(setMoveMode).toHaveBeenCalledWith(true);
    await act(async () => emitMoveMode({ on: true }));
    expect(screen.getByText(/Arraste para mover/)).toBeTruthy();
  });

  it("Esc esconde todos os post-its", async () => {
    await renderApp();
    await act(async () => {
      fireEvent.keyDown(editor(), { key: "Escape" });
    });
    expect(hideWindow).toHaveBeenCalledOnce();
  });

  it("Esc não esconde quando salvar falha", async () => {
    vi.mocked(saveNote).mockRejectedValue(new Error("db"));
    await renderApp();
    fireEvent.change(editor(), { target: { value: "sem salvar" } });
    await act(async () => {
      fireEvent.keyDown(editor(), { key: "Escape" });
    });
    expect(hideWindow).not.toHaveBeenCalled();
    expect(editor().value).toBe("sem salvar");
  });

  it("histórico não abre quando salvar falha", async () => {
    vi.mocked(saveNote).mockRejectedValue(new Error("db"));
    await renderApp();
    fireEvent.change(editor(), { target: { value: "sem salvar" } });
    await act(async () => {
      fireEvent.keyDown(editor(), { key: "h", ctrlKey: true });
    });
    expect(screen.queryByLabelText("Buscar notas")).toBeNull();
    expect(editor().value).toBe("sem salvar");
  });

  it("abrir uma nota do histórico abre o post-it dela", async () => {
    vi.mocked(listNotes).mockResolvedValue([
      {
        id: 8,
        title: "lista",
        preview: "",
        pinned: false,
        color: null,
        updatedAt: "2026-10-29T12:00:00.000Z",
        deletedAt: null,
      },
    ]);
    await renderApp();
    await act(async () => {
      fireEvent.keyDown(editor(), { key: "h", ctrlKey: true });
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: /lista/ }));
    });
    expect(openNoteWindow).toHaveBeenCalledWith(8);
    expect(editor()).toBeTruthy();
  });

  it("avisa quando o atalho não foi registrado", async () => {
    vi.mocked(getShortcutStatus).mockResolvedValue({ shortcut: "Ctrl+Alt+K", registered: false });
    render(<App />);
    expect((await screen.findByRole("status")).textContent).toContain("Ctrl+Alt+K");
  });

  it("não avisa quando o atalho está ativo", async () => {
    await renderApp();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("aplica o tema das configurações", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      theme: "dark",
      shortcut: "Ctrl+Alt+K",
      hideOnBlur: true,
    });
    await renderApp();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("relê o tema ao ganhar o foco (mudado em outro post-it)", async () => {
    await renderApp();
    expect(document.documentElement.dataset.theme).toBe("system");
    vi.mocked(getSettings).mockResolvedValue({
      theme: "light",
      shortcut: "Ctrl+Alt+K",
      hideOnBlur: true,
    });
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("anima a abertura quando a janela aparece", async () => {
    const root = document.body.appendChild(document.createElement("main"));
    root.id = "app";
    render(<App />, { container: root });
    await act(async () => {});
    await act(async () => emitWindowShown({ reason: "tray" }));
    expect(root.classList.contains("is-opening")).toBe(true);
    root.remove();
  });

  it('copia título e texto e confirma com "Copiado"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await renderApp();
    fireEvent.change(title(), { target: { value: "Compras" } });
    fireEvent.change(editor(), { target: { value: "leite" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar texto (Ctrl+Shift+C)" }));
    });
    expect(writeText).toHaveBeenCalledWith("Compras\n\nleite");
    expect(screen.getByRole("status").textContent).toContain("Copiado");
  });

  it("copia como Markdown com o título em heading", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await renderApp();
    fireEvent.change(title(), { target: { value: "Compras" } });
    fireEvent.change(editor(), { target: { value: "leite" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar como Markdown (Ctrl+Shift+M)" }));
    });
    expect(writeText).toHaveBeenCalledWith("# Compras\n\nleite");
  });

  it("post-it começa fixado e o botão desafixa", async () => {
    await renderApp();
    const pin = screen.getByRole("button", { name: "Fixado na tela (clique para desafixar)" });
    expect(pin.getAttribute("aria-pressed")).toBe("true");
    await act(async () => fireEvent.click(pin));
    expect(setWindowPinned).toHaveBeenCalledWith(false);
    const unpinned = screen.getByRole("button", { name: "Desafixado: some ao clicar fora" });
    expect(unpinned.getAttribute("aria-pressed")).toBe("false");
  });

  it("mostra o post-it desafixado vindo do Rust", async () => {
    vi.mocked(getWindowState).mockResolvedValue({
      noteId: null,
      color: "blue",
      opacity: 100,
      pinned: false,
    });
    await renderApp();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Desafixado: some ao clicar fora" })),
    );
    expect(setWindowPinned).toHaveBeenCalledWith(true);
  });

  it("se fixar falha, volta o estado e avisa", async () => {
    vi.mocked(setWindowPinned).mockRejectedValue({ code: "INTERNAL", message: "x" });
    await renderApp();
    await act(async () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Fixado na tela (clique para desafixar)" }),
      ),
    );
    expect(
      screen.getByRole("button", { name: "Fixado na tela (clique para desafixar)" }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("fixar ou desafixar");
  });

  it("muda o tamanho do post-it pelo menu", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Tamanho do post-it" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Médio" })));
    expect(setWindowSize).toHaveBeenCalledWith("medium");
  });

  it("Ctrl+clique num link abre no navegador", async () => {
    await renderApp();
    const text = "ver https://example.com/doc. ok";
    fireEvent.change(editor(), { target: { value: text } });
    editor().setSelectionRange(10, 10);
    await act(async () => fireEvent.click(editor(), { ctrlKey: true }));
    expect(openLink).toHaveBeenCalledWith("https://example.com/doc");
  });

  it("clique sem Ctrl ou fora do link não abre nada", async () => {
    await renderApp();
    fireEvent.change(editor(), { target: { value: "ver https://example.com ok" } });
    editor().setSelectionRange(10, 10);
    fireEvent.click(editor());
    editor().setSelectionRange(1, 1);
    fireEvent.click(editor(), { ctrlKey: true });
    expect(openLink).not.toHaveBeenCalled();
  });

  it("avisa quando não consegue abrir o link", async () => {
    vi.mocked(openLink).mockRejectedValue({ code: "INVALID_INPUT", message: "Link inválido." });
    await renderApp();
    fireEvent.change(editor(), { target: { value: "https://example.com" } });
    editor().setSelectionRange(3, 3);
    await act(async () => fireEvent.click(editor(), { ctrlKey: true }));
    expect(screen.getByRole("status").textContent).toContain("Não foi possível abrir o link.");
  });

  it("avisa quando não consegue copiar", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await renderApp();
    fireEvent.change(editor(), { target: { value: "leite" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar texto (Ctrl+Shift+C)" }));
    });
    expect(screen.getByRole("status").textContent).toContain("Não foi possível copiar");
  });
});
