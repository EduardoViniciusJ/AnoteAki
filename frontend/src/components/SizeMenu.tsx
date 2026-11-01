import { useEffect, useRef, useState } from "react";
import type { WindowSize } from "../lib/api";
import { IconButton } from "./IconButton";
import "./SizeMenu.css";

export const SIZES: { value: WindowSize; label: string }[] = [
  { value: "small", label: "Pequeno" },
  { value: "medium", label: "Médio" },
  { value: "large", label: "Grande" },
];

export interface SizeMenuProps {
  onChange: (size: WindowSize) => void;
}

/** Button that opens the size presets of the sticky note window. */
export function SizeMenu({ onChange }: SizeMenuProps) {
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
    <div ref={rootRef} className="size-menu">
      <IconButton
        icon="resize"
        label="Tamanho do post-it"
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <fieldset
          className="size-menu__panel"
          aria-label="Tamanho do post-it"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              // Esc closes only the menu, without hiding the note.
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
        >
          {SIZES.map(({ value, label }, index) => (
            <button
              key={value}
              ref={index === 0 ? firstRef : undefined}
              type="button"
              className="size-menu__option"
              onClick={() => {
                setOpen(false);
                onChange(value);
              }}
            >
              {label}
            </button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
