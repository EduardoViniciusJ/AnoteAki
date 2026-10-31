import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteNote,
  emptyTrash,
  getNote,
  listNotes,
  type Note,
  type NoteSummary,
  purgeNote,
  restoreNote,
  searchNotes,
  setNotePinned,
} from "../lib/api";
import {
  HistoryScreen,
  type HistoryScreenProps,
  PAGE_SIZE,
  PREVIEW_DELAY_MS,
  SEARCH_DELAY_MS,
} from "./HistoryScreen";

vi.mock("../lib/api", () => ({
  deleteNote: vi.fn(),
  emptyTrash: vi.fn(),
  getNote: vi.fn(),
  listNotes: vi.fn(),
  purgeNote: vi.fn(),
  restoreNote: vi.fn(),
  searchNotes: vi.fn(),
  setNotePinned: vi.fn(),
}));

function summary(
  id: number,
  title: string,
  deletedAt: string | null = null,
  pinned = false,
): NoteSummary {
  return {
    id,
    title,
    preview: `preview ${id}`,
    color: null,
    pinned,
    updatedAt: new Date().toISOString(),
    deletedAt,
  };
}

function fullNote(id: number, heading: string, body: string): Note {
  return {
    id,
    title: heading || body,
    heading,
    body,
    color: null,
    opacity: 100,
    pinned: false,
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

/** First `list_notes` call of a screen: default filters. */
const firstPage = {
  scope: "active",
  color: undefined,
  sort: "updated",
  limit: PAGE_SIZE,
  offset: 0,
};

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
  vi.mocked(getNote).mockResolvedValue(fullNote(1, "", "corpo da prévia"));
  vi.mocked(setNotePinned).mockResolvedValue(fullNote(1, "", "x"));
  vi.mocked(emptyTrash).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("HistoryScreen", () => {
  it("foca a busca e lista as notas ativas agrupadas por dia", async () => {
    await renderScreen();
    expect(document.activeElement).toBe(search());
    expect(listNotes).toHaveBeenCalledWith(firstPage);
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
    vi.mocked(restoreNote).mockResolvedValue(fullNote(1, "", "Alfa"));
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
    vi.mocked(restoreNote).mockResolvedValue(fullNote(5, "", "Velha"));
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Lixeira" }));
    });
    expect(listNotes).toHaveBeenLastCalledWith({
      scope: "trash",
      color: undefined,
      sort: "updated",
      limit: PAGE_SIZE,
      offset: 0,
    });
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
      color: undefined,
      sort: "updated",
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

  it("notas fixadas ficam no grupo Fixadas; o botão fixa e desfixa", async () => {
    vi.mocked(listNotes).mockResolvedValue([summary(1, "Alfa", null, true), summary(2, "Beta")]);
    await renderScreen();
    const pinnedGroup = screen.getByRole("region", { name: "Fixadas" });
    expect(within(pinnedGroup).getByRole("button", { name: /Alfa/ })).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Hoje" })).queryByRole("button", { name: /Alfa/ }),
    ).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Fixar (P)" }));
    });
    expect(setNotePinned).toHaveBeenCalledWith(2, true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Desafixar (P)" }));
    });
    expect(setNotePinned).toHaveBeenCalledWith(1, false);
  });

  it("copiar pelo item põe título + texto na área de transferência", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.mocked(getNote).mockResolvedValue(fullNote(1, "Compras", "leite"));
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Copiar (C)" })[0] as HTMLElement);
    });
    expect(getNote).toHaveBeenCalledWith(1);
    expect(writeText).toHaveBeenCalledWith("Compras\n\nleite");
    expect(screen.getByRole("status").textContent).toContain("Copiado");
  });

  it("filtro por cor refaz a lista e desliga ao clicar de novo", async () => {
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Filtrar por amarelo" }));
    });
    expect(listNotes).toHaveBeenLastCalledWith({ ...firstPage, color: "yellow" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Filtrar por amarelo" }));
    });
    expect(listNotes).toHaveBeenLastCalledWith(firstPage);
  });

  it("ordenar por título lista plana, sem grupos por dia", async () => {
    await renderScreen();
    await act(async () => {
      fireEvent.change(screen.getByRole("combobox", { name: "Ordenar" }), {
        target: { value: "title" },
      });
    });
    expect(listNotes).toHaveBeenLastCalledWith({ ...firstPage, sort: "title" });
    expect(screen.queryByRole("region", { name: "Hoje" })).toBeNull();
    expect(item("Alfa")).toBeTruthy();
  });

  it("Ctrl+clique seleciona várias e a barra exclui todas", async () => {
    const props = await renderScreen();
    fireEvent.click(item("Alfa"), { ctrlKey: true });
    fireEvent.click(item("Beta"), { ctrlKey: true });
    expect(props.onOpenNote).not.toHaveBeenCalled();
    const bar = screen.getByRole("toolbar", { name: "Notas selecionadas" });
    expect(bar.textContent).toContain("2 selecionadas");
    await act(async () => {
      fireEvent.click(within(bar).getByRole("button", { name: "Excluir (2)" }));
    });
    expect(deleteNote).toHaveBeenCalledWith(1);
    expect(deleteNote).toHaveBeenCalledWith(2);
    expect(props.onNoteTrashed).toHaveBeenCalledTimes(2);
  });

  it("Espaço seleciona pelo teclado e Esc limpa antes de voltar", async () => {
    const props = await renderScreen();
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    fireEvent.keyDown(item("Alfa"), { key: " " });
    expect(screen.getByRole("toolbar", { name: "Notas selecionadas" }).textContent).toContain(
      "1 selecionada",
    );
    fireEvent.keyDown(item("Alfa"), { key: "Escape" });
    expect(screen.queryByRole("toolbar", { name: "Notas selecionadas" })).toBeNull();
    expect(props.onBack).not.toHaveBeenCalled();
    fireEvent.keyDown(item("Alfa"), { key: "Escape" });
    expect(props.onBack).toHaveBeenCalledOnce();
  });

  it("lixeira: selecionar e restaurar várias", async () => {
    vi.mocked(listNotes).mockImplementation(async ({ scope }) =>
      scope === "trash" ? [summary(5, "Velha", "x"), summary(6, "Antiga", "x")] : [],
    );
    vi.mocked(restoreNote).mockResolvedValue(fullNote(5, "", "Velha"));
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Lixeira" }));
    });
    fireEvent.click(item("Velha"), { ctrlKey: true });
    fireEvent.click(item("Antiga"), { ctrlKey: true });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Restaurar (2)" }));
    });
    expect(restoreNote).toHaveBeenCalledWith(5);
    expect(restoreNote).toHaveBeenCalledWith(6);
  });

  it("esvaziar a lixeira pede confirmação", async () => {
    vi.mocked(listNotes).mockImplementation(async ({ scope }) =>
      scope === "trash" ? [summary(5, "Velha", "x")] : [],
    );
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Lixeira" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Esvaziar lixeira" }));
    expect(emptyTrash).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("Esvaziar a lixeira?");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Esvaziar" }));
    });
    expect(emptyTrash).toHaveBeenCalledOnce();
  });

  it("prévia aparece depois de focar um item por 400 ms", async () => {
    vi.useFakeTimers();
    await renderScreen();
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    expect(screen.queryByRole("note", { name: "Prévia" })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PREVIEW_DELAY_MS);
    });
    const preview = screen.getByRole("note", { name: "Prévia" });
    expect(preview.textContent).toContain("corpo da prévia");
    fireEvent.keyDown(item("Alfa"), { key: "Escape" });
    expect(screen.queryByRole("note", { name: "Prévia" })).toBeNull();
  });
});
