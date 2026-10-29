import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteScreen, type NoteScreenProps } from "./NoteScreen";

function renderScreen(props: Partial<NoteScreenProps> = {}) {
  const all: NoteScreenProps = {
    body: "",
    onBodyChange: vi.fn(),
    status: "idle",
    onEscape: vi.fn(),
    onNewNote: vi.fn(),
    onOpenHistory: vi.fn(),
    warning: null,
    onDismissWarning: vi.fn(),
    ...props,
  };
  render(<NoteScreen {...all} />);
  return all;
}

const editor = () => screen.getByLabelText("Texto da nota");

afterEach(cleanup);

describe("NoteScreen", () => {
  it("repassa o texto digitado", () => {
    const props = renderScreen();
    fireEvent.change(editor(), { target: { value: "oi" } });
    expect(props.onBodyChange).toHaveBeenCalledWith("oi");
  });

  it("Esc pede para esconder a janela", () => {
    const props = renderScreen();
    fireEvent.keyDown(editor(), { key: "Escape" });
    expect(props.onEscape).toHaveBeenCalledOnce();
  });

  it("Ctrl+N e o botão + criam uma nota nova", () => {
    const props = renderScreen();
    fireEvent.keyDown(editor(), { key: "n", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Nova nota/ }));
    expect(props.onNewNote).toHaveBeenCalledTimes(2);
  });

  it("Ctrl+H, Ctrl+F e o botão abrem o histórico", () => {
    const props = renderScreen();
    fireEvent.keyDown(editor(), { key: "h", ctrlKey: true });
    fireEvent.keyDown(editor(), { key: "F", ctrlKey: true, shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Histórico/ }));
    expect(props.onOpenHistory).toHaveBeenCalledTimes(3);
  });

  it("Ctrl+Alt+N não é Nova nota (AltGr no ABNT2 manda Ctrl+Alt)", () => {
    const props = renderScreen();
    fireEvent.keyDown(editor(), { key: "n", ctrlKey: true, altKey: true });
    expect(props.onNewNote).not.toHaveBeenCalled();
  });

  it("Configurações segue desabilitado", () => {
    renderScreen();
    const settings = screen.getByRole("button", { name: /Configurações/ });
    expect(settings.getAttribute("aria-disabled")).toBe("true");
  });

  it("mostra o status do salvamento", () => {
    renderScreen({ status: "error" });
    expect(screen.getByText("Erro ao salvar")).toBeTruthy();
  });

  it("nota da lixeira: editor só leitura e Restaurar", () => {
    const onRestore = vi.fn();
    renderScreen({ readOnly: true, onRestore });
    expect(editor().hasAttribute("readonly")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it("mostra o aviso e permite fechá-lo", () => {
    const props = renderScreen({ warning: "Atalho em uso" });
    expect(screen.getByRole("status").textContent).toContain("Atalho em uso");
    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(props.onDismissWarning).toHaveBeenCalledOnce();
  });

  it("sem aviso, não há toast", () => {
    renderScreen();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
