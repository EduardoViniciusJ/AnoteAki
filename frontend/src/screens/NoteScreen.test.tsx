import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteScreen, type NoteScreenProps } from "./NoteScreen";

function renderScreen(props: Partial<NoteScreenProps> = {}) {
  const all: NoteScreenProps = {
    heading: "",
    onHeadingChange: vi.fn(),
    body: "",
    onBodyChange: vi.fn(),
    look: { color: "yellow", opacity: 100 },
    onLookChange: vi.fn(),
    status: "idle",
    onEscape: vi.fn(),
    onNewNote: vi.fn(),
    onClose: vi.fn(),
    onCopy: vi.fn(),
    onCopyMarkdown: vi.fn(),
    onOpenHistory: vi.fn(),
    onTitleSubmit: vi.fn(),
    warning: null,
    onDismissWarning: vi.fn(),
    ...props,
  };
  render(<NoteScreen {...all} />);
  return all;
}

const editor = () => screen.getByLabelText("Texto da nota");
const title = () => screen.getByLabelText("Título da nota");

afterEach(cleanup);

describe("NoteScreen", () => {
  it("repassa o texto e o título digitados", () => {
    const props = renderScreen();
    fireEvent.change(editor(), { target: { value: "oi" } });
    fireEvent.change(title(), { target: { value: "Plano" } });
    expect(props.onBodyChange).toHaveBeenCalledWith("oi");
    expect(props.onHeadingChange).toHaveBeenCalledWith("Plano");
  });

  it("o título vem antes do texto na ordem do Tab", () => {
    renderScreen();
    const position = title().compareDocumentPosition(editor());
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Enter no título vai para o texto", () => {
    const props = renderScreen();
    fireEvent.keyDown(title(), { key: "Enter" });
    expect(props.onTitleSubmit).toHaveBeenCalledOnce();
  });

  it("Esc pede para esconder os post-its", () => {
    const props = renderScreen();
    fireEvent.keyDown(editor(), { key: "Escape" });
    expect(props.onEscape).toHaveBeenCalledOnce();
  });

  it("Ctrl+N e o botão + abrem um post-it novo", () => {
    const props = renderScreen();
    fireEvent.keyDown(editor(), { key: "n", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Nova nota/ }));
    expect(props.onNewNote).toHaveBeenCalledTimes(2);
  });

  it("Ctrl+W e o botão × fecham o post-it", () => {
    const props = renderScreen();
    fireEvent.keyDown(title(), { key: "w", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Fechar post-it/ }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
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

  it("mostra o status do salvamento", () => {
    renderScreen({ status: "error" });
    expect(screen.getByText("Erro ao salvar")).toBeTruthy();
  });

  it("nota da lixeira: título e texto só leitura, cor bloqueada e Restaurar", () => {
    const onRestore = vi.fn();
    renderScreen({ readOnly: true, onRestore });
    expect(editor().hasAttribute("readonly")).toBe(true);
    expect(title().hasAttribute("readonly")).toBe(true);
    const palette = screen.getByRole("button", { name: "Cor e transparência" });
    expect(palette.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it("mostra o aviso e permite fechá-lo", () => {
    const props = renderScreen({ warning: "Atalho em uso" });
    expect(screen.getByRole("status").textContent).toContain("Atalho em uso");
    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    expect(props.onDismissWarning).toHaveBeenCalledOnce();
  });

  it("o menu copiar oferece texto e Markdown", () => {
    const props = renderScreen({ body: "leite" });
    fireEvent.click(screen.getByRole("button", { name: "Copiar nota" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Copiar texto/ }));
    expect(props.onCopy).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copiar nota" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Copiar como Markdown/ }));
    expect(props.onCopyMarkdown).toHaveBeenCalledOnce();
  });

  it("Ctrl+Shift+C copia; Ctrl+C sozinho fica com o texto selecionado", () => {
    const props = renderScreen({ heading: "Compras" });
    fireEvent.keyDown(editor(), { key: "c", ctrlKey: true });
    expect(props.onCopy).not.toHaveBeenCalled();
    fireEvent.keyDown(editor(), { key: "C", ctrlKey: true, shiftKey: true });
    expect(props.onCopy).toHaveBeenCalledOnce();
    fireEvent.keyDown(editor(), { key: "M", ctrlKey: true, shiftKey: true });
    expect(props.onCopyMarkdown).toHaveBeenCalledOnce();
  });

  it("nota vazia não copia", () => {
    const props = renderScreen({ heading: " ", body: "\n" });
    const button = screen.getByRole("button", { name: "Copiar nota (nota vazia)" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.keyDown(editor(), { key: "C", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(editor(), { key: "M", ctrlKey: true, shiftKey: true });
    expect(props.onCopy).not.toHaveBeenCalled();
    expect(props.onCopyMarkdown).not.toHaveBeenCalled();
  });

  it("mostra a confirmação", () => {
    renderScreen({ body: "x", notice: "Copiado" });
    expect(screen.getByRole("status").textContent).toContain("Copiado");
  });
});
