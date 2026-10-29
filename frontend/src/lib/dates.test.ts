import { describe, expect, it } from "vitest";
import { dayLabel, formatTime, formatWhen, groupByDay } from "./dates";

// Dates built in local time and converted to ISO, like the ones from Rust:
// the tests pass in any machine time zone.
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

describe("dayLabel", () => {
  const now = new Date(2026, 9, 29, 9, 0);

  it("hoje e ontem", () => {
    expect(dayLabel(new Date(2026, 9, 29, 0, 0), now)).toBe("Hoje");
    expect(dayLabel(new Date(2026, 9, 28, 23, 59), now)).toBe("Ontem");
  });

  it("data por extenso, com ano só se for outro ano", () => {
    expect(dayLabel(new Date(2026, 9, 27), now)).toBe("27 de outubro");
    expect(dayLabel(new Date(2025, 11, 31), now)).toBe("31 de dezembro de 2025");
  });

  it("ontem atravessa a virada do mês e do ano", () => {
    expect(dayLabel(new Date(2026, 9, 31), new Date(2026, 10, 1, 8))).toBe("Ontem");
    expect(dayLabel(new Date(2025, 11, 31), new Date(2026, 0, 1, 8))).toBe("Ontem");
  });
});

describe("groupByDay", () => {
  it("separa na virada da meia-noite", () => {
    const now = new Date(2026, 9, 29, 0, 30);
    const notes = [
      { id: 1, updatedAt: at(2026, 10, 29, 0, 0) },
      { id: 2, updatedAt: at(2026, 10, 28, 23, 59) },
    ];
    const groups = groupByDay(notes, now);
    expect(groups.map((g) => g.label)).toEqual(["Hoje", "Ontem"]);
    expect(groups.map((g) => g.items.map((n) => n.id))).toEqual([[1], [2]]);
  });

  it("junta notas do mesmo dia mantendo a ordem", () => {
    const now = new Date(2026, 9, 29, 18);
    const notes = [
      { id: 1, updatedAt: at(2026, 10, 29, 17) },
      { id: 2, updatedAt: at(2026, 10, 29, 8) },
      { id: 3, updatedAt: at(2026, 10, 20, 10) },
      { id: 4, updatedAt: at(2026, 10, 20, 9) },
    ];
    const groups = groupByDay(notes, now);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.items.map((n) => n.id)).toEqual([1, 2]);
    expect(groups[1]?.label).toBe("20 de outubro");
    expect(groups[1]?.key).toBe("2026-10-20");
  });

  it("lista vazia → nenhum grupo", () => {
    expect(groupByDay([], new Date())).toEqual([]);
  });
});

describe("formatação de horário", () => {
  it("hora com dois dígitos", () => {
    expect(formatTime(at(2026, 10, 29, 9, 5))).toBe("09:05");
  });

  it("formatWhen: hora se hoje, dia/mês se não", () => {
    const now = new Date(2026, 9, 29, 18);
    expect(formatWhen(at(2026, 10, 29, 14, 3), now)).toBe("14:03");
    expect(formatWhen(at(2026, 10, 3, 14, 3), now)).toBe("03/10");
  });
});
