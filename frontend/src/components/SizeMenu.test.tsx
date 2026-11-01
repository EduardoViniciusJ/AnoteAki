import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SizeMenu } from "./SizeMenu";

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Tamanho do post-it" }));
const panel = () => screen.queryByRole("group", { name: "Tamanho do post-it" });

afterEach(cleanup);

describe("SizeMenu", () => {
  it("mostra os 3 tamanhos e foca o primeiro", () => {
    render(<SizeMenu onChange={vi.fn()} />);
    expect(panel()).toBeNull();
    openMenu();
    for (const name of ["Pequeno", "Médio", "Grande"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Pequeno" }));
  });

  it("escolher um tamanho avisa e fecha o menu", () => {
    const onChange = vi.fn();
    render(<SizeMenu onChange={onChange} />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Grande" }));
    expect(onChange).toHaveBeenCalledWith("large");
    expect(panel()).toBeNull();
  });

  it("Esc fecha só o menu", () => {
    const onParentKey = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper that listens to bubbling keys
      <div onKeyDown={onParentKey}>
        <SizeMenu onChange={vi.fn()} />
      </div>,
    );
    openMenu();
    fireEvent.keyDown(screen.getByRole("button", { name: "Médio" }), { key: "Escape" });
    expect(panel()).toBeNull();
    expect(onParentKey).not.toHaveBeenCalled();
  });

  it("clicar fora fecha o menu", () => {
    render(<SizeMenu onChange={vi.fn()} />);
    openMenu();
    fireEvent.pointerDown(document.body);
    expect(panel()).toBeNull();
  });
});
