import { describe, expect, it } from "vitest";
import { deriveTitle, noteAsMarkdown, noteAsText } from "./text";

describe("deriveTitle", () => {
  it("usa a primeira linha não vazia", () => {
    expect(deriveTitle("\n  Compras  \nleite")).toBe("Compras");
  });

  it("aceita quebras de linha do Windows", () => {
    expect(deriveTitle("\r\nIdeia\r\nresto")).toBe("Ideia");
  });

  it("retorna vazio para nota em branco", () => {
    expect(deriveTitle("  \n\t")).toBe("");
  });
});

describe("noteAsText", () => {
  it("junta título e texto com uma linha em branco", () => {
    expect(noteAsText(" Compras ", "leite\npão\n")).toBe("Compras\n\nleite\npão");
  });

  it("sem título, copia só o texto", () => {
    expect(noteAsText("", "  ideia  ")).toBe("ideia");
  });

  it("só com título, copia o título", () => {
    expect(noteAsText("Ligar", "  ")).toBe("Ligar");
  });

  it("nota em branco vira texto vazio", () => {
    expect(noteAsText(" ", "\n")).toBe("");
  });
});

describe("noteAsMarkdown", () => {
  it("o título vira um heading", () => {
    expect(noteAsMarkdown(" Compras ", "leite\npão")).toBe("# Compras\n\nleite\npão");
  });

  it("sem título, só o texto", () => {
    expect(noteAsMarkdown("", "ideia")).toBe("ideia");
  });

  it("só com título, só o heading", () => {
    expect(noteAsMarkdown("Ligar", " ")).toBe("# Ligar");
  });
});
