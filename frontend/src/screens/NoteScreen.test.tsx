import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteScreen, type NoteScreenProps } from "./NoteScreen";

function renderScreen(props: Partial<NoteScreenProps> = {}) {
  const all: NoteScreenProps = {
    body: "",
    onBodyChange: vi.fn(),
    onEscape: vi.fn(),
    warning: null,
    onDismissWarning: vi.fn(),
    ...props,
  };
  render(<NoteScreen {...all} />);
  return all;
}

afterEach(cleanup);

describe("NoteScreen", () => {
  it("repassa o texto digitado", () => {
    const props = renderScreen();
    fireEvent.change(screen.getByLabelText("Texto da nota"), { target: { value: "oi" } });
    expect(props.onBodyChange).toHaveBeenCalledWith("oi");
  });

  it("Esc pede para esconder a janela", () => {
    const props = renderScreen();
    fireEvent.keyDown(screen.getByLabelText("Texto da nota"), { key: "Escape" });
    expect(props.onEscape).toHaveBeenCalledOnce();
  });

  it("botões sem função ficam desabilitados", () => {
    renderScreen();
    const plus = screen.getByRole("button", { name: /Nova nota/ });
    expect(plus.getAttribute("aria-disabled")).toBe("true");
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
