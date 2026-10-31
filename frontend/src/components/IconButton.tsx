import "./IconButton.css";

export type IconName =
  | "plus"
  | "history"
  | "settings"
  | "close"
  | "back"
  | "trash"
  | "restore"
  | "palette"
  | "copy"
  | "pin";

// 16×16 stroke icons drawn with paths.
const PATHS: Record<IconName, string[]> = {
  plus: ["M8 3v10", "M3 8h10"],
  history: ["M7 2.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9", "M10.3 10.3L13.5 13.5"],
  settings: [
    "M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5",
    "M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
  ],
  close: ["M4 4l8 8", "M12 4l-8 8"],
  back: ["M13 8H3", "M7 4L3 8l4 4"],
  trash: ["M2.5 4.5h11", "M6 4.5V3h4v1.5", "M4 4.5l.7 9h6.6l.7-9"],
  restore: ["M3 3v3.5h3.5", "M3.5 6.5A5 5 0 1 1 3 9"],
  palette: [
    "M8 2a6 6 0 1 0 0 12c1 0 1.3-.8.9-1.6-.5-.9.1-1.9 1.1-1.9H12a2 2 0 0 0 2-2A6 6 0 0 0 8 2",
    "M5 7.5h.01M7 5h.01M10 5.5h.01",
  ],
  copy: ["M5.5 5.5h7v8h-7z", "M3.5 10.5v-8h7"],
  pin: ["M6 2h4", "M6.5 2v4L4.5 8.5h7L9.5 6V2", "M8 8.5V14"],
};

export interface IconButtonProps {
  icon: IconName;
  /** Accessible label (aria-label) and mouse tooltip. */
  label: string;
  disabled?: boolean;
  /** `-1` removes the button from Tab order when a keyboard shortcut does the same (e.g. Delete in the list). */
  tabIndex?: number;
  onClick?: () => void;
}

export function IconButton({ icon, label, disabled = false, tabIndex, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      // aria-disabled (not `disabled`) keeps the button in Tab order, with the reason in the tooltip.
      aria-disabled={disabled}
      tabIndex={tabIndex}
      onClick={() => {
        if (!disabled) onClick?.();
      }}
    >
      <svg className="icon-button__icon" viewBox="0 0 16 16" aria-hidden="true">
        {PATHS[icon].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </button>
  );
}
