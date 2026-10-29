import type { FocusEventHandler, Ref } from "react";
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
  onOpen: () => void;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  actions: NoteListItemAction[];
  ref?: Ref<HTMLButtonElement>;
}

/** History row. Title and preview are rendered as JSX text (React escapes them). */
export function NoteListItem({
  note,
  when,
  selected,
  onOpen,
  onFocus,
  actions,
  ref,
}: NoteListItemProps) {
  return (
    <li className="note-list-item">
      <button
        ref={ref}
        type="button"
        className="note-list-item__open"
        tabIndex={selected ? 0 : -1}
        onClick={onOpen}
        onFocus={onFocus}
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
