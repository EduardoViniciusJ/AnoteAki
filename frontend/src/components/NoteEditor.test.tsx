import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteEditor } from "./NoteEditor";

function renderEditor(value: string, readOnly = false) {
  const onChange = vi.fn();
  render(<NoteEditor value={value} onChange={onChange} readOnly={readOnly} />);
  return onChange;
}

const editor = () => screen.getByLabelText<HTMLTextAreaElement>("Texto da nota");

beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("NoteEditor shortcuts", () => {
  it("Ctrl+D duplica a linha do cursor", () => {
    const onChange = renderEditor("leite\npão\novos");
    editor().setSelectionRange(7, 7);
    fireEvent.keyDown(editor(), { key: "d", ctrlKey: true });
    expect(onChange).toHaveBeenCalledWith("leite\npão\npão\novos");
    expect(editor().selectionStart).toBe(11);
  });

  it("Alt+↑ sobe a linha; Alt+↓ desce", () => {
    const onChange = renderEditor("leite\npão");
    editor().setSelectionRange(6, 6);
    fireEvent.keyDown(editor(), { key: "ArrowUp", altKey: true });
    expect(onChange).toHaveBeenCalledWith("pão\nleite");
    onChange.mockClear();
    editor().setSelectionRange(0, 0);
    fireEvent.keyDown(editor(), { key: "ArrowDown", altKey: true });
    expect(onChange).toHaveBeenCalledWith("pão\nleite");
  });

  it("Alt+↑ na primeira linha não muda nada", () => {
    const onChange = renderEditor("leite\npão");
    editor().setSelectionRange(0, 0);
    fireEvent.keyDown(editor(), { key: "ArrowUp", altKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Ctrl+; insere a data e a hora no cursor", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 14, 5));
    const onChange = renderEditor("a\nb");
    editor().setSelectionRange(1, 1);
    fireEvent.keyDown(editor(), { key: ";", ctrlKey: true });
    expect(onChange).toHaveBeenCalledWith("a31/10/2026 14:05\nb");
  });

  it("Ctrl+; prefere a inserção nativa quando ela existe (desfazer continua)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 14, 5));
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
    const onChange = renderEditor("");
    fireEvent.keyDown(editor(), { key: ";", ctrlKey: true });
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "31/10/2026 14:05");
    expect(onChange).not.toHaveBeenCalled();
    Reflect.deleteProperty(document, "execCommand");
  });

  it("AltGr (Ctrl+Alt) não dispara os atalhos", () => {
    const onChange = renderEditor("leite");
    fireEvent.keyDown(editor(), { key: "d", ctrlKey: true, altKey: true });
    fireEvent.keyDown(editor(), { key: ";", ctrlKey: true, altKey: true });
    fireEvent.keyDown(editor(), { key: "ArrowUp", altKey: true, ctrlKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("nota somente leitura ignora os atalhos", () => {
    const onChange = renderEditor("leite\npão", true);
    fireEvent.keyDown(editor(), { key: "d", ctrlKey: true });
    fireEvent.keyDown(editor(), { key: "ArrowDown", altKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });
});
