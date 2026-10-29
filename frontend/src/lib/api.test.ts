import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLastNote,
  getShortcutStatus,
  hideWindow,
  isAppError,
  onWindowShown,
  saveNote,
  setSetting,
  toAppError,
} from "./api";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const invokeMock = vi.mocked(invoke);
const listenMock = vi.mocked(listen);

beforeEach(() => {
  invokeMock.mockReset();
  listenMock.mockReset();
});

describe("comandos", () => {
  it("chama o comando em snake_case com os argumentos do contrato", async () => {
    invokeMock.mockResolvedValue({ id: 1 });
    await saveNote({ id: null, body: "oi" });
    expect(invokeMock).toHaveBeenCalledWith("save_note", { id: null, body: "oi" });
  });

  it("comando sem argumentos", async () => {
    invokeMock.mockResolvedValue(undefined);
    await hideWindow();
    expect(invokeMock).toHaveBeenCalledWith("hide_window", undefined);
  });

  it("set_setting envia chave e valor", async () => {
    invokeMock.mockResolvedValue({});
    await setSetting("hideOnBlur", false);
    expect(invokeMock).toHaveBeenCalledWith("set_setting", { key: "hideOnBlur", value: false });
  });

  it("repassa o retorno", async () => {
    invokeMock.mockResolvedValue(null);
    await expect(getLastNote()).resolves.toBeNull();
  });

  it("mantém o AppError vindo do Rust", async () => {
    invokeMock.mockRejectedValue({ code: "NOT_FOUND", message: "Nota não encontrada." });
    await expect(getLastNote()).rejects.toEqual({
      code: "NOT_FOUND",
      message: "Nota não encontrada.",
    });
  });

  it("normaliza erros desconhecidos para INTERNAL", async () => {
    invokeMock.mockRejectedValue("command get_last_note not found");
    await expect(getLastNote()).rejects.toEqual({ code: "INTERNAL", message: "Falha inesperada." });
  });
});

describe("getShortcutStatus", () => {
  it("retorna o status do atalho", async () => {
    invokeMock.mockResolvedValue({ shortcut: "Ctrl+Alt+K", registered: false });
    await expect(getShortcutStatus()).resolves.toEqual({
      shortcut: "Ctrl+Alt+K",
      registered: false,
    });
    expect(invokeMock).toHaveBeenCalledWith("get_shortcut_status", undefined);
  });
});

describe("AppError", () => {
  it("reconhece só códigos do contrato", () => {
    expect(isAppError({ code: "DB_ERROR", message: "x" })).toBe(true);
    expect(isAppError({ code: "OUTRO", message: "x" })).toBe(false);
    expect(isAppError({ code: "DB_ERROR" })).toBe(false);
    expect(isAppError(null)).toBe(false);
  });

  it("toAppError não altera um AppError válido", () => {
    const error = { code: "INVALID_INPUT", message: "x" } as const;
    expect(toAppError(error)).toBe(error);
  });
});

describe("eventos", () => {
  it("window-shown entrega só o payload", async () => {
    const unlisten = vi.fn();
    listenMock.mockImplementation(async (_name, callback) => {
      callback({ event: "window-shown", id: 1, payload: { reason: "shortcut" } });
      return unlisten;
    });
    const handler = vi.fn();
    await expect(onWindowShown(handler)).resolves.toBe(unlisten);
    expect(listenMock).toHaveBeenCalledWith("window-shown", expect.any(Function));
    expect(handler).toHaveBeenCalledWith({ reason: "shortcut" });
  });
});
