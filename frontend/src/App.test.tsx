import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { getShortcutStatus, hideWindow, onWindowShown, type WindowShownPayload } from "./lib/api";

vi.mock("./lib/api", () => ({
  getShortcutStatus: vi.fn(),
  hideWindow: vi.fn(),
  onWindowShown: vi.fn(),
}));

let emitWindowShown: (payload: WindowShownPayload) => void = () => {};

beforeEach(() => {
  vi.mocked(getShortcutStatus).mockResolvedValue({ shortcut: "Ctrl+Alt+K", registered: true });
  vi.mocked(hideWindow).mockResolvedValue(undefined);
  vi.mocked(onWindowShown).mockImplementation(async (handler) => {
    emitWindowShown = handler;
    return () => {};
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

afterEach(cleanup);

describe("App", () => {
  it("foca o editor quando a janela aparece", async () => {
    render(<App />);
    await act(async () => {});
    act(() => emitWindowShown({ reason: "shortcut" }));
    expect(document.activeElement).toBe(screen.getByLabelText("Texto da nota"));
  });

  it("avisa quando o atalho não foi registrado", async () => {
    vi.mocked(getShortcutStatus).mockResolvedValue({ shortcut: "Ctrl+Alt+K", registered: false });
    render(<App />);
    expect((await screen.findByRole("status")).textContent).toContain("Ctrl+Alt+K");
  });

  it("não avisa quando o atalho está ativo", async () => {
    render(<App />);
    await act(async () => {});
    expect(screen.queryByRole("status")).toBeNull();
  });
});
