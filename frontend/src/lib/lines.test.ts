import { describe, expect, it } from "vitest";
import { duplicateLine, moveLine } from "./lines";

describe("duplicateLine", () => {
  it("duplica a linha do cursor abaixo dela", () => {
    // caret on "pão" (index 7, column 1)
    expect(duplicateLine("leite\npão\novos", 7)).toEqual({
      text: "leite\npão\npão\novos",
      selectionStart: 11,
      selectionEnd: 11,
    });
  });

  it("duplica a primeira e a última linha", () => {
    expect(duplicateLine("a\nb", 0).text).toBe("a\na\nb");
    expect(duplicateLine("a\nb", 3).text).toBe("a\nb\nb");
  });

  it("mantém o \\r de quebras do Windows na cópia", () => {
    expect(duplicateLine("a\r\nb", 0).text).toBe("a\r\na\r\nb");
  });

  it("texto vazio vira uma linha em branco", () => {
    expect(duplicateLine("", 0)).toEqual({ text: "\n", selectionStart: 1, selectionEnd: 1 });
  });
});

describe("moveLine", () => {
  it("sobe a linha do cursor", () => {
    // caret at start of "pão" (6)
    expect(moveLine("leite\npão\novos", 6, "up")).toEqual({
      text: "pão\nleite\novos",
      selectionStart: 0,
      selectionEnd: 0,
    });
  });

  it("desce a linha do cursor", () => {
    expect(moveLine("leite\npão\novos", 0, "down")).toEqual({
      text: "pão\nleite\novos",
      selectionStart: 4,
      selectionEnd: 4,
    });
  });

  it("mantém a coluna do cursor", () => {
    // caret after "pã" (8); "pão" goes up, caret follows it
    const edit = moveLine("leite\npão\novos", 8, "up");
    expect(edit?.text).toBe("pão\nleite\novos");
    expect(edit?.selectionStart).toBe(2);
  });

  it("não sai do texto na primeira e na última linha", () => {
    expect(moveLine("a\nb", 0, "up")).toBeNull();
    expect(moveLine("a\nb", 3, "down")).toBeNull();
    expect(moveLine("", 0, "up")).toBeNull();
    expect(moveLine("", 0, "down")).toBeNull();
  });

  it("desce para a última linha, sem \\n no fim", () => {
    expect(moveLine("a\nb\nc", 2, "down")?.text).toBe("a\nc\nb");
  });

  it("funciona com quebras do Windows", () => {
    expect(moveLine("a\r\nb\r\nc", 3, "up")).toEqual({
      text: "b\r\na\r\nc",
      selectionStart: 0,
      selectionEnd: 0,
    });
  });
});
