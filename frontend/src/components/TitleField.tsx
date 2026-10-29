import type { Ref } from "react";
import "./TitleField.css";

/** Same limit as the backend (PRD §12). */
export const TITLE_MAX = 200;

export interface TitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter jumps to the body, like Tab. */
  onSubmit: () => void;
  readOnly?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** Optional bold title above the note text. */
export function TitleField({ value, onChange, onSubmit, readOnly = false, ref }: TitleFieldProps) {
  return (
    <input
      ref={ref}
      className="title-field"
      type="text"
      aria-label="Título da nota"
      placeholder="Título"
      maxLength={TITLE_MAX}
      spellCheck
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
      }}
    />
  );
}
