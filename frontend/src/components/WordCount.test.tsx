import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WordCount } from "./WordCount";

afterEach(cleanup);

describe("WordCount", () => {
  it("conta palavras e caracteres", () => {
    render(<WordCount text="duas palavras" />);
    expect(screen.getByText("2 palavras · 13 caracteres")).toBeTruthy();
  });

  it("usa o singular", () => {
    render(<WordCount text="a" />);
    expect(screen.getByText("1 palavra · 1 caractere")).toBeTruthy();
  });

  it("espaços contam caracteres, mas não palavras", () => {
    render(<WordCount text="  oi  " />);
    expect(screen.getByText("1 palavra · 6 caracteres")).toBeTruthy();
  });

  it("nota vazia não mostra nada", () => {
    const { container } = render(<WordCount text="" />);
    expect(container.querySelector(".word-count")?.textContent).toBe("");
  });
});
