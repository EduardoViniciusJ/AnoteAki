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
    onOpenSettings: vi.fn(),
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

  it("os botões copiar são independentes", () => {
    const props = renderScreen({ body: "leite" });
    fireEvent.click(screen.getByRole("button", { name: "Copiar texto (Ctrl+Shift+C)" }));
    expect(props.onCopy).toHaveBeenCalledOnce();
    expect(props.onCopyMarkdown).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Copiar como Markdown (Ctrl+Shift+M)" }));
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
    for (const name of ["Copiar texto (nota vazia)", "Copiar como Markdown (nota vazia)"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(button);
    }
    fireEvent.keyDown(editor(), { key: "C", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(editor(), { key: "M", ctrlKey: true, shiftKey: true });
    expect(props.onCopy).not.toHaveBeenCalled();
    expect(props.onCopyMarkdown).not.toHaveBeenCalled();
  });

  it("mostra a confirmação", () => {
    renderScreen({ body: "x", notice: "Copiado" });
    expect(screen.getByRole("status").textContent).toContain("Copiado");
  });

  it("abre as configurações pelo botão e por Ctrl+,", () => {
    const props = renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Configurações (Ctrl+,)" }));
    fireEvent.keyDown(editor(), { key: ",", ctrlKey: true });
    expect(props.onOpenSettings).toHaveBeenCalledTimes(2);
  });

  it("aviso com ação leva às configurações", () => {
    const onClick = vi.fn();
    renderScreen({ warning: "Atalho em uso", warningAction: { label: "Configurações", onClick } });
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    expect(onClick).toHaveBeenCalled();
  });

  describe("modo foco", () => {
    const toolbar = () => document.querySelector(".note-screen__toolbar");
    const footer = () => document.querySelector(".note-screen__footer");
    const faded = () =>
      Boolean(toolbar()?.classList.contains("is-faded")) &&
      Boolean(footer()?.classList.contains("is-faded"));

    it("esconde a barra e o rodapé ao digitar", () => {
      renderScreen({ focusMode: true });
      expect(faded()).toBe(false);
      fireEvent.change(editor(), { target: { value: "a" } });
      expect(faded()).toBe(true);
    });

    it("mostra de novo ao mover o mouse", () => {
      renderScreen({ focusMode: true });
      fireEvent.change(editor(), { target: { value: "a" } });
      fireEvent.mouseMove(editor());
      expect(faded()).toBe(false);
    });

    it("mostra de novo quando o editor perde o foco", () => {
      renderScreen({ focusMode: true });
      fireEvent.change(editor(), { target: { value: "a" } });
      fireEvent.blur(editor());
      expect(faded()).toBe(false);
    });

    it("desligado: nada some ao digitar", () => {
      renderScreen();
      fireEvent.change(editor(), { target: { value: "a" } });
      expect(toolbar()?.classList.contains("is-faded")).toBe(false);
    });
  });
});
