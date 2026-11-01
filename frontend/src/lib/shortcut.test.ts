import { describe, expect, it } from "vitest";
import { displayShortcut, type KeyCombo, shortcutFromKeys } from "./shortcut";

function combo(code: string, mods: Partial<KeyCombo> = {}): KeyCombo {
  return { code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods };
}

describe("shortcutFromKeys", () => {
  it("builds the accelerator with modifiers in a fixed order", () => {
    expect(shortcutFromKeys(combo("KeyN", { shiftKey: true, ctrlKey: true }))).toBe("Ctrl+Shift+N");
    expect(
      shortcutFromKeys(
        combo("Digit1", { metaKey: true, altKey: true, ctrlKey: true, shiftKey: true }),
      ),
    ).toBe("Ctrl+Alt+Shift+Super+1");
  });

  it("names function keys, numpad and arrows the way the plugin expects", () => {
    expect(shortcutFromKeys(combo("F12", { altKey: true }))).toBe("Alt+F12");
    expect(shortcutFromKeys(combo("Numpad5", { ctrlKey: true }))).toBe("Ctrl+Num5");
    expect(shortcutFromKeys(combo("ArrowUp", { ctrlKey: true }))).toBe("Ctrl+Up");
    expect(shortcutFromKeys(combo("Space", { metaKey: true }))).toBe("Super+Space");
  });

  it("needs a modifier and a usable main key", () => {
    expect(shortcutFromKeys(combo("KeyK"))).toBeNull();
    expect(shortcutFromKeys(combo("ControlLeft", { ctrlKey: true }))).toBeNull();
    expect(shortcutFromKeys(combo("ShiftRight", { shiftKey: true, ctrlKey: true }))).toBeNull();
    expect(shortcutFromKeys(combo("ContextMenu", { ctrlKey: true }))).toBeNull();
    expect(shortcutFromKeys(combo("F25", { ctrlKey: true }))).toBeNull();
  });
});

describe("displayShortcut", () => {
  it("shows the Windows key as Win", () => {
    expect(displayShortcut("Ctrl+Super+K")).toBe("Ctrl+Win+K");
    expect(displayShortcut("Ctrl+Alt+K")).toBe("Ctrl+Alt+K");
  });
});
