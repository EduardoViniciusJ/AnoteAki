import "./IconButton.css";

export type IconName = "plus" | "history" | "settings" | "close" | "back" | "trash" | "restore";

// Ícones de traço 16×16 desenhados com paths.
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
};

export interface IconButtonProps {
  icon: IconName;
  /** Rótulo acessível (aria-label) e dica do mouse. */
  label: string;
  disabled?: boolean;
  /** `-1` tira o botão do Tab quando há atalho de teclado equivalente (ex.: Delete na lista). */
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
      // aria-disabled (e não `disabled`) mantém o botão no Tab, com o motivo na dica.
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
