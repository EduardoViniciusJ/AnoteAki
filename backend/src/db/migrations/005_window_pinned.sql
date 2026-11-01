-- v5: sticky notes pinned on screen (default) do not hide when focus leaves the app.

ALTER TABLE open_windows ADD COLUMN pinned INTEGER NOT NULL DEFAULT 1;
