import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectMenu } from "./SelectMenu";

const OPTIONS = [
  { value: "updated", label: "Editadas" },
  { value: "title", label: "Título (A–Z)" },
];

function renderMenu(disabled = false) {
  const onChange = vi.fn();
  render(
    <SelectMenu
      label="Ordenar"
      value="updated"
      options={OPTIONS}
      onChange={onChange}
      disabled={disabled}
    />,
  );
  return onChange;
}

const toggle = () => screen.getByRole("button", { name: "Ordenar" });

afterEach(cleanup);

describe("SelectMenu", () => {
  it("mostra o rótulo atual e escolhe outra opção com um clique", () => {
    const onChange = renderMenu();
    expect(toggle().textContent).toContain("Editadas");
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("button", { name: "Título (A–Z)" }));
    expect(onChange).toHaveBeenCalledWith("title");
    // The menu closes after choosing.
    expect(screen.queryByRole("button", { name: "Título (A–Z)" })).toBeNull();
  });

  it("abre com o foco na opção atual e Esc fecha sem escolher", () => {
    const onChange = renderMenu();
    fireEvent.click(toggle());
    const current = screen.getByRole("button", { name: "Editadas" });
    expect(document.activeElement).toBe(current);
    fireEvent.keyDown(current, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Editadas" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("setas movem o foco entre as opções", () => {
    renderMenu();
    fireEvent.click(toggle());
    fireEvent.keyDown(screen.getByRole("button", { name: "Editadas" }), { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Título (A–Z)" }));
  });

  it("desabilitado não abre", () => {
    renderMenu(true);
    fireEvent.click(toggle());
    expect(screen.queryByRole("button", { name: "Editadas" })).toBeNull();
  });
});
