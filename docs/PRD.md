# PRD: AnoteAki (MVP)

## 1. Visão geral
App desktop para Windows que mostra um post-it digital flutuante com um atalho global. A pessoa escreve, o texto é salvo sozinho no SQLite local e ela volta ao que fazia. Há histórico com busca. É offline e sem conta. Integrações de estudo (Anki, Obsidian, Notion) ficam para depois do MVP (`MVP-SCOPE.md`).

## 2. Personas
| Persona | Contexto | Precisa de |
|---|---|---|
| **Estudante** (idiomas, concursos, faculdade) | Lê PDFs, assiste aulas, faz exercícios | Anotar uma palavra ou dúvida em 2 segundos e reencontrar depois |
| **Desenvolvedor** | IDE, terminal e navegador abertos | Guardar um comando, um link ou uma ideia sem sair da IDE |

## 3. User stories
| ID | História |
|---|---|
| US1 | Como estudante, quero abrir a nota com um atalho para anotar sem trocar de janela. |
| US2 | Como usuário, quero que o texto se salve sozinho para nunca perder uma anotação. |
| US3 | Como usuário, quero que o atalho abra a última nota para continuar de onde parei. |
| US4 | Como usuário, quero criar uma nota nova com `Ctrl+N` para separar assuntos. |
| US5 | Como estudante, quero buscar uma palavra sem me preocupar com acentos para achar notas antigas. |
| US6 | Como usuário, quero excluir notas e poder restaurá-las se errar. |
| US7 | Como desenvolvedor, quero que o app inicie com o Windows e fique na bandeja para o atalho sempre funcionar. |
| US8 | Como usuário, quero tema claro ou escuro, seguindo o Windows, para não ofuscar a vista à noite. |
| US9 | Como usuário de teclado, quero usar tudo sem mouse. |
| US10 | Como usuário, quero trocar o atalho se ele conflitar com outro app. |

## 4. Requisitos funcionais
**F1. Janela e atalho** (US1, US10)
- Janela sem borda, sempre no topo, centralizada no monitor ativo, oculta na inicialização, fora da barra de tarefas.
- O atalho alterna mostrar e esconder; ao mostrar: `show` → `set_focus` → evento `window-shown` → a UI foca o editor.
- Falha ao registrar o atalho → a janela é mostrada na inicialização com um aviso (`get_shortcut_status`), e o app continua utilizável pela bandeja.
- Transparência e cantos arredondados, **se** o protótipo do T10 funcionar bem; plano B: janela opaca com cantos retos.

**F2. Escrita e salvamento** (US2, US3, US4)
- Editor de texto puro (`<textarea>`), sem formatação.
- Debounce de 500 ms → `save_note`; flush em `blur`, ao trocar de tela e no `Ctrl+N`.
- Abrir = `get_last_note`; se for `null`, o editor fica vazio (rascunho com `id = null`).
- `Ctrl+N` ou "+": flush da nota atual → editor vazio com `id = null`. A nota só é criada ao digitar o 1º caractere.
- Título derivado no Rust (1ª linha não vazia, máx. 80 caracteres).
- Indicador discreto de estado: "salvando…" / "salvo" / erro.

**F3. Histórico** (US5, US6)
- Lista agrupada por dia (Hoje, Ontem, data), paginada (50 por vez), com título e preview.
- Busca com debounce de 200 ms usando `search_notes`; resultados por relevância.
- Abrir uma nota do histórico → ela passa a ser a nota do editor.
- Excluir → soft delete + toast com "Desfazer" (5 s). Lixeira: restaurar e excluir definitivo.

**F4. Sistema** (US7)
- Bandeja: clique esquerdo abre; menu com "Abrir" e "Sair".
- Fechar a janela (Alt+F4) esconde; "Sair" encerra.
- Instância única: uma 2ª execução mostra a janela da instância existente.
- Iniciar com o Windows (padrão ligado, configurável).

**F5. Aparência e configurações** (US8, US10)
- Tema `system` | `light` | `dark`; `system` segue `prefers-color-scheme` em tempo real.
- Configurações: tema, atalho (captura de teclas), esconder ao perder o foco, iniciar com o Windows.

## 5. Requisitos não funcionais
| Área | Requisito |
|---|---|
| Desempenho | Latência entre atalho e janela visível com foco: **medir e registrar** (T13, T91). Memória em repouso (app + processos WebView2): **medir e registrar**. Nenhuma meta antes da 1ª medição. |
| Offline | Todas as funções do MVP funcionam sem rede; o app não faz nenhuma requisição de rede. |
| Segurança | Capabilities mínimas; CSP `default-src 'self'` sem CDN; conteúdo de nota só como texto JSX (sem `dangerouslySetInnerHTML`); SQL parametrizado; validação no Rust. |
| Privacidade | Sem telemetria; nenhum texto de nota em logs; dados só em `%APPDATA%\com.anoteaki.desktop\`. |
| Acessibilidade | Navegação completa por teclado; foco visível; contraste WCAG AA (≥ 4,5:1 em texto, ≥ 3:1 no anel de foco); respeita `prefers-reduced-motion`. |
| Confiabilidade | SQLite em modo WAL; perda máxima aceitável = janela de debounce (500 ms) em caso de encerramento forçado. |
| Custo | Zero de infraestrutura (sem servidor). |

## 6. Arquitetura
```
┌─────────────────────────── Processo AnoteAki (Tauri) ────────────────────────────┐
│                                                                                   │
│  frontend/ (WebView2, React + TS)           backend/ (Rust core)                  │
│  src/                                       src/                                  │
│  ├─ App.tsx        (troca de telas)  invoke  ├─ commands/ notes.rs settings.rs     │
│  ├─ screens/       Note, History,   ───────► │             window.rs              │
│  │                 Settings                  ├─ db/ (rusqlite, migrações, FTS5)    │
│  ├─ components/    NoteEditor, NoteList, ◄── ├─ shortcut.rs  tray.rs              │
│  │                 SearchBox, IconButton, eventos  settings.rs  error.rs           │
│  │                 Toast, ShortcutCapture    └─ lib.rs / main.rs                   │
│  ├─ lib/           api.ts (tipado), debounce.ts, dates.ts                         │
│  └─ styles/        tokens.css, base.css                                           │
└───────────────────────────────────────────────┬───────────────────────────────────┘
                                                ▼
                         %APPDATA%\com.anoteaki.desktop\anoteaki.db
Plugins: global-shortcut (Rust) · autostart · single-instance · tray nativo
```
- Estado compartilhado: `tauri::State<Mutex<rusqlite::Connection>>` (uma conexão, acesso serializado; volume baixo).
- Migrações versionadas via `PRAGMA user_version`.
- Contrato completo: seção 12.

### Modelo de dados
```sql
CREATE TABLE notes (
  id          INTEGER PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  color       TEXT NULL,                 -- StickerColor ou NULL
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT NULL
);
CREATE INDEX idx_notes_updated ON notes(updated_at DESC);

CREATE VIRTUAL TABLE notes_fts USING fts5(
  title, body, content='notes', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
-- triggers AFTER INSERT/UPDATE/DELETE em notes mantêm notes_fts sincronizada

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

## 7. Integrações externas
Nenhuma no MVP. Anki, Obsidian e Notion estão descritos em `MVP-SCOPE.md` como fases 6 a 8.

## 8. Casos de borda
- Nenhuma nota existe → editor vazio; a nota é criada ao digitar.
- `Ctrl+N` sem digitar nada → nada é criado; o atalho seguinte reabre a última nota com conteúdo.
- O usuário apaga todo o texto de uma nota existente → ela é salva vazia e some do histórico (`list_notes` exclui as vazias).
- A busca contém aspas, `*`, `-`, `NEAR` → tratadas como texto literal (escape no Rust).
- O atalho já está em uso por outro app → `SHORTCUT_UNAVAILABLE`; o app segue pela bandeja.
- Layouts com AltGr (ex.: ABNT2): `Ctrl+Alt` = AltGr pode colidir com caracteres digitados → validar no T11.
- Monitores múltiplos ou DPI diferente → centralizar no monitor do cursor.
- Encerramento forçado durante a digitação → perda máxima de 500 ms.
- Banco corrompido ou bloqueado → erro `DB_ERROR` visível; o app não fecha em silêncio.
- Nota na lixeira aberta pelo histórico → somente leitura até ser restaurada.
- Nota muito grande (> 100 000 caracteres) → `INVALID_INPUT` + aviso; o texto continua no editor.

## 9. Critérios de aceitação
| Feature | Aceita quando |
|---|---|
| F1 | Com qualquer app em primeiro plano, `Ctrl+Alt+K` mostra a janela e o texto digitado em seguida cai no editor (20/20); um novo `Ctrl+Alt+K` esconde. |
| F2 | Digitar, esconder, reabrir → o texto está lá; reiniciar o app → o texto está lá; `Ctrl+N` + digitar → duas notas no histórico. |
| F3 | Uma nota com "ação" é encontrada buscando "acao"; excluir + "Desfazer" restaura; uma nota purgada desaparece da lixeira. |
| F4 | Depois do login no Windows, o atalho funciona sem abrir nada; um 2º executável não cria um 2º ícone na bandeja; "Sair" encerra todos os processos. |
| F5 | Trocar o tema do Windows muda o app em modo `system`; trocar o atalho nas Configurações funciona sem reiniciar. |

## 10. Riscos técnicos e como medir
| ID | Risco | Como medir / mitigar |
|---|---|---|
| R1 | Windows não entrega o foco à janela (restrição de foreground) | 20 aberturas sobre navegador, VS Code, Explorer e terminal; contar quantas vezes o texto cai no editor. Sequência: `unminimize → show → set_focus → emit("window-shown")` no Rust + foco do textarea com `requestAnimationFrame` na UI. |
| R2 | Latência entre atalho e janela | Em build de debug: `Instant` no handler do atalho até depois do `set_focus` (log só com ms, sem conteúdo) + `performance.now()` no `window-shown`. 20 amostras; registrar a mediana e o p95. |
| R3 | Memória em repouso | Depois de 5 min oculta: soma do working set do AnoteAki + processos `msedgewebview2` filhos (Gerenciador de Tarefas / `Get-Process`). Registrar. |
| R4 | Transparência/sombra/cantos falham no Windows 11 | Protótipo no T10; se falhar, usar o plano B (opaca). |
| R5 | Conflito de atalho / AltGr | Testar o registro com o atalho já em uso e digitar caracteres AltGr no ABNT2 (T11). |
| R6 | Perda de dados | Matar o processo 1 s depois de digitar (Gerenciador de Tarefas) em 10 tentativas; conferir o texto. |
| R7 | FTS5 indisponível no `bundled` | O `libsqlite3-sys` com `bundled` compila com `SQLITE_ENABLE_FTS5`; o T20 tem um teste que cria a tabela fts5 e busca "acao" → "ação". |
| R8 | Aviso do SmartScreen no instalador sem assinatura | Instalar em um usuário/VM limpo (T90) e registrar o que aparece. |

## 11. Decisões em aberto
1. ~~Licença~~ → **decidido (28/10/2026): open source, MIT** (`LICENSE`).
2. **Identificador do app:** `com.anoteaki.desktop` (**hipótese adotada**; define a pasta em `%APPDATA%`; mudar depois quebra os dados existentes)
3. ~~Windows 10~~ → **decidido (28/10/2026): só Windows 11.**
4. **Limite de tamanho da nota:** 100 000 caracteres está bom?
5. **Lixeira:** purga automática após N dias ou só manual?
6. **Atalho padrão:** `Ctrl+Alt+K` (**hipótese adotada**; revisar se o teste de AltGr do T11 falhar).
7. **Posição da janela:** sempre centralizada, ou lembrar onde o usuário a arrastou?
8. **Assinatura de código** para a distribuição pública: adiar até haver usuários?

## 12. Contrato de comandos (front ↔ back)

Fonte única da comunicação entre UI (`frontend/`, Claude) e Rust (`backend/`, Codex). **Mudanças só pelo orquestrador**, antes de qualquer código.
### Convenções
- O front chama `invoke<T>("nome_do_comando", { ...args })`; os nomes dos comandos estão em `snake_case`.
- Os campos JSON estão em `camelCase` (`#[serde(rename_all = "camelCase")]` no Rust).
- Datas: string ISO 8601 em UTC (`2026-10-28T14:03:12.123Z`), geradas pelo SQLite (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`).
- IDs: inteiros (`i64` no Rust, `number` no TS).
- Toda entrada é validada no Rust; o front também valida para dar feedback, mas **não é confiável**.
- Erros retornam `Err(AppError)`, que o `invoke` rejeita com o objeto abaixo.

### Tipos
```ts
type StickerColor = "yellow" | "pink" | "blue" | "green" | "lilac" | "paper";
type StickerOpacity = 100 | 85 | 70;  // opacidade do fundo do post-it, em %

interface Note {
  id: number;
  title: string;          // derivado no Rust: o `heading` (trim, máx. 80) ou, se vazio, a 1ª linha não vazia do corpo; "" se ambos vazios
  heading: string;        // título digitado pelo usuário (máx. 200); "" = título vem do corpo
  body: string;
  color: StickerColor | null;  // null = amarelo
  opacity: StickerOpacity;     // padrão 100
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;    // não nulo = na lixeira
}

interface NoteSummary {
  id: number;
  title: string;
  preview: string;        // corpo (sem a 1ª linha quando não há heading), espaços colapsados, máx. 140 caracteres
  color: StickerColor | null;
  updatedAt: string;
  deletedAt: string | null;
}

// O que um post-it (janela) mostra. Cada janela é um post-it com label "note-N".
interface WindowState {
  noteId: number | null;  // null = post-it em branco, ainda não salvo
  color: StickerColor;
  opacity: StickerOpacity;
}

type Theme = "system" | "light" | "dark";

interface Settings {
  theme: Theme;              // padrão "system"
  shortcut: string;          // padrão "Ctrl+Alt+K" (formato accelerator do plugin global-shortcut)
  hideOnBlur: boolean;       // padrão true
  autostart: boolean;        // padrão true
}

type ErrorCode =
  | "INVALID_INPUT"          // validação falhou
  | "NOT_FOUND"              // id inexistente (ou em escopo errado)
  | "DB_ERROR"               // falha do SQLite
  | "SHORTCUT_UNAVAILABLE"   // atalho já em uso por outro app/inválido
  | "INTERNAL";

interface AppError { code: ErrorCode; message: string } // message NUNCA contém texto de nota
```

### Limites (validados no Rust)
| Campo | Limite |
|---|---|
| `body` | ≤ 100 000 caracteres (hipótese, ver PRD, decisão em aberto 4) |
| `query` (busca) | 1 a 200 caracteres após o trim |
| `limit` | 1 a 200 (padrão 50) |
| `offset` | ≥ 0 |
| `shortcut` | accelerator válido com ≥ 1 modificador (Ctrl/Alt/Shift/Super) + 1 tecla |

### Comandos: notas
| Comando | Args | Retorno | Regras |
|---|---|---|---|
| `get_last_note` | — | `Note \| null` | A nota **ativa** (`deletedAt` nulo) com maior `updatedAt`. `null` se não houver nenhuma. |
| `get_note` | `{ id }` | `Note` | Inclui notas na lixeira. `NOT_FOUND` se não existir. |
| `save_note` | `{ id: number \| null, body: string, heading?: string, color?: StickerColor, opacity?: StickerOpacity }` | `Note` | `id` nulo → cria (o front só chama com título ou corpo não vazio) e liga a nota ao post-it que chamou, para ele voltar ao reiniciar. `id` existente → atualiza; campo ausente ou `null` mantém o valor atual. Sem mudança, o `updatedAt` não muda. Salvar uma nota na lixeira → `INVALID_INPUT`. |
| `list_notes` | `{ scope: "active" \| "trash", limit?, offset? }` | `NoteSummary[]` | Ordem: `updatedAt` desc. `active` **exclui notas de corpo vazio**. |
| `search_notes` | `{ query, limit? }` | `NoteSummary[]` | FTS5 em title+body, só ativas, ordem por relevância (`bm25`). Sem diferenciar acentos nem maiúsculas. Cada termo vira uma frase escapada entre aspas, com prefixo `*` no último (o usuário nunca injeta sintaxe FTS). |
| `delete_note` | `{ id }` | `void` | Soft delete (`deletedAt = now`). Fecha o post-it dessa nota; se for o post-it que chamou, ele fica aberto, em branco. |
| `restore_note` | `{ id }` | `Note` | `deletedAt = null`. |
| `purge_note` | `{ id }` | `void` | Remoção definitiva; só para notas na lixeira (senão `INVALID_INPUT`). |

### Comandos: configurações e janela
| Comando | Args | Retorno | Regras |
|---|---|---|---|
| `get_settings` | — | `Settings` | Os valores ausentes no banco retornam o padrão. |
| `set_setting` | `{ key: keyof Settings, value: string \| boolean }` | `Settings` | Valida o tipo por chave. `shortcut`: desregistra o antigo e registra o novo; se falhar, mantém o antigo e retorna `SHORTCUT_UNAVAILABLE`. `autostart`: ativa ou desativa via plugin. |
| `hide_window` | — | `void` | Esconde **todos** os post-its (usado pelo Esc). |
| `get_window_state` | — | `WindowState` | Nota, cor e opacidade do post-it que chamou. |
| `open_note_window` | `{ noteId: number \| null }` | `void` | Abre um post-it ao lado do que chamou: `null` = em branco, com a próxima cor da rotação amarelo → rosa → azul → verde; um id = aquela nota (se já estiver aberta, só traz para frente). |
| `close_note_window` | — | `void` | Fecha o post-it que chamou; a nota continua no histórico. |
| `get_shortcut_status` | — | `{ shortcut: string, registered: boolean }` | Atalho atual e se o registro global deu certo. A UI consulta ao iniciar e mostra um aviso + link para Configurações se `registered = false`. Se o registro falhar na inicialização, o Rust também mostra a janela (senão o app ficaria inacessível). |

### Eventos (Rust → UI)
| Evento | Payload | Quando |
|---|---|---|
| `window-shown` | `{ reason: "shortcut" \| "tray" \| "second-instance" }` | Só para o post-it que recebeu o foco, logo depois de `show()` + `set_focus()`. A UI foca o título (post-it vazio) ou o fim do texto. |

Não há evento de falha do atalho na inicialização: um evento emitido antes de o `listen()` do JS ser registrado é descartado (condição de corrida observada no T11). Por isso o estado é consultado com `get_shortcut_status`.

### Comportamentos do lado do Rust (sem comando)
- O atalho global mostra/esconde **todos** os post-its (registrado **no Rust**; o JS não tem permissão do plugin). Sem nenhum aberto, abre a última nota (ou um em branco).
- Os post-its com nota ficam na tabela `open_windows` (posição e tamanho, salvos ao perder o foco e ao esconder) e voltam ao reiniciar. Um post-it em branco não é salvo.
- Criar janela só em comando `async`: em comando síncrono o Windows trava (wry #583).
- Fechar o último post-it não encerra o processo (`RunEvent::ExitRequested` sem código é cancelado); o atalho abre um novo.
- `hideOnBlur = true` → evento `Focused(false)` da janela → `hide()`.
- Fechar a janela (Alt+F4) **esconde todos**, como o Esc; só "Sair" na bandeja encerra o processo.

### Responsabilidade do front em relação a salvamento
- Debounce de 500 ms depois da última tecla → `save_note`.
- Salvar imediatamente (flush) em `blur` da janela e antes de trocar de tela ou criar uma nota nova.
- Os passos acima garantem que, ao clicar em "Sair" na bandeja, a nota já esteja salva (a janela perdeu o foco antes).

## 13. Privacidade
- Tudo local em `%APPDATA%\com.anoteaki.desktop\anoteaki.db`; sem telemetria, sem conta, sem rede no MVP.
- Logs nunca contêm texto de nota. Para apagar tudo: desinstalar e excluir a pasta acima.
- Destinos futuros (Anki, Obsidian, Notion) só enviam texto quando o usuário aciona; o token do Notion fica no Gerenciador de Credenciais.
