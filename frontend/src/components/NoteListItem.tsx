import type { FocusEventHandler, MouseEvent, Ref } from "react";
import type { NoteSummary } from "../lib/api";
import { IconButton, type IconName } from "./IconButton";
import "./NoteListItem.css";

export interface NoteListItemAction {
  icon: IconName;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

export interface NoteListItemProps {
  note: NoteSummary;
  /** Time or date, already formatted. */
  when: string;
  /** Roving tabindex: only the selected item is in Tab order. */
  selected: boolean;
  /** Part of a multi-selection (Ctrl/Shift+click or Space). */
  checked?: boolean;
  /** Receives the click so the screen can tell open from Ctrl/Shift multi-select. */
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  /** Mouse in / mouse out, used by the preview. */
  onHoverChange?: (hovering: boolean) => void;
  actions: NoteListItemAction[];
  ref?: Ref<HTMLButtonElement>;
}

/** History row. Title and preview are rendered as JSX text (React escapes them). */
export function NoteListItem({
  note,
  when,
  selected,
  checked = false,
  onOpen,
  onFocus,
  onBlur,
  onHoverChange,
  actions,
  ref,
}: NoteListItemProps) {
  return (
    <li
      className={checked ? "note-list-item note-list-item--checked" : "note-list-item"}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <button
        ref={ref}
        type="button"
        className="note-list-item__open"
        tabIndex={selected ? 0 : -1}
        aria-pressed={checked || undefined}
        onClick={onOpen}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <span className="note-list-item__head">
          <span
            className="note-list-item__dot"
            style={{ background: `var(--sticker-${note.color ?? "yellow"})` }}
            aria-hidden="true"
          />
          <span className="note-list-item__title">{note.title || "Sem título"}</span>
          <span className="note-list-item__when">{when}</span>
        </span>
        {note.preview && <span className="note-list-item__preview">{note.preview}</span>}
      </button>
      <span className="note-list-item__actions">
        {actions.map((action) => (
          <span key={action.label} className={action.danger ? "note-list-item__danger" : undefined}>
            {/* Not in Tab order: Delete and Enter do the same from the keyboard. */}
            <IconButton
              icon={action.icon}
              label={action.label}
              tabIndex={-1}
              onClick={action.onClick}
            />
          </span>
        ))}
      </span>
    </li>
  );
}
