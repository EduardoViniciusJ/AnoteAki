-- v3: stacking order of the open sticky notes (higher = on top).

ALTER TABLE open_windows ADD COLUMN stack INTEGER NOT NULL DEFAULT 0;
