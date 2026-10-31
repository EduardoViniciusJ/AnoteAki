# TASKS: AnoteAki (MVP)

Status: `[ ]` pendente · `[~]` em andamento · `[x]` concluída (só com validação registrada).
Agentes: **Codex** (`backend/`) · **Claude** (`frontend/`) · **agy** (pesquisa, sem código de produção) · **Orq.** (orquestrador: docs, contrato, revisão, merge com aprovação) · **Usuário**.
Ao fim de cada etapa existe um exercício de aprendizado do usuário (seção "Exercícios" no fim); ele acontece antes da próxima etapa.
Referências: contrato de comandos em `PRD.md` §12; telas e teclado em `DESIGN-GUIDELINES.md` → "Telas e teclado".

---

## Etapa 0: Fundação

### [x] T01. Scaffold do projeto Tauri 2 + Vite (TS puro)
- **Objetivo:** projeto que roda `npm run tauri dev` e mostra uma página em branco.
- **Agente:** Codex · **Pastas:** `frontend/` (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts` placeholder (hoje `main.tsx`), `scripts/tauri.mjs`), `backend/`
- **Depende de:** —
- **Entregáveis:** estrutura `backend/` + `frontend/` (modelo AnyCaptions: Tauri apontando para `../frontend`); identifier `com.anoteaki.desktop`; `.gitignore` (target, node_modules, `*.db`); módulos Rust vazios (`commands/`, `db/`, `shortcut.rs`, `tray.rs`).
- **Pronto quando:** `npm run tauri dev` abre a janela; `cargo test` e `cargo clippy -D warnings` passam.
- **Validação:** manual (screenshot) + comandos acima.

### [x] T02. Ferramentas do front
- **Objetivo:** qualidade automática no TypeScript.
- **Agente:** Claude · **Pastas:** `frontend/`, `package.json` (scripts/devDeps), `biome.json`, `tsconfig.json`, `vitest.config.ts`
- **Depende de:** T01
- **Entregáveis:** TS `strict`; Biome; Vitest; scripts `npm test`, `npm run check`; 1 teste de exemplo.
- **Pronto quando:** `npm run check` e `npm test` passam.
- **Validação:** os comandos acima.

### [x] T03. CI no GitHub Actions
- **Objetivo:** cada push validado em Windows.
- **Agente:** Codex · **Pastas:** `.github/workflows/`
- **Depende de:** T02
- **Entregáveis:** workflow `ci.yml` (`windows-latest`): `cargo fmt --check`, `clippy -D warnings`, `cargo test`, `npm ci`, `npm run check`, `npm test`, `tauri build` sem bundle (debug).
- **Pronto quando:** o workflow fica verde num push de branch.
- **Validação:** link da execução no Registro.

---

## Etapa 1: Janela e atalho (Fase 1)

### [x] T10. Janela principal, CSP e capabilities
- **Objetivo:** janela sem borda, sempre no topo, oculta no início, com as permissões mínimas.
- **Agente:** Codex · **Pastas:** `backend/`
- **Depende de:** T01
- **Entregáveis:** `tauri.conf.json` (decorations false, alwaysOnTop, skipTaskbar, visible false, 360×320, min 280×200); protótipo de `transparent: true` + cantos arredondados, com o resultado registrado (plano B: opaca); CSP `default-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:`; `capabilities/default.json` só com o necessário.
- **Pronto quando:** a janela fica invisível ao iniciar; nenhum plugin/permissão sobrando; a decisão sobre transparência está registrada.
- **Validação:** manual + revisão do Orq. nas capabilities.

### [x] T11. Atalho global (Rust) + `hide_window` + eventos
- **Objetivo:** `Ctrl+Alt+K` mostra e esconde a janela com foco.
- **Agente:** Codex · **Pastas:** `backend/`
- **Depende de:** T10
- **Entregáveis:** registro no Rust via plugin; toggle `show`→centralizar no monitor do cursor→`set_focus`→emitir `window-shown`; comandos `hide_window` e `get_shortcut_status` (falha no registro → mostra a janela); Alt+F4 esconde (não encerra).
- **Pronto quando:** o atalho alterna a janela; um atalho em uso mostra a janela com o aviso, sem crash; o teste com AltGr (ABNT2) está registrado.
- **Validação:** manual; teste unitário da lógica de toggle/estado onde for possível.

### [x] T12. Tela Nota mínima
- **Objetivo:** editor que recebe o foco sempre que a janela aparece.
- **Agente:** Claude · **Pastas:** `frontend/`
- **Depende de:** T11
- **Entregáveis:** layout da Tela 1 (DESIGN-GUIDELINES → Telas e teclado) sem salvar; `src/lib/api.ts` com os tipos do contrato; componentes base (`IconButton`, `NoteEditor`, `Toast`) em React, no padrão do AGENTS.md; ouvir `window-shown` → focar o textarea; `Esc` → `hide_window`; aviso quando `get_shortcut_status` retorna `registered: false`.
- **Pronto quando:** abrir com o atalho e digitar põe o texto no editor.
- **Validação:** manual + Vitest em `api.ts` (mocks de `invoke`) e nos componentes (Testing Library).

### [ ] T13. Medição de base (foco e latência)
- **Objetivo:** primeiros números reais de R1 e R2.
- **Agente:** Usuário + Orq. · **Pastas:** `docs/`
- **Depende de:** T12
- **Entregáveis:** 20 aberturas sobre apps diferentes (taxa de foco); mediana/p95 da latência (método em PRD R2).
- **Pronto quando:** os valores estão no Registro de validações.
- **Validação:** o próprio registro.

---

## Etapa 2: Escrita e salvamento (Fase 2)

### [x] T20. Banco SQLite, migrações e FTS5
- **Objetivo:** banco local criado e versionado na inicialização.
- **Agente:** Codex · **Pastas:** `backend/`
- **Depende de:** T10
- **Entregáveis:** `db/` com abertura em `app_data_dir`, WAL, `PRAGMA user_version`, schema do PRD (notes, notes_fts + triggers, settings); `AppError` com os códigos do contrato.
- **Pronto quando:** testes com `Connection::open_in_memory()` cobrem a migração e a sincronização do FTS (insert/update/delete).
- **Validação:** `cargo test`.

### [x] T21. Comandos `get_last_note`, `get_note`, `save_note`
- **Objetivo:** criar, atualizar e ler notas conforme o contrato.
- **Agente:** Codex · **Pastas:** `backend/`
- **Depende de:** T20
- **Entregáveis:** comandos + validação (limite do body, `color` válido, nota da lixeira não salva); derivação de `title`.
- **Pronto quando:** testes cobrem a criação, a atualização, o título derivado, o limite, `NOT_FOUND` e a lixeira.
- **Validação:** `cargo test`.

### [x] T22. Autosave, nova nota e status
- **Objetivo:** o texto nunca se perde e `Ctrl+N` separa as notas.
- **Agente:** Claude · **Pastas:** `frontend/`
- **Depende de:** T12, T21
- **Entregáveis:** `lib/debounce.ts` (500 ms) + flush em blur, troca de tela e `Ctrl+N`; botão "+"; carregar `get_last_note` no `window-shown`; indicador salvando/salvo/erro.
- **Pronto quando:** digitar → esconder → reabrir → reiniciar o app mantém o texto; `Ctrl+N` + digitar gera 2 notas; o teste R6 está registrado.
- **Validação:** Vitest (debounce com fake timers, fluxo de rascunho `id=null`) + manual.

---

## Etapa 3: Histórico (Fase 3)

### [x] T30. Comandos de lista, busca e lixeira
- **Objetivo:** `list_notes`, `search_notes`, `delete_note`, `restore_note`, `purge_note`.
- **Agente:** Codex · **Pastas:** `backend/`
- **Depende de:** T21
- **Entregáveis:** comandos + escape de consulta FTS + paginação + preview.
- **Pronto quando:** testes: "acao" encontra "ação"; entrada com `"`, `*`, `-`, `NEAR` não gera erro; notas vazias fora de `active`; ordem por `updatedAt`/relevância; purge só na lixeira.
- **Validação:** `cargo test`.

### [x] T31. Tela Histórico
- **Objetivo:** reencontrar notas por data ou busca.
- **Agente:** Claude · **Pastas:** `frontend/`
- **Depende de:** T22, T30
- **Entregáveis:** Tela 2 (DESIGN-GUIDELINES → Telas e teclado) com agrupamento por dia, busca com debounce de 200 ms, paginação, navegação ↑/↓/Enter/Delete/Esc, toast "Desfazer"; conteúdo de nota só como texto JSX.
- **Pronto quando:** a hipótese H4 é testada (10 notas) e registrada; tudo funciona sem mouse.
- **Validação:** Vitest (`groupByDay`, formatação de datas) + manual.

### [x] T32. Lixeira na UI
- **Objetivo:** restaurar ou excluir definitivamente.
- **Agente:** Claude · **Pastas:** `frontend/`
- **Depende de:** T31
- **Entregáveis:** aba Lixeira; nota da lixeira aberta como somente leitura com "Restaurar"; confirmação no excluir definitivo.
- **Pronto quando:** excluir → lixeira → restaurar volta para Notas; purgar remove para sempre.
- **Validação:** manual.

---

## Etapa 4: Bandeja e sistema (Fase 4)

### [x] T40. Bandeja
- **Objetivo:** ícone com Abrir e Sair; o app vive na bandeja.
- **Agente:** Claude · **Pastas:** `backend/`
- **Depende de:** T11
- **Entregáveis:** tray nativo (clique esquerdo mostra, menu Abrir/Sair, tooltip); `window-shown` com `reason: "tray"`; "Sair" encerra todos os processos.
- **Pronto quando:** depois de "Sair", nenhum processo AnoteAki/WebView2 do app permanece.
- **Validação:** manual (Gerenciador de Tarefas).

### [x] T41. Instância única
- **Objetivo:** uma 2ª execução só mostra a janela existente.
- **Agente:** Claude · **Pastas:** `backend/`
- **Depende de:** T40
- **Entregáveis:** plugin single-instance; `window-shown` com `reason: "second-instance"`.
- **Pronto quando:** abrir o .exe 2 vezes resulta em 1 ícone na bandeja.
- **Validação:** manual.

### [~] T42. Iniciar com o Windows
- **Objetivo:** atalho disponível logo após o login.
- **Agente:** Claude · **Pastas:** `backend/`
- **Depende de:** T40
- **Entregáveis:** **opção do instalador** (T90), que cria a entrada de inicialização do Windows; o app abre oculto. Sem controle dentro do app (decisão do usuário, 29/10/2026): para desligar, Gerenciador de Tarefas → Aplicativos de inicialização. O app não usa o plugin autostart.
- **Pronto quando:** depois de reiniciar o Windows, o atalho funciona sem abrir nada.
- **Validação:** manual.

---

## Etapa 5: Design e configurações (Fase 5)

### [~] T50. Configurações no Rust
- **Objetivo:** `get_settings`, `set_setting` e os comportamentos ligados a eles.
- **Agente:** Codex · **Pastas:** `backend/`
- **Depende de:** T20, T42
- **Entregáveis:** comandos com validação por chave; troca de atalho em tempo real (rollback se falhar); `hideOnBlur` via `Focused(false)`.
- **Pronto quando:** testes de validação; trocar o atalho funciona sem reiniciar.
- **Validação:** `cargo test` + manual.

### [~] T51. Tokens, temas e fonte
- **Objetivo:** a identidade visual do DESIGN-GUIDELINES aplicada.
- **Agente:** Claude · **Pastas:** `frontend/`
- **Depende de:** T22
- **Entregáveis:** `styles/tokens.css`; tema `system`/`light`/`dark` via `data-theme` + `prefers-color-scheme`; Inter via `@fontsource-variable/inter` (embutida pelo Vite, sem rede); animações com reduced-motion.
- **Pronto quando:** trocar o tema do Windows muda o app em tempo real; nenhum hex fora de `tokens.css`.
- **Validação:** manual nos 2 temas + `grep` por `#` fora dos tokens.

### [ ] T52. Tela Configurações
- **Objetivo:** ajustar tema, atalho e comportamentos pela UI.
- **Agente:** Claude · **Pastas:** `frontend/`
- **Depende de:** T50, T51
- **Entregáveis:** Tela 3 (DESIGN-GUIDELINES → Telas e teclado) com captura de atalho e aplicação imediata.
- **Pronto quando:** cada opção persiste depois de reiniciar o app.
- **Validação:** manual + Vitest (parser/formatador do atalho capturado).

### [ ] T53. Passada de acessibilidade
- **Objetivo:** tudo utilizável só com o teclado, com foco visível.
- **Agente:** Claude · **Pastas:** `frontend/`
- **Depende de:** T32, T52
- **Entregáveis:** correções de foco, `aria-label`, ordem de Tab, mapa de teclado completo (DESIGN-GUIDELINES → Telas e teclado).
- **Pronto quando:** roteiro sem mouse cobrindo as 3 telas, executado e registrado.
- **Validação:** manual.

### [ ] T54. Auditoria de acessibilidade e contraste
- **Objetivo:** uma verificação independente do T53.
- **Agente:** agy · **Pastas:** nenhuma (relatório em `docs/research/T54.md`, salvo pelo Orq.)
- **Depende de:** T53
- **Entregáveis:** lista de problemas com a referência WCAG.
- **Pronto quando:** cada problema foi corrigido ou aceito pelo usuário.
- **Validação:** revisão do Orq.

### [x] T55. Cor e transparência por post-it
- **Objetivo:** escolher entre as 6 cores da paleta e 3 níveis de opacidade.
- **Agente:** Claude · **Pastas:** `frontend/`, `backend/`
- **Depende de:** T21
- **Entregáveis:** menu de cor/transparência na barra do post-it; rotação de 4 cores nos post-its novos; a cor também aparece no histórico.
- **Pronto quando:** a cor e a opacidade persistem e são respeitadas nos 2 temas.
- **Validação:** manual.

### [x] T56. Post-its em janelas separadas
- **Objetivo:** cada nota num post-it próprio, como post-its na tela.
- **Agente:** Claude · **Pastas:** `frontend/`, `backend/`, `docs/`
- **Depende de:** T22
- **Entregáveis:** `Ctrl+N` abre outro post-it; `Ctrl+Alt+K`/`Esc` mostram e escondem todos; "×" fecha um; os post-its abertos voltam ao reiniciar com posição e tamanho; abrir pelo histórico abre o post-it da nota.
- **Pronto quando:** 3 post-its abertos → reiniciar → os 3 voltam no lugar; um post-it em branco não vira nota.
- **Validação:** `cargo test` + Vitest + manual.

### [x] T57. Título da nota
- **Objetivo:** título opcional em negrito, separado do texto.
- **Agente:** Claude · **Pastas:** `frontend/`, `backend/`
- **Depende de:** T21
- **Entregáveis:** campo de título acima do texto; `Tab`/`Enter` vão para o texto; sem título, o histórico usa a 1ª linha; título em negrito no histórico e na busca.
- **Pronto quando:** nota só com título aparece e é encontrada no histórico.
- **Validação:** `cargo test` + Vitest.

---

## Etapa 9: Lançamento (Fase 9)

### [ ] T90. Empacotamento
- **Objetivo:** instalador NSIS funcional.
- **Agente:** Codex · **Pastas:** `backend/` (bundle, ícones, versão `0.1.0`)
- **Depende de:** T42, T53
- **Entregáveis:** instalador; teste em um usuário/VM limpo; o comportamento do SmartScreen registrado (R8).
- **Pronto quando:** instalar → usar → desinstalar funciona sem resíduo além do `%APPDATA%` (documentado).
- **Validação:** manual.

### [ ] T91. Medições finais e uso real
- **Objetivo:** validar H1 a H4 com números reais.
- **Agente:** Usuário + Orq. · **Pastas:** `docs/`
- **Depende de:** T90
- **Entregáveis:** R1, R2, R3 e R6 medidos no build de release; diário de 2 semanas de uso (H3).
- **Pronto quando:** todos os valores estão no Registro.
- **Validação:** o próprio registro.

### [ ] T92. Documentação final
- **Objetivo:** docs (PRD, BRIEF, MVP-SCOPE) condizentes com o que foi entregue; criar o README público.
- **Agente:** Orq. · **Pastas:** `README.md`, `docs/`
- **Depende de:** T91
- **Pronto quando:** as instruções do README funcionam numa máquina limpa; as decisões em aberto do PRD estão resolvidas ou adiadas explicitamente.
- **Validação:** seguir o README do zero.

### [ ] T93. Release v0.1.0
- **Objetivo:** publicar no GitHub Releases.
- **Agente:** Orq. (**só com aprovação explícita do usuário**) · **Pastas:** —
- **Depende de:** T92
- **Pronto quando:** release publicada com o instalador e as notas de versão.
- **Validação:** baixar e instalar a partir da release.

---

## Exercícios do usuário (um por etapa)
Feitos pelo usuário numa branch `learn/<etapa>-<slug>`; o agente só revisa quando pedido.
| Etapa | Exercício |
|---|---|
| 0 Fundação | Quebrar a formatação Rust de propósito numa branch e ver o CI (`cargo fmt --check`) ficar vermelho. |
| 1 Janela e atalho | Registrar no Rust um atalho de teste `Ctrl+Alt+J` que imprime `pressed`/`released` (ShortcutState); depois remover. |
| 2 Salvamento | Teste Rust: `save_note` com 100 001 caracteres retorna `INVALID_INPUT`; escrever o próprio `debounce` em TS com Vitest e fake timers. |
| 3 Histórico | `groupByDay(notes, now)` em TS com testes na virada da meia-noite; `escape_fts_query` em Rust com testes para `"`, `*`, `-`. |
| 4 Bandeja | Clique esquerdo na bandeja alternando mostrar/esconder, extraindo uma função `toggle_main_window` compartilhada com o atalho. |
| 5 Design | Propor uma 7ª cor de sticker e decidir, com o contraste calculado nos 2 temas, se ela entra. |
| 9 Lançamento | Comparar o tamanho do instalador e a memória em repouso com e sem `lto = true`. |

---

## Registro de validações
Somente resultados reais. Formato: data · tarefa · quem · resultado · evidência (comando, link, print).

| Data | Tarefa | Quem | Resultado | Evidência |
|---|---|---|---|---|
| 2026-10-28 | T01 | Orq. (Codex sem login no Orca) | ok: `npm run tauri dev` abre a janela "AnoteAki"; `cargo test`, `clippy -D warnings` e `fmt --check` passam | screenshot local; Tauri 2.12.5, Vite 8.3.5, TS 7.0.2 |
| 2026-10-28 | T02 | Orq. | ok: `npm run check` (Biome 2.6.4 + tsc) e `npm test` (Vitest 5.0.5, 3 testes) passam | saída local |
| 2026-10-28 | T03 | Orq. | ok: workflow verde em windows-latest (todos os passos, incl. `tauri build --debug --no-bundle`) | [run 40794665592](https://github.com/EduardoViniciusJ/AnoteAki/actions/runs/40794665592) |
| 2026-10-28 | T10 | Orq. | ok: a janela começa invisível; sem borda, sempre no topo, fora da barra de tarefas, 360×320 (mín. 280×200); CSP de produção sem quebrar o IPC; capabilities só com `event:listen/unlisten`, `window:start-dragging`, `allow-hide-window` e `allow-get-shortcut-status`. **Transparência:** não adotada. A janela opaca com `shadow: true` já ganha cantos arredondados e sombra nativos do Windows 11 (print), sem os problemas de janela transparente do WebView2 | prints locais |
| 2026-10-28 | T11 | Orq. | ok (teclas simuladas via `keybd_event`): Ctrl+Alt+K mostra e põe em 1º plano; com foco, esconde; visível sem foco, traz para frente; Alt+F4 esconde e o processo continua. **AltGr+K (ABNT2) também dispara o atalho** (AltGr = Ctrl+Alt no Windows; no ABNT2 AltGr+K não gera caractere, então não há conflito). Atalho em uso (2ª instância): a janela aparece com o aviso, sem crash. **Bug achado e corrigido:** na 1ª exibição após iniciar, a janela não vinha para frente; agora o `set_focus` se repete na volta seguinte do loop. **Contrato:** o evento `shortcut-registration-failed` se perdia (emitido antes do `listen()` do JS) e foi trocado pelo comando `get_shortcut_status` (PRD §12) | `cargo test` (9 testes) + prints |
| 2026-10-28 | T12 | Orq. | ok: depois do atalho, as letras digitadas (sem clicar) caem no editor; Esc esconde; componentes `IconButton`, `NoteEditor`, `Toast` e a tela `NoteScreen`, renderizados só com `textContent` | `npm test` (13 testes, incl. `api.ts` com `invoke` mockado) + print |
| 2026-10-28 | T12 (React) | Orq. | ok: front migrado para React 19 (decisão do usuário: manutenção e testes). Build com a CSP de produção e modo dev testados: atalho → digitar cai no editor → Esc esconde | `npm test` (21 testes: api, NoteScreen, App) + print |
| 2026-10-29 | T20 | Claude | ok: banco em `%APPDATA%\com.anoteaki.desktop\anoteaki.db` (WAL, `user_version` = 1), schema do PRD §6 com `notes_fts` (unicode61 sem acentos) e triggers; o FTS acompanha insert/update/delete; banco de versão mais nova é recusado; se o banco não abrir, o app abre e os comandos devolvem `DB_ERROR`. `AppError` com `INVALID_INPUT`, `NOT_FOUND`, `DB_ERROR`, `INTERNAL` (o erro do SQLite não vai para o front). rusqlite 0.41.1 `bundled` (FTS5 confirmado por teste) | `cargo test` (45 testes), `clippy -D warnings`, `fmt --check`; app real criou o arquivo |
| 2026-10-29 | T21 | Claude | ok: `get_last_note`, `get_note`, `save_note` com título derivado (80 chars), limite de 100 000 caracteres, cor validada, nota da lixeira não salva, `NOT_FOUND`. Salvar o mesmo texto não muda o `updatedAt`. **Desvio do contrato:** `color` ausente ou `null` mantém a cor atual (o `invoke` não distingue os dois); voltar para a cor padrão fica para o T55. No app real, digitar criou a nota 1 uma vez e as edições seguintes a atualizaram | `cargo test` + consulta ao banco |
| 2026-10-29 | T30 | Claude | ok: `list_notes` (ordem `updatedAt`, paginação, vazias fora de `active`), `search_notes` ("acao" acha "ação", `"`/`*`/`-`/`NEAR`/`AND`/`:`/`^`/`(` sem erro, só ativas, `bm25`), `delete_note`, `restore_note`, `purge_note` (só na lixeira). No banco real, `MATCH 'acao'` achou "Plano de ação" | `cargo test` + consulta ao banco |
| 2026-10-29 | T22, T31, T32 (parcial) | Claude | parcial: autosave (debounce 500 ms, flush em blur, troca de tela e Ctrl+N, fila única de `save_note` sem criar a nota duas vezes, troca de nota recusada se o salvamento falhar), status salvando/salvo/erro, Histórico (grupos por dia, busca 200 ms, paginação, ↑/↓/Home/End/Enter/Delete/Esc, Desfazer 5 s) e Lixeira (restaurar, excluir para sempre com confirmação, nota da lixeira só leitura com "Restaurar"). **Falta:** a validação manual integrada (persistência após reiniciar, H4, R6), que depende do backend T20/T21/T30 | `npm test` (65 testes, com `invoke` mockado), `npm run check` e `npm run build` passam |
| 2026-10-29 | T55, T56, T57 (parcial) | Claude | parcial: post-its em janelas separadas (criadas no Rust, `note-N`, transparentes), rotação de 4 cores, menu com 6 cores + opacidade 100/85/70, título opcional (`heading`, migração v2), `open_windows` para reabrir os post-its no lugar. App real: o post-it abriu transparente com cantos arredondados, 70% deixa ver o fundo e salvou. **Bug achado e corrigido:** o "+" travava o app, porque criar janela em comando síncrono trava no Windows (wry #583); os comandos de janela viraram `async`. **2º bug:** fechar o último post-it encerrava o app (padrão do Tauri); agora o processo continua e o atalho abre um novo. **Falta:** teste manual do usuário (vários post-its, reiniciar e voltarem no lugar) | `cargo test` (59), `clippy`, `fmt`; `npm test` (76), `npm run check` |
| 2026-10-29 | T22, T31, T32, T55, T56, T57 | Usuário | ok: testados no app real (autosave, histórico, lixeira, post-its, cores, transparência, ordem da pilha com Ctrl+Alt+K) | PRs #7 e #8 |
| 2026-10-29 | T40, T41, T42 (parcial) | Claude | T41 ok: rodar o .exe de novo com o app aberto encerra a 2ª execução na hora (código 0) e fica 1 processo. Bandeja (Abrir, Sair) implementada; o usuário testou o "Sair" (nenhum processo restou). "Iniciar com o Windows" saiu do app e vai para o instalador (T90); a ordem da pilha dos post-its agora é salva no banco (migração v3, coluna `stack`). **Falta:** a opção do instalador (T90) | `cargo test` (61), `clippy`, `fmt`; 2ª execução do .exe |
| 2026-10-30 | T50 (parcial) | Claude | parcial: `get_settings`/`set_setting` (tabela `settings`, valor ausente ou inválido no banco → padrão; validação por chave e tipo, `INVALID_INPUT` para chave desconhecida, tipo errado, tema fora da lista, atalho vazio, > 64 caracteres, sem modificador ou mal formado). Troca de atalho: registra o novo, salva e só então solta o antigo; se o Windows recusar → `SHORTCUT_UNAVAILABLE` e o antigo continua; se o banco falhar, desfaz o registro. Na inicialização vale o atalho salvo (inválido → padrão). `hideOnBlur` esconde todos os post-its 150 ms depois de perder o foco, a não ser que o foco tenha ido para outro post-it. App real: atalho mostrou o post-it e focar outra janela o escondeu (teclas simuladas). **Falta:** trocar o atalho pelo app real (depende da tela do T52) | `cargo test` (76), `clippy -D warnings`, `fmt --check`; `npm test` (76), `npm run check` |
| 2026-10-30 | T51 (parcial) | Claude | parcial: cada cor em `tokens.css` virou `light-dark(claro, escuro)` e o `color-scheme` escolhe o lado (`system` segue o Windows via `prefers-color-scheme`; `data-theme="light"/"dark"` força). O post-it lê o tema em `get_settings` ao abrir e a cada foco (uma troca feita em outro post-it chega a todos). Inter Variable 5.3.0 (`@fontsource-variable/inter`, OFL-1.1) embutida como `.woff2` local (CSP `font-src 'self'`). Animações: abrir 120 ms (opacidade + escala 0,98→1, repetida a cada `window-shown`) e troca de tela 120 ms (fade), nenhuma com `prefers-reduced-motion`. **Não feito:** a animação de esconder (80 ms), porque o Rust esconde a janela na hora e atrasar o `hide()` iria contra "rápido de sair". **Falta:** o teste manual nos 2 temas (trocar o tema do Windows com o app aberto) | `npm test` (82), `npm run check`, `npm run build`; `grep` por hex fora de `tokens.css`: nenhum |
| 2026-10-31 | fix (teclas do WebView2) | Claude | ok: o usuário viu o `Ctrl+F` abrir a busca nativa do WebView2; agora cada post-it desliga as teclas do navegador (`SetAreBrowserAcceleratorKeysEnabled(false)`); as de edição continuam | `cargo test` (76), `clippy`, `fmt` |
| 2026-10-31 | feat (copiar nota) | Claude | ok nos testes: menu copiar (texto ou Markdown com `# Título`), `Ctrl+Shift+C`/`Ctrl+Shift+M`, toast "Copiado" 2 s, erro com aviso, desabilitado em nota vazia; `navigator.clipboard`, sem mudança no Rust. **Falta:** confirmar a cópia no app real | `npm test` (96), `npm run check`, `npm run build` |
