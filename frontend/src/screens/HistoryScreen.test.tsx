import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteNote,
  listNotes,
  type NoteSummary,
  purgeNote,
  restoreNote,
  searchNotes,
} from "../lib/api";
import {
  HistoryScreen,
  type HistoryScreenProps,
  PAGE_SIZE,
  SEARCH_DELAY_MS,
} from "./HistoryScreen";

vi.mock("../lib/api", () => ({
  deleteNote: vi.fn(),
  listNotes: vi.fn(),
  purgeNote: vi.fn(),
  restoreNote: vi.fn(),
  searchNotes: vi.fn(),
}));

function summary(id: number, title: string, deletedAt: string | null = null): NoteSummary {
  return {
    id,
    title,
    preview: `preview ${id}`,
    color: null,
    updatedAt: new Date().toISOString(),
    deletedAt,
  };
}

async function renderScreen(props: Partial<HistoryScreenProps> = {}) {
  const all: HistoryScreenProps = {
    onBack: vi.fn(),
    onOpenNote: vi.fn(),
    onNoteTrashed: vi.fn(),
    ...props,
  };
  render(<HistoryScreen {...all} />);
  await act(async () => {});
  return all;
}

const search = () => screen.getByLabelText<HTMLInputElement>("Buscar notas");
const item = (title: string) => screen.getByRole("button", { name: new RegExp(title) });

beforeEach(() => {
  vi.mocked(listNotes).mockResolvedValue([summary(1, "Alfa"), summary(2, "Beta")]);
  vi.mocked(searchNotes).mockResolvedValue([]);
  vi.mocked(deleteNote).mockResolvedValue(undefined);
  vi.mocked(purgeNote).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HistoryScreen", () => {
  it("foca a busca e lista as notas ativas agrupadas por dia", async () => {
    await renderScreen();
    expect(document.activeElement).toBe(search());
    expect(listNotes).toHaveBeenCalledWith({ scope: "active", limit: PAGE_SIZE, offset: 0 });
    const today = screen.getByRole("region", { name: "Hoje" });
    expect(within(today).getAllByRole("listitem")).toHaveLength(2);
  });

  it("conteúdo da nota é texto, nunca HTML", async () => {
    vi.mocked(listNotes).mockResolvedValue([summary(1, "<img src=x onerror=alert(1)>")]);
    await renderScreen();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("navega só com o teclado: ↓ entra na lista, ↑/↓ movem, Enter abre", async () => {
    const props = await renderScreen();
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    expect(document.activeElement).toBe(item("Alfa"));
    fireEvent.keyDown(item("Alfa"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(item("Beta"));
    expect(item("Beta").tabIndex).toBe(0);
    expect(item("Alfa").tabIndex).toBe(-1);
    fireEvent.keyDown(item("Beta"), { key: "ArrowUp" });
    fireEvent.keyDown(item("Alfa"), { key: "ArrowUp" });
    expect(document.activeElement).toBe(search());
    fireEvent.click(item("Beta"));
    expect(props.onOpenNote).toHaveBeenCalledWith(2);
  });

  it("busca com debounce de 200 ms, em lista plana", async () => {
    vi.useFakeTimers();
    vi.mocked(searchNotes).mockResolvedValue([summary(3, "Ação")]);
    await renderScreen();
    fireEvent.change(search(), { target: { value: "  acao " } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS - 1);
    });
    expect(searchNotes).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(searchNotes).toHaveBeenCalledExactlyOnceWith({ query: "acao", limit: PAGE_SIZE });
    expect(screen.queryByRole("region", { name: "Hoje" })).toBeNull();
    expect(item("Ação")).toBeTruthy();
  });

  it("busca sem resultado", async () => {
    vi.useFakeTimers();
    await renderScreen();
    fireEvent.change(search(), { target: { value: "zzz" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);
    });
    expect(screen.getByText("Nenhuma nota encontrada.")).toBeTruthy();
  });

  it("Esc limpa a busca primeiro e só depois volta", async () => {
    const props = await renderScreen();
    fireEvent.change(search(), { target: { value: "x" } });
    fireEvent.keyDown(search(), { key: "Escape" });
    expect(search().value).toBe("");
    expect(props.onBack).not.toHaveBeenCalled();
    fireEvent.keyDown(search(), { key: "Escape" });
    expect(props.onBack).toHaveBeenCalledOnce();
  });

  it("Delete manda para a lixeira, avisa a tela Nota e oferece Desfazer", async () => {
    vi.mocked(restoreNote).mockResolvedValue({
      id: 1,
      title: "Alfa",
      body: "Alfa",
      color: null,
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    });
    const props = await renderScreen();
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    await act(async () => {
      fireEvent.keyDown(item("Alfa"), { key: "Delete" });
    });
    expect(deleteNote).toHaveBeenCalledWith(1);
    expect(props.onNoteTrashed).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("button", { name: /Alfa/ })).toBeNull();
    expect(document.activeElement).toBe(item("Beta"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    });
    expect(restoreNote).toHaveBeenCalledWith(1);
  });

  it("o Desfazer some depois de 5 s", async () => {
    vi.useFakeTimers();
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Excluir/ })[0] as HTMLElement);
    });
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.queryByRole("button", { name: "Desfazer" })).toBeNull();
  });

  it("lixeira: restaurar e excluir para sempre com confirmação", async () => {
    vi.mocked(listNotes).mockImplementation(async ({ scope }) =>
      scope === "trash" ? [summary(5, "Velha", "x"), summary(6, "Antiga", "x")] : [],
    );
    vi.mocked(restoreNote).mockResolvedValue({
      id: 5,
      title: "Velha",
      body: "Velha",
      color: null,
      createdAt: "",
      updatedAt: "",
      deletedAt: null,
    });
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Lixeira" }));
    });
    expect(listNotes).toHaveBeenLastCalledWith({ scope: "trash", limit: PAGE_SIZE, offset: 0 });
    expect(search().disabled).toBe(true);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Restaurar" })[0] as HTMLElement);
    });
    expect(restoreNote).toHaveBeenCalledWith(5);
    expect(screen.queryByRole("button", { name: /Velha/ })).toBeNull();

    fireEvent.focus(item("Antiga"));
    fireEvent.keyDown(item("Antiga"), { key: "Delete" });
    const dialog = screen.getByRole("alertdialog");
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(purgeNote).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
    });
    expect(purgeNote).toHaveBeenCalledWith(6);
    expect(screen.getByText("A lixeira está vazia.")).toBeTruthy();
  });

  it("Esc no diálogo cancela sem sair da tela", async () => {
    vi.mocked(listNotes).mockResolvedValue([summary(5, "Velha", "x")]);
    const props = await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Lixeira" }));
    });
    fireEvent.keyDown(item("Velha"), { key: "Delete" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Cancelar" }), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(props.onBack).not.toHaveBeenCalled();
    expect(purgeNote).not.toHaveBeenCalled();
  });

  it("pagina ao chegar no fim da lista", async () => {
    const page = Array.from({ length: PAGE_SIZE }, (_, i) => summary(i + 1, `Nota ${i + 1}`));
    vi.mocked(listNotes)
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([summary(99, "Última")]);
    await renderScreen();
    await act(async () => {
      fireEvent.keyDown(search(), { key: "ArrowDown" });
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: "End" });
    });
    expect(listNotes).toHaveBeenLastCalledWith({
      scope: "active",
      limit: PAGE_SIZE,
      offset: PAGE_SIZE,
    });
    expect(item("Última")).toBeTruthy();
  });

  it("estado de erro com nova tentativa", async () => {
    vi.mocked(listNotes).mockRejectedValueOnce({ code: "DB_ERROR", message: "x" });
    await renderScreen();
    expect(screen.getByText(/Não foi possível carregar/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    });
    expect(item("Alfa")).toBeTruthy();
  });
});
