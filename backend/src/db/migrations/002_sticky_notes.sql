-- v2: typed heading, opacity and the sticky note windows left open.

ALTER TABLE notes ADD COLUMN heading TEXT NOT NULL DEFAULT '';
ALTER TABLE notes ADD COLUMN opacity INTEGER NOT NULL DEFAULT 100;

-- One row per open sticky note window, so they come back after a restart.
CREATE TABLE open_windows (
  label    TEXT PRIMARY KEY,
  note_id  INTEGER NOT NULL UNIQUE REFERENCES notes(id) ON DELETE CASCADE,
  x        INTEGER NOT NULL,
  y        INTEGER NOT NULL,
  width    INTEGER NOT NULL,
  height   INTEGER NOT NULL
);
