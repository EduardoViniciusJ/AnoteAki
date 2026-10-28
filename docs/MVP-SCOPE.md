# MVP-SCOPE: AnoteAki

Plataforma: **somente Windows**. Ritmo: estudo, sem prazo. Equipe: o usuário + agentes (Codex, Claude, agy).

## No escopo
| Prioridade | Item | Tarefas |
|---|---|---|
| Must | Atalho global (`Ctrl+Alt+K`) que mostra e esconde a janela | T11 |
| Must | Janela sem borda, sempre no topo, centralizada, com foco no texto ao abrir | T10, T11, T12 |
| Must | Abre sempre na **última nota**; `Ctrl+N` e o botão "+" criam uma nota nova; título = 1ª linha | T21, T22 |
| Must | Salvamento automático no SQLite (debounce + flush) | T20, T21, T22 |
| Must | Histórico por data, busca (FTS5, sem diferenciar acentos) e exclusão | T30, T31 |
| Must | Bandeja com Abrir e Sair; fechar a janela só esconde | T40 |
| Must | Instância única | T41 |
| Must | Iniciar com o Windows (padrão: ligado) | T42 |
| Should | Tema claro e escuro: segue o Windows ou escolha manual | T51, T52 |
| Should | Tela de Configurações: tema, atalho, esconder ao perder o foco, iniciar com o Windows | T50, T52 |
| Should | Esconder ao perder o foco (padrão: ligado, configurável) | T50 |
| Should | Lixeira (restaurar / excluir definitivo) | T30, T32 |
| Should | `Esc` esconde a janela / volta para a nota | T12, T31 |
| Could | Cor de sticker por nota (paleta de 6) | T55 |
| Could | Atalho para copiar a nota inteira | — (backlog) |

## Fora do escopo (futuro)
| Item | Fase futura | Motivo de ficar fora |
|---|---|---|
| Cartões para o Anki (AnkiConnect) | 6 | Depende do Anki aberto + add-on; valide o uso diário primeiro |
| Exportar para o Obsidian (.md com frontmatter) | 7 | Exige escolha de pasta e permissões de arquivo |
| Enviar para o Notion (token no Gerenciador de Credenciais) | 8 | Rede + segredo; maior superfície de risco |
| Ditado por voz (Nemotron ASR) | Posterior | Download grande; complexidade alta |
| Tags e markdown | Posterior | Primeiro validar se a busca basta |
| macOS / Linux | Posterior | Janela, foco e bandeja se comportam diferente; triplica os testes |
| Sincronização / nuvem | Não planejado | Contraria a proposta offline/privada |
| Atualização automática / assinatura de código | Pós-MVP | Custo do certificado; decidir com base no uso público |

Consequências técnicas: `reqwest`, `keyring`, `tauri-plugin-dialog` e a tabela `pending_exports` **não** entram no MVP.

## Justificativas
- As integrações são o diferencial de longo prazo, mas só valem se o núcleo (abrir rápido + salvar + achar) for usado de verdade.
- O autostart e a instância única são must porque, sem eles, o atalho (o diferencial principal) não está disponível ou fica instável.
- FTS5 em vez de `LIKE`: a busca é um dos diferenciais declarados.

## Hipóteses a validar
| ID | Hipótese | Validação |
|---|---|---|
| H1 | A janela abre rápido o bastante para não quebrar o fluxo | Medição de latência (T13, T91) + percepção nas 2 semanas de uso |
| H2 | O foco cai no editor sempre que a janela abre | Teste de 20 aberturas (T13) |
| H3 | O autor usa o app em ≥ 8 de 10 dias úteis | Diário simples no Registro de validações (T91) |
| H4 | A busca encontra notas antigas na 1ª tentativa | Teste com 10 notas (T31) |

## Métricas de sucesso
Ver `BRIEF.md` (tabela de métricas).
