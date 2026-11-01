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

const shortcutSelect = () => screen.getByRole("button", { name: "Atalho global" });
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
    expect(checkbox(screen.getByLabelText(/Modo foco/)).checked).toBe(true);
    expect(shortcutSelect().textContent).toContain("Ctrl+Alt+K (padrão)");
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

  it("salva o modo foco", async () => {
    await renderScreen();
    await act(async () => fireEvent.click(screen.getByLabelText(/Modo foco/)));
    expect(setSetting).toHaveBeenCalledWith("focusMode", true);
    expect(checkbox(screen.getByLabelText(/Modo foco/)).checked).toBe(true);
  });

  it("mostra um aviso quando não consegue salvar", async () => {
    vi.mocked(setSetting).mockRejectedValue({ code: "DB_ERROR", message: "x" });
    await renderScreen();
    await act(async () => fireEvent.click(screen.getByLabelText(/Modo foco/)));
    expect(screen.getByText("Não foi possível salvar a configuração.")).toBeTruthy();
    expect(checkbox(screen.getByLabelText(/Modo foco/)).checked).toBe(false);
  });

  it("escolhe um atalho novo na lista", async () => {
    await renderScreen();
    fireEvent.click(shortcutSelect());
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ctrl+Shift+K" })));
    expect(setSetting).toHaveBeenCalledWith("shortcut", "Ctrl+Shift+K");
    expect(shortcutSelect().textContent).toContain("Ctrl+Shift+K");
  });

  it("atalho em uso: avisa e mantém o antigo", async () => {
    vi.mocked(setSetting).mockRejectedValue({ code: "SHORTCUT_UNAVAILABLE", message: "x" });
    await renderScreen();
    fireEvent.click(shortcutSelect());
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ctrl+Alt+A" })));
    expect(screen.getByRole("alert").textContent).toBe(
      "Esse atalho já está em uso por outro programa.",
    );
    expect(shortcutSelect().textContent).toContain("Ctrl+Alt+K (padrão)");
  });

  it("atalho fora da lista vira opção e o padrão pode voltar", async () => {
    vi.mocked(getShortcutStatus).mockResolvedValue({ shortcut: "Ctrl+Super+J", registered: false });
    await renderScreen();
    expect(shortcutSelect().textContent).toContain("Ctrl+Super+J");
    expect(screen.getByRole("alert").textContent).toContain("O Windows recusou");
    fireEvent.click(shortcutSelect());
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Ctrl+Alt+K (padrão)" })),
    );
    expect(setSetting).toHaveBeenCalledWith("shortcut", "Ctrl+Alt+K");
  });

  it("Esc volta para a nota", async () => {
    const props = await renderScreen();
    fireEvent.keyDown(shortcutSelect(), { key: "Escape" });
    expect(props.onBack).toHaveBeenCalled();
  });

  it("botão voltar volta para a nota", async () => {
    const props = await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Voltar (Esc)" }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it("avisa quando não consegue carregar", async () => {
    vi.mocked(getSettings).mockRejectedValue({ code: "DB_ERROR", message: "x" });
    await renderScreen();
    expect(screen.getByText("Não foi possível carregar as configurações.")).toBeTruthy();
  });
});
