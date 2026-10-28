# AGENTS.md: AnoteAki

## O projeto
App desktop (Windows) de notas rápidas: um atalho global abre uma janela flutuante estilo post-it, e o texto é salvo sozinho no SQLite local.
**Leia antes de implementar:** `docs/TASKS.md` (sua tarefa), `docs/PRD.md` §12 (contrato front↔back), `docs/MVP-SCOPE.md` (o que não fazer) e `docs/DESIGN-GUIDELINES.md` (inclui telas e teclado) se tocar em UI. Contexto: `docs/BRIEF.md`.
**Orca:** cada worker trabalha na sua própria branch/worktree com o ID da tarefa (ex.: `feat/T21-note-commands`).

## Usuário
- Desenvolvedor estudando Rust/Tauri. Fale em **português (PT-BR)**, seja técnico e direto.
- Ao introduzir um conceito novo de Rust/Tauri, explique-o em 1 ou 2 frases.
- Os exercícios listados no fim de `docs/TASKS.md` são **do usuário**: não os resolva, apenas revise quando ele pedir.

## Stack e pastas
Tauri 2 · Rust (rusqlite + FTS5, serde) · TypeScript/HTML/CSS puro + Vite · Vitest · Biome · GitHub Actions. Pré-requisitos: Windows 11, Rust ≥ 1.90 (MSVC), Node 24 LTS.

| Pasta | Dono |
|---|---|
| `backend/` (Rust, `tauri.conf.json`, `capabilities/`) | **Codex** |
| `frontend/` (UI: TS, HTML, CSS, assets, `package.json`) | **Claude** |
| `docs/`, `AGENTS.md` | **Orquestrador** |
| Pesquisa/verificação (sem código de produção) | **agy** (Antigravity) |

- Só edite as pastas listadas na sua tarefa (campo "Pastas" no TASKS.md).
- Mudou um comando/evento/tipo? **Pare** e peça ao orquestrador para atualizar o `docs/PRD.md` §12 antes.

## Convenções
- Código, nomes de arquivos, branches e commits em inglês; docs e comentários de domínio em PT-BR.
- Rust: `snake_case`, erros via enum `AppError` (ver contrato), sem `unwrap()` fora de testes.
- TS: `strict`, `camelCase`, sem `any`, sem framework de UI.
- **Componentes (frontend):** um componente por arquivo em `frontend/src/components/` (`PascalCase.ts` + `PascalCase.css` ao lado). Assinatura: `createX(props): { el: HTMLElement; update(props): void; destroy(): void }`. Telas em `src/screens/` só compõem componentes; chamadas ao Rust só via `src/lib/api.ts`.
- **Dependências (modelo AnyCaptions):** versões exatas fixadas; `tauri` com `default-features = false` + só as features usadas; `edition = "2024"`, `rust-version = "1.90"`; `engines.node` `^24.15.0 || >=26.0.0`; comentário no `Cargo.toml` justificando cada crate.
- **Capabilities:** uma permissão por comando do app (`allow-save-note`…), `"local": true`, nada de shell/fs/rede.
- Branch: `feat/T21-note-commands` (ID da tarefa). Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

## Comandos
```
cd frontend
npm install            # dependências do front
npm run tauri dev      # app em modo dev
npm test               # Vitest
npm run check          # Biome + tsc --noEmit
cd ..
cargo test  --manifest-path backend/Cargo.toml
cargo clippy --manifest-path backend/Cargo.toml -- -D warnings
cargo fmt   --manifest-path backend/Cargo.toml --check
npm run tauri build    # instalador NSIS
```

## Segurança (obrigatório)
- Nunca commite segredos, `.env` ou bancos `.db`.
- Valide **toda** entrada no Rust (tamanho, formato); use apenas SQL parametrizado.
- Nunca use `innerHTML`/`insertAdjacentHTML` com conteúdo de nota: só `textContent`.
- Capabilities mínimas; nenhum acesso a shell, fs arbitrário ou rede no MVP. CSP restritiva (sem CDN).
- **Nunca grave o conteúdo de notas em logs** (nem em debug).

## Fluxo de trabalho
1. Uma tarefa por vez. Marque `[~]` no `docs/TASKS.md` ao começar.
2. Implemente só o escopo da tarefa; dúvidas → pergunte, não assuma.
3. Valide (testes + critério de pronto) e registre o resultado real em "Registro de validações".
4. Marque `[x]` apenas com a validação feita.
5. **Não faça commit, push, merge, release ou deploy sem pedido explícito do usuário.**

## Não faça
- Adicionar dependência sem justificar e verificar a versão atual na documentação oficial.
- Implementar itens de "Fora do escopo" (Anki, Obsidian, Notion, voz, tags, macOS/Linux, sync).
- Inventar métricas (latência, memória): só valores medidos.
- Reescrever arquivos de outro agente "para ajudar".
