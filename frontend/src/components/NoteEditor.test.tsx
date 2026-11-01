import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteEditor } from "./NoteEditor";

function renderEditor(value: string, readOnly = false) {
  const onChange = vi.fn();
  render(<NoteEditor value={value} onChange={onChange} readOnly={readOnly} />);
  return onChange;
}

const editor = () => screen.getByLabelText<HTMLTextAreaElement>("Texto da nota");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
    // The DOM already holds "pão\nleite"; Alt+↓ on line 1 swaps them back.
    onChange.mockClear();
    editor().setSelectionRange(0, 0);
    fireEvent.keyDown(editor(), { key: "ArrowDown", altKey: true });
    expect(onChange).toHaveBeenCalledWith("leite\npão");
  });

  it("Alt+↑ segurado move a mesma linha duas vezes (caret acompanha)", () => {
    // The DOM is updated before the next keydown, so a held key keeps
    // moving the same line even before React re-renders.
    const onChange = renderEditor("a\nb\nfoco");
    editor().setSelectionRange(4, 4);
    fireEvent.keyDown(editor(), { key: "ArrowUp", altKey: true });
    fireEvent.keyDown(editor(), { key: "ArrowUp", altKey: true });
    expect(onChange).toHaveBeenLastCalledWith("foco\na\nb");
    expect(editor().selectionStart).toBe(0);
  });

  it("Alt+↑ na primeira linha não muda nada", () => {
    const onChange = renderEditor("leite\npão");
    editor().setSelectionRange(0, 0);
    fireEvent.keyDown(editor(), { key: "ArrowUp", altKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("AltGr (Ctrl+Alt) não dispara os atalhos", () => {
    const onChange = renderEditor("leite");
    fireEvent.keyDown(editor(), { key: "d", ctrlKey: true, altKey: true });
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
