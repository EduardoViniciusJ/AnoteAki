// History dates, always in the user's local time zone (Rust stores UTC).

export interface DayGroup<T> {
  /** Local `YYYY-MM-DD`, stable to use as a `key`. */
  key: string;
  label: string;
  items: T[];
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" });
const dayYearFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortDateFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Previous calendar day (not "minus 24 h", which is wrong on daylight saving changes). */
function previousDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
}

/** "Hoje", "Ontem" or the long date ("28 de outubro"; with the year if it is not the current one). */
export function dayLabel(date: Date, now: Date): string {
  const key = dayKey(date);
  if (key === dayKey(now)) return "Hoje";
  if (key === dayKey(previousDay(now))) return "Ontem";
  return date.getFullYear() === now.getFullYear()
    ? dayFormat.format(date)
    : dayYearFormat.format(date);
}

/** Groups by the local day of `updatedAt`, keeping the given order (Rust already sorts). */
export function groupByDay<T extends { updatedAt: string }>(items: T[], now: Date): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const date = new Date(item.updatedAt);
    const key = dayKey(date);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, label: dayLabel(date, now), items: [item] });
    }
  }
  return groups;
}

/** "14:03" */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** For lists without day groups: the time if today, otherwise "28/10". */
export function formatWhen(iso: string, now: Date): string {
  const date = new Date(iso);
  return dayKey(date) === dayKey(now) ? timeFormat.format(date) : shortDateFormat.format(date);
}
