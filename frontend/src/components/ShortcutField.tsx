import { type KeyboardEvent, useId, useState } from "react";
import { DEFAULT_SHORTCUT, displayShortcut, shortcutFromKeys } from "../lib/shortcut";
import "./ShortcutField.css";

export interface ShortcutFieldProps {
  /** Shortcut in use now. */
  current: string;
  /** False when Windows did not accept the current shortcut. */
  registered: boolean;
  /** Inline error, e.g. the shortcut is taken by another program. */
  error: string | null;
  /** Saves the shortcut; resolves true when it was accepted. */
  onSubmit: (shortcut: string) => Promise<boolean>;
  disabled?: boolean;
}

/** Records a key combo and saves it as the global shortcut. */
export function ShortcutField({
  current,
  registered,
  error,
  onSubmit,
  disabled = false,
}: ShortcutFieldProps) {
  const [candidate, setCandidate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorId = useId();

  const submit = (shortcut: string) => {
    setSaving(true);
    void onSubmit(shortcut).then((saved) => {
      setSaving(false);
      if (saved) setCandidate(null);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const plain = !event.ctrlKey && !event.altKey && !event.metaKey;
    // Tab keeps moving the focus.
    if (event.key === "Tab" && plain) return;
    if (event.key === "Escape") {
      // Esc cancels the recording; with nothing recorded it goes back (the screen handles it).
      if (candidate === null) return;
      event.preventDefault();
      event.stopPropagation();
      setCandidate(null);
      return;
    }
    event.preventDefault();
    if (event.key === "Enter" && plain && !event.shiftKey) {
      if (candidate) submit(candidate);
      return;
    }
    const shortcut = shortcutFromKeys(event);
    if (shortcut) setCandidate(shortcut);
  };

  return (
    <div className="shortcut-field">
      <p className="shortcut-field__current">
        Atual: <kbd>{displayShortcut(current)}</kbd>
        {!registered && <span className="shortcut-field__off"> (não registrado)</span>}
      </p>
      <div className="shortcut-field__row">
        <input
          className="shortcut-field__input"
          type="text"
          readOnly
          aria-label="Gravar atalho"
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          placeholder="Clique e pressione as teclas"
          value={candidate ? displayShortcut(candidate) : ""}
          disabled={disabled}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="shortcut-field__button"
          disabled={disabled || saving || candidate === null}
          onClick={() => candidate && submit(candidate)}
        >
          Salvar atalho
        </button>
      </div>
      {error && (
        <p id={errorId} className="shortcut-field__error" role="alert">
          {error}
        </p>
      )}
      {current !== DEFAULT_SHORTCUT && (
        <button
          type="button"
          className="shortcut-field__reset"
          disabled={disabled || saving}
          onClick={() => submit(DEFAULT_SHORTCUT)}
        >
          Restaurar padrão ({DEFAULT_SHORTCUT})
        </button>
      )}
    </div>
  );
}
