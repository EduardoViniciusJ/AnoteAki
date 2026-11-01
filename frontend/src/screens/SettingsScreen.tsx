import { type ReactNode, useEffect, useRef, useState } from "react";
import { IconButton } from "../components/IconButton";
import { SelectMenu } from "../components/SelectMenu";
import { Toast } from "../components/Toast";
import {
  type EditorFont,
  getSettings,
  getShortcutStatus,
  type Settings,
  type ShortcutStatus,
  setSetting,
  type Theme,
  toAppError,
} from "../lib/api";
import { applyTheme } from "../lib/theme";
import "./SettingsScreen.css";

const THEME_OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

const FONT_OPTIONS: readonly { value: EditorFont; label: string }[] = [
  { value: "inter", label: "Inter" },
  { value: "serif", label: "Serifada" },
  { value: "mono", label: "Mono" },
];

/** Combos the select offers: memorable and unlikely to clash with other apps. */
const SHORTCUT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "Ctrl+Alt+K", label: "Ctrl+Alt+K (padrão)" },
  { value: "Ctrl+Alt+A", label: "Ctrl+Alt+A" },
  { value: "Ctrl+Alt+N", label: "Ctrl+Alt+N" },
  { value: "Ctrl+Alt+Space", label: "Ctrl+Alt+Espaço" },
  { value: "Ctrl+Shift+K", label: "Ctrl+Shift+K" },
  { value: "Ctrl+Shift+Space", label: "Ctrl+Shift+Espaço" },
];

export interface SettingsScreenProps {
  /** `Esc` or the back button. */
  onBack: () => void;
  /** Called with all settings after each saved change. */
  onSettingsChange: (settings: Settings) => void;
}

/** Screen 3 (DESIGN-GUIDELINES → Telas e teclado): every change is saved right away. */
export function SettingsScreen({ onBack, onSettingsChange }: SettingsScreenProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<ShortcutStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const screenRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    screenRef.current?.focus();
    Promise.all([getSettings(), getShortcutStatus()])
      .then(([loaded, current]) => {
        if (!active) return;
        setSettings(loaded);
        setStatus(current);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const applySaved = (saved: Settings) => {
    setSettings(saved);
    onSettingsChange(saved);
  };

  /** Saves one setting; on failure the old value stays and a toast explains it. */
  const save = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    try {
      const saved = await setSetting(key, value);
      applySaved(saved);
      return saved;
    } catch {
      setToast("Não foi possível salvar a configuração.");
      return null;
    }
  };

  /** Shortcut errors show in the field itself; the old shortcut stays. */
  const saveShortcut = async (shortcut: string): Promise<boolean> => {
    try {
      const saved = await setSetting("shortcut", shortcut);
      applySaved(saved);
      setShortcutError(null);
      setStatus({ shortcut: saved.shortcut, registered: true });
      return true;
    } catch (error) {
      const { code } = toAppError(error);
      if (code === "SHORTCUT_UNAVAILABLE") {
        setShortcutError("Esse atalho já está em uso por outro programa.");
      } else if (code === "INVALID_INPUT") {
        setShortcutError("Esse atalho não é válido. Use Ctrl, Alt, Shift ou Win com outra tecla.");
      } else {
        setShortcutError(null);
        setToast("Não foi possível salvar o atalho.");
      }
      return false;
    }
  };

  let body: ReactNode;
  if (loadFailed) {
    body = <p className="settings-screen__message">Não foi possível carregar as configurações.</p>;
  } else if (!settings || !status) {
    body = <p className="settings-screen__message">Carregando…</p>;
  } else {
    // A shortcut saved before this list existed still shows as its own option.
    const shortcutOptions = SHORTCUT_OPTIONS.some((option) => option.value === status.shortcut)
      ? SHORTCUT_OPTIONS
      : [{ value: status.shortcut, label: status.shortcut }, ...SHORTCUT_OPTIONS];
    body = (
      <>
        <section className="settings-screen__section" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className="settings-screen__heading">
            Aparência
          </h2>
          <div className="settings-screen__row">
            <span className="settings-screen__label">Tema</span>
            <SelectMenu
              label="Tema"
              value={settings.theme}
              options={THEME_OPTIONS}
              onChange={(theme) => {
                void save("theme", theme).then((saved) => {
                  if (saved) applyTheme(saved.theme);
                });
              }}
            />
          </div>
          <div className="settings-screen__row">
            <span className="settings-screen__label">Fonte do editor</span>
            <SelectMenu
              label="Fonte do editor"
              value={settings.editorFont}
              options={FONT_OPTIONS}
              onChange={(font) => void save("editorFont", font)}
            />
          </div>
        </section>

        <section className="settings-screen__section" aria-labelledby="settings-shortcut">
          <h2 id="settings-shortcut" className="settings-screen__heading">
            Atalho global
          </h2>
          <div className="settings-screen__row">
            <span className="settings-screen__label">Mostrar e esconder os post-its</span>
            <SelectMenu
              label="Atalho global"
              value={status.shortcut}
              options={shortcutOptions}
              onChange={(shortcut) => void saveShortcut(shortcut)}
            />
          </div>
          {(shortcutError || !status.registered) && (
            <p className="settings-screen__error" role="alert">
              {shortcutError ?? "O Windows recusou esse atalho. Escolha outro."}
            </p>
          )}
        </section>

        <section className="settings-screen__section" aria-labelledby="settings-behavior">
          <h2 id="settings-behavior" className="settings-screen__heading">
            Comportamento
          </h2>
          <label className="settings-screen__toggle">
            <input
              type="checkbox"
              checked={settings.focusMode}
              onChange={(event) => void save("focusMode", event.target.checked)}
            />
            Modo foco: esconder a barra e o rodapé enquanto digito
          </label>
        </section>
      </>
    );
  }

  return (
    <section
      ref={screenRef}
      className="settings-screen screen-enter"
      aria-label="Configurações"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.defaultPrevented) return;
        if (event.key === "Escape") {
          event.preventDefault();
          onBack();
        }
      }}
    >
      <header className="settings-screen__toolbar" data-tauri-drag-region="">
        <IconButton icon="back" label="Voltar (Esc)" onClick={onBack} />
        <h1 className="settings-screen__title">Configurações</h1>
      </header>
      <div className="settings-screen__body">{body}</div>
      {toast && <Toast variant="error" message={toast} onDismiss={() => setToast(null)} />}
    </section>
  );
}
