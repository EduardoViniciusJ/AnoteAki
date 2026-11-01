-- v4: pinned notes, shown on top of the history.

ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
