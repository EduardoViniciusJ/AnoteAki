import "./WordCount.css";

export interface WordCountProps {
  text: string;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Discreet "12 palavras · 80 caracteres" at the bottom of the note. */
export function WordCount({ text }: WordCountProps) {
  const characters = [...text].length;
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const label = `${plural(words, "palavra", "palavras")} · ${plural(characters, "caractere", "caracteres")}`;
  return (
    // Empty for a blank note, but always rendered: it keeps the footer layout stable.
    <p className="word-count">{characters > 0 && label}</p>
  );
}
