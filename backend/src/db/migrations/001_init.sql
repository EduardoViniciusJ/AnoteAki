-- v1: schema do PRD §6 (Modelo de dados).

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

-- Índice de busca sem cópia do texto (content='notes'); sem acentos e sem caixa.
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, body, content='notes', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

-- Os triggers mantêm notes_fts em sincronia com notes.
CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
END;

-- Só quando o texto muda: mover para a lixeira e restaurar não reindexam.
CREATE TRIGGER notes_fts_update AFTER UPDATE OF title, body ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
