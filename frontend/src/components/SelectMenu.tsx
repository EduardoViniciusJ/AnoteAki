import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import "./SelectMenu.css";

export interface SelectMenuProps<T extends string> {
  /** Accessible name of the control (aria-label). */
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}

/** In-app dropdown: the native <select> popup ignores the page theme in WebView2. */
export function SelectMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: SelectMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    selectedRef.current?.focus();
    // Clicking outside closes the menu.
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    if (event.key === "Escape") {
      // Esc closes only the menu, not the screen behind it.
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[index + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
  };

  const current = options.find((option) => option.value === value);
  return (
    <div ref={rootRef} className={className ? `select-menu ${className}` : "select-menu"}>
      <button
        ref={buttonRef}
        type="button"
        className="select-menu__button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((state) => !state)}
      >
        {current?.label}
        <svg className="select-menu__chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6.5l4 4l4-4" />
        </svg>
      </button>
      {open && (
        <fieldset className="select-menu__panel" aria-label={label} onKeyDown={onPanelKeyDown}>
          {options.map((option) => (
            <button
              key={option.value}
              ref={option.value === value ? selectedRef : undefined}
              type="button"
              className="select-menu__option"
              aria-pressed={option.value === value}
              onClick={() => {
                onChange(option.value);
                close();
              }}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
