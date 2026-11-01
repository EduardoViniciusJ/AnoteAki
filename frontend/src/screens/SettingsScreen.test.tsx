import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, getShortcutStatus, type Settings, setSetting } from "../lib/api";
import { SettingsScreen, type SettingsScreenProps } from "./SettingsScreen";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    getSettings: vi.fn(),
    getShortcutStatus: vi.fn(),
    setSetting: vi.fn(),
  };
});

const DEFAULTS: Settings = {
  theme: "system",
  shortcut: "Ctrl+Alt+K",
  hideOnBlur: true,
  editorFont: "inter",
  focusMode: false,
};

async function renderScreen(props: Partial<SettingsScreenProps> = {}) {
  const all: SettingsScreenProps = { onBack: vi.fn(), onSettingsChange: vi.fn(), ...props };
  render(<SettingsScreen {...all} />);
  await act(async () => {});
  return all;
}

const recorder = () => screen.getByLabelText<HTMLInputElement>("Gravar atalho");
const checkbox = (element: HTMLElement) => element as HTMLInputElement;

beforeEach(() => {
  vi.mocked(getSettings).mockResolvedValue(DEFAULTS);
  vi.mocked(getShortcutStatus).mockResolvedValue({ shortcut: "Ctrl+Alt+K", registered: true });
  vi.mocked(setSetting).mockImplementation(async (key, value) => ({ ...DEFAULTS, [key]: value }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

describe("SettingsScreen", () => {
  it("mostra os valores salvos", async () => {
    vi.mocked(getSettings).mockResolvedValue({ ...DEFAULTS, theme: "dark", focusMode: true });
    await renderScreen();
    expect(screen.getByRole("button", { name: "Tema" }).textContent).toContain("Escuro");
    expect(screen.getByRole("button", { name: "Fonte do editor" }).textContent).toContain("Inter");
    expect(checkbox(screen.getByLabelText(/Esconder post-its desafixados/)).checked).toBe(true);
    expect(checkbox(screen.getByLabelText(/Modo foco/)).checked).toBe(true);
    expect(screen.getByText("Ctrl+Alt+K")).toBeTruthy();
  });

  it("troca o tema na hora e o aplica", async () => {
    const props = await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Tema" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Escuro" })));
    expect(setSetting).toHaveBeenCalledWith("theme", "dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(props.onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" }));
  });

  it("troca a fonte do editor", async () => {
    const props = await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Fonte do editor" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mono" })));
    expect(setSetting).toHaveBeenCalledWith("editorFont", "mono");
    expect(props.onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ editorFont: "mono" }),
    );
  });

  it("salva os interruptores", async () => {
    await renderScreen();
    await act(async () => fireEvent.click(screen.getByLabelText(/Esconder post-its/)));
    expect(setSetting).toHaveBeenCalledWith("hideOnBlur", false);
    expect(checkbox(screen.getByLabelText(/Esconder post-its/)).checked).toBe(false);
    await act(async () => fireEvent.click(screen.getByLabelText(/Modo foco/)));
    expect(setSetting).toHaveBeenCalledWith("focusMode", true);
  });

  it("mostra um aviso quando não consegue salvar", async () => {
    vi.mocked(setSetting).mockRejectedValue({ code: "DB_ERROR", message: "x" });
    await renderScreen();
    await act(async () => fireEvent.click(screen.getByLabelText(/Modo foco/)));
    expect(screen.getByText("Não foi possível salvar a configuração.")).toBeTruthy();
    expect(checkbox(screen.getByLabelText(/Modo foco/)).checked).toBe(false);
  });

  it("grava e salva um atalho novo", async () => {
    await renderScreen();
    fireEvent.keyDown(recorder(), { key: "Control", code: "ControlLeft", ctrlKey: true });
    expect(recorder().value).toBe("");
    fireEvent.keyDown(recorder(), { key: "N", code: "KeyN", ctrlKey: true, shiftKey: true });
    expect(recorder().value).toBe("Ctrl+Shift+N");
    await act(async () => fireEvent.keyDown(recorder(), { key: "Enter", code: "Enter" }));
    expect(setSetting).toHaveBeenCalledWith("shortcut", "Ctrl+Shift+N");
    expect(screen.getByText("Ctrl+Shift+N")).toBeTruthy();
    expect(recorder().value).toBe("");
  });

  it("atalho em uso: avisa no campo e mantém o antigo", async () => {
    vi.mocked(setSetting).mockRejectedValue({ code: "SHORTCUT_UNAVAILABLE", message: "x" });
    await renderScreen();
    fireEvent.keyDown(recorder(), { key: "j", code: "KeyJ", altKey: true });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Salvar atalho" })));
    expect(screen.getByRole("alert").textContent).toBe(
      "Esse atalho já está em uso por outro programa.",
    );
    expect(screen.getByText("Ctrl+Alt+K")).toBeTruthy();
    expect(recorder().value).toBe("Alt+J");
  });

  it("Esc cancela a gravação e, sem gravação, volta", async () => {
    const props = await renderScreen();
    fireEvent.keyDown(recorder(), { key: "k", code: "KeyK", ctrlKey: true, altKey: true });
    fireEvent.keyDown(recorder(), { key: "Escape", code: "Escape" });
    expect(recorder().value).toBe("");
    expect(props.onBack).not.toHaveBeenCalled();
    fireEvent.keyDown(recorder(), { key: "Escape", code: "Escape" });
    expect(props.onBack).toHaveBeenCalled();
  });

  it("restaura o atalho padrão", async () => {
    vi.mocked(getShortcutStatus).mockResolvedValue({ shortcut: "Ctrl+Super+J", registered: false });
    await renderScreen();
    expect(screen.getByText("Ctrl+Win+J")).toBeTruthy();
    expect(screen.getByText(/não registrado/)).toBeTruthy();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /Restaurar padrão/ })),
    );
    expect(setSetting).toHaveBeenCalledWith("shortcut", "Ctrl+Alt+K");
  });

  it("botão voltar volta para a nota", async () => {
    const props = await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Voltar (Esc)" }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it("mostra onde ficam os dados", async () => {
    await renderScreen();
    expect(screen.getByText("%APPDATA%\\com.anoteaki.desktop")).toBeTruthy();
    expect(screen.getByText(/Feito com Tauri \+ React/)).toBeTruthy();
  });

  it("avisa quando não consegue carregar", async () => {
    vi.mocked(getSettings).mockRejectedValue({ code: "DB_ERROR", message: "x" });
    await renderScreen();
    expect(screen.getByText("Não foi possível carregar as configurações.")).toBeTruthy();
  });
});
