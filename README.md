<p align="center">
  <img src="backend/icons/icon.png" alt="AnoteAki icon: a yellow sticky note with a folded corner" width="128" height="128" />
</p>

<h1 align="center">AnoteAki</h1>

<p align="center">
  <strong>Your ideas, one shortcut away.</strong><br />
  Sticky notes for Windows with autosave, search, and local storage.
</p>

<p align="center">
  <a href="https://github.com/EduardoViniciusJ/AnoteAki/actions/workflows/ci.yml"><img src="https://github.com/EduardoViniciusJ/AnoteAki/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%2011-0078D4" alt="Platform: Windows 11" />
  <img src="https://img.shields.io/badge/status-in%20development-E6B800" alt="Status: in development" />
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#tech-stack">Tech stack</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="https://github.com/EduardoViniciusJ/AnoteAki/issues">Report a bug or suggest an idea</a>
</p>

> [!NOTE]
> AnoteAki is free and still in development. Notes work offline, with no account or telemetry. The app interface is currently in Portuguese.

## Features

- **Global shortcut:** show or hide your notes with `Ctrl+Alt+K`, or choose another shortcut in Settings.
- **Multiple sticky notes:** open notes in separate windows that stay on top. Their position and size are restored when you restart the app.
- **Autosave:** write with an optional title, word and character counts, and a save status indicator.
- **Custom look:** choose from six colors, three opacity levels, and small, medium, or large sizes. You can also resize notes by hand.
- **Pin to screen:** keep a note visible while using another app, or unpin it to hide it when focus leaves the app.
- **Move mode:** press `Ctrl+M` to drag notes from anywhere in the note area.
- **Focus mode:** hide the toolbar and footer while typing.
- **Themes and fonts:** use a light, dark, or system theme, with Inter, serif, or monospace text.
- **History and search:** find notes by title or text, ignoring accents and letter case. Filter by color and sort by edit date, creation date, or title.
- **Organization:** pin notes to the top of your history, preview them, and select multiple notes for bulk actions.
- **Trash:** undo a deletion, restore notes, or permanently delete them after confirmation.
- **Copy and links:** copy notes as plain text or Markdown. Open links in your browser with `Ctrl+click`.
- **System tray:** open or quit the app from the Windows tray. Launching it again brings up the existing instance.

## Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+K` | Show or hide notes (default, can be changed) |
| `Ctrl+N` | Open a new sticky note |
| `Ctrl+W` | Close this window and keep the note in history |
| `Ctrl+H` or `Ctrl+F` | Open history and search from a note |
| `Ctrl+,` | Open Settings from a note |
| `Ctrl+Shift+C` | Copy the note as plain text |
| `Ctrl+Shift+M` | Copy the note as Markdown |
| `Ctrl+M` | Turn move mode on or off |
| `Esc` | Go back or close the current menu; from a note, hide the sticky notes |

## Tech stack

| Layer | Technologies |
|---|---|
| Desktop | Tauri 2 · Rust · WebView2 |
| Interface | React 19 · TypeScript · Vite |
| Local data | SQLite · rusqlite · FTS5 for full-text search |
| Tests | Vitest · Testing Library · Rust tests |
| Code quality and CI | Biome · TypeScript strict mode · Clippy · rustfmt · GitHub Actions |

## Getting started

On Windows 11, install **Node.js 24 LTS (24.15 or newer)**, **Rust 1.90+ (MSVC)**, the Visual Studio C++ build tools, and the **WebView2 Runtime**. Then run:

```powershell
git clone https://github.com/EduardoViniciusJ/AnoteAki.git
cd AnoteAki/frontend
npm.cmd ci
npm.cmd run tauri dev
```

The app runs in the system tray. Press `Ctrl+Alt+K` to open your notes.

<details>
<summary>Development commands</summary>

From `frontend/`:

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run tauri build
```

From the project root:

```powershell
cargo test --manifest-path backend/Cargo.toml
cargo clippy --manifest-path backend/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path backend/Cargo.toml --check
```

</details>

## Your data

Notes and settings are stored locally in `%APPDATA%\com.anoteaki.desktop\anoteaki.db`. There is no cloud sync. Opening a link with `Ctrl+click` uses your default browser.

