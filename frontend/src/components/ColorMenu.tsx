import { useEffect, useRef, useState } from "react";
import type { StickerColor, StickerOpacity } from "../lib/api";
import type { Look } from "../lib/useNoteDraft";
import { IconButton } from "./IconButton";
import "./ColorMenu.css";

export const COLORS: { value: StickerColor; label: string }[] = [
  { value: "yellow", label: "Amarelo" },
  { value: "pink", label: "Rosa" },
  { value: "blue", label: "Azul" },
  { value: "green", label: "Verde" },
  { value: "lilac", label: "Lilás" },
  { value: "paper", label: "Papel" },
];

export const OPACITIES: { value: StickerOpacity; label: string }[] = [
  { value: 100, label: "Sólido" },
  { value: 85, label: "85%" },
  { value: 70, label: "70%" },
];

export interface ColorMenuProps {
  look: Look;
  onChange: (look: Look) => void;
  disabled?: boolean;
}

/** Palette button that opens the color and opacity choices of a sticky note. */
export function ColorMenu({ look, onChange, disabled = false }: ColorMenuProps) {
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

  return (
    <div ref={rootRef} className="color-menu">
      <IconButton
        icon="palette"
        label="Cor e transparência"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <fieldset
          className="color-menu__panel"
          aria-label="Cor e transparência"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // Esc closes only the menu, without hiding the note.
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <div className="color-menu__row">
            {COLORS.map(({ value, label }, index) => (
              <button
                key={value}
                ref={index === 0 ? firstRef : undefined}
                type="button"
                className={`color-menu__swatch color-menu__swatch--${value}`}
                aria-label={label}
                title={label}
                aria-pressed={look.color === value}
                onClick={() => onChange({ ...look, color: value })}
              />
            ))}
          </div>
          <div className="color-menu__row">
            {OPACITIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className="color-menu__opacity"
                aria-pressed={look.opacity === value}
                onClick={() => onChange({ ...look, opacity: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
