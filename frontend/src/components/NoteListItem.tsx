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
  /** Horário ou data já formatados. */
  when: string;
  /** Roving tabindex: só o item selecionado fica no Tab. */
  selected: boolean;
  onOpen: () => void;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  actions: NoteListItemAction[];
  ref?: Ref<HTMLButtonElement>;
}

/** Linha do histórico. Título e preview entram como texto JSX (o React escapa). */
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
          <span className="note-list-item__title">{note.title || "Sem título"}</span>
          <span className="note-list-item__when">{when}</span>
        </span>
        {note.preview && <span className="note-list-item__preview">{note.preview}</span>}
      </button>
      <span className="note-list-item__actions">
        {actions.map((action) => (
          <span key={action.label} className={action.danger ? "note-list-item__danger" : undefined}>
            {/* Fora do Tab: Delete e Enter fazem o mesmo pelo teclado. */}
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
