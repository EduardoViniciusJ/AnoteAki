import { describe, expect, it } from "vitest";
import { deriveTitle } from "./text";

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
