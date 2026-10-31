import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import "./CopyMenu.css";

export interface CopyMenuProps {
  /** Copy as plain text (also on Ctrl+Shift+C). */
  onCopyText: () => void;
  /** Copy as Markdown, the title as a heading (also on Ctrl+Shift+M). */
  onCopyMarkdown: () => void;
  disabled?: boolean;
}

/** Copy button that opens the "text or Markdown" choices for the whole note. */
export function CopyMenu({ onCopyText, onCopyMarkdown, disabled = false }: CopyMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    // Clicking outside closes the menu.
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const choose = (copy: () => void) => {
    setOpen(false);
    copy();
  };

  return (
    <div ref={rootRef} className="copy-menu">
      <IconButton
        icon="copy"
        label={disabled ? "Copiar nota (nota vazia)" : "Copiar nota"}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <div
          className="copy-menu__panel"
          role="menu"
          aria-label="Copiar nota"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // Esc closes only the menu, without hiding the note.
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <button
            ref={firstRef}
            type="button"
            role="menuitem"
            className="copy-menu__item"
            onClick={() => choose(onCopyText)}
          >
            Copiar texto <kbd>Ctrl+Shift+C</kbd>
          </button>
          <button
            type="button"
            role="menuitem"
            className="copy-menu__item"
            onClick={() => choose(onCopyMarkdown)}
          >
            Copiar como Markdown <kbd>Ctrl+Shift+M</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
