import { describe, expect, it } from "vitest";
import { findLinkAt } from "./links";

describe("findLinkAt", () => {
  const text = "veja https://example.com/a?b=1 e http://foo.dev depois";

  it("acha o link em qualquer ponto dele", () => {
    const start = text.indexOf("https");
    const url = "https://example.com/a?b=1";
    expect(findLinkAt(text, start)).toBe(url);
    expect(findLinkAt(text, start + 10)).toBe(url);
    // The caret right after the last character still counts.
    expect(findLinkAt(text, start + url.length)).toBe(url);
  });

  it("acha o link certo quando há mais de um", () => {
    expect(findLinkAt(text, text.indexOf("foo"))).toBe("http://foo.dev");
  });

  it("fora de um link devolve null", () => {
    expect(findLinkAt(text, 0)).toBeNull();
    expect(findLinkAt(text, text.indexOf(" e ") + 1)).toBeNull();
    expect(findLinkAt(text, text.length)).toBeNull();
    expect(findLinkAt("", 0)).toBeNull();
  });

  it("tira a pontuação do fim da frase", () => {
    for (const end of [".", ",", ";", ":", "!", "?", ")", '"', "...", ")."]) {
      const sentence = `abra https://example.com/x${end} agora`;
      expect(findLinkAt(sentence, 8)).toBe("https://example.com/x");
    }
  });

  it("mantém o parêntese que faz parte do link", () => {
    const wiki = "https://pt.wikipedia.org/wiki/Rust_(linguagem)";
    expect(findLinkAt(`(${wiki})`, 5)).toBe(wiki);
    expect(findLinkAt(`ver ${wiki}.`, 6)).toBe(wiki);
  });

  it("para em espaço, quebra de linha, aspas e <>", () => {
    expect(findLinkAt("https://a.com\nlinha", 3)).toBe("https://a.com");
    expect(findLinkAt('"https://a.com"', 3)).toBe("https://a.com");
    expect(findLinkAt("<https://a.com>", 3)).toBe("https://a.com");
    expect(findLinkAt("https://a.com\tb", 3)).toBe("https://a.com");
  });

  it("aceita maiúsculas no esquema", () => {
    expect(findLinkAt("HTTPS://A.COM", 2)).toBe("HTTPS://A.COM");
  });

  it("ignora outros esquemas e texto solto", () => {
    expect(findLinkAt("javascript:alert(1)", 3)).toBeNull();
    expect(findLinkAt("file:///C:/x", 3)).toBeNull();
    expect(findLinkAt("ftp://a.com", 3)).toBeNull();
    expect(findLinkAt("example.com", 3)).toBeNull();
    expect(findLinkAt("https://", 3)).toBeNull();
    expect(findLinkAt("https://.", 3)).toBeNull();
  });

  it("link no meio de uma palavra sem espaço", () => {
    expect(findLinkAt("site:https://a.com/x", 8)).toBe("https://a.com/x");
  });
});
