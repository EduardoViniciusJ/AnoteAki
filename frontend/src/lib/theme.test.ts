import { afterEach, describe, expect, it } from "vitest";
import { applyEditorFont, applyTheme, playOpen } from "./theme";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.documentElement.removeAttribute("style");
});

describe("applyTheme", () => {
  it("sets the theme on the root element", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("system");
  });
});

describe("applyEditorFont", () => {
  it("sets a local font stack for the editor", () => {
    const font = () => document.documentElement.style.getPropertyValue("--font-editor");
    applyEditorFont("mono");
    expect(font()).toContain("Consolas");
    applyEditorFont("serif");
    expect(font()).toContain("Georgia");
    applyEditorFont("inter");
    expect(font()).toBe("var(--font-ui)");
  });
});

describe("playOpen", () => {
  it("adds the opening class, also when it is already there", () => {
    const element = document.createElement("main");
    playOpen(element);
    expect(element.classList.contains("is-opening")).toBe(true);
    playOpen(element);
    expect(element.classList.contains("is-opening")).toBe(true);
  });

  it("ignores a missing element", () => {
    expect(() => playOpen(null)).not.toThrow();
  });
});
