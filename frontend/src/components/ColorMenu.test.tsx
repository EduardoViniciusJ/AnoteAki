import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorMenu } from "./ColorMenu";

const look = { color: "yellow", opacity: 100 } as const;
const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Cor e transparência" }));

afterEach(cleanup);

describe("ColorMenu", () => {
  it("mostra 6 cores e 3 transparências, marcando as atuais", () => {
    render(<ColorMenu look={look} onChange={vi.fn()} />);
    openMenu();
    for (const name of ["Amarelo", "Rosa", "Azul", "Verde", "Lilás", "Papel"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Amarelo" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Sólido" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Amarelo" }));
  });

  it("troca a cor e a transparência", () => {
    const onChange = vi.fn();
    render(<ColorMenu look={look} onChange={onChange} />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Azul" }));
    fireEvent.click(screen.getByRole("button", { name: "70%" }));
    expect(onChange).toHaveBeenNthCalledWith(1, { color: "blue", opacity: 100 });
    expect(onChange).toHaveBeenNthCalledWith(2, { color: "yellow", opacity: 70 });
  });

  it("Esc fecha só o menu", () => {
    const onParentKey = vi.fn();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper that listens to bubbling keys
      <div onKeyDown={onParentKey}>
        <ColorMenu look={look} onChange={vi.fn()} />
      </div>,
    );
    openMenu();
    fireEvent.keyDown(screen.getByRole("button", { name: "Amarelo" }), { key: "Escape" });
    expect(screen.queryByRole("group")).toBeNull();
    expect(onParentKey).not.toHaveBeenCalled();
  });

  it("desabilitado não abre", () => {
    render(<ColorMenu look={look} onChange={vi.fn()} disabled />);
    openMenu();
    expect(screen.queryByRole("group")).toBeNull();
  });
});
