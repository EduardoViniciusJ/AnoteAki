-- v1: schema from PRD §6 (data model).

CREATE TABLE notes (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  color       TEXT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT NULL
);
CREATE INDEX idx_notes_updated ON notes(updated_at DESC);

-- Search index without a copy of the text (content='notes'); ignores accents and case.
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, body, content='notes', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

-- Triggers keep notes_fts in sync with notes.
CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
END;

-- Only when the text changes: trashing and restoring do not reindex.
CREATE TRIGGER notes_fts_update AFTER UPDATE OF title, body ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
