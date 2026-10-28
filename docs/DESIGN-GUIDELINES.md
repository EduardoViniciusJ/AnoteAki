# DESIGN-GUIDELINES: AnoteAki

Estilo: **sticky note digital**, com cores pastel no tema claro, tons escuros e dessaturados no tema escuro, e interface discreta.

## Princípios
1. **O texto é o protagonista:** os controles ficam pequenos e discretos; o editor ocupa quase toda a janela.
2. **Rápido de entrar e de sair:** animações curtas e nenhum passo extra entre o atalho e a digitação.
3. **Calmo:** sem gradientes, sem cores saturadas e com sombra leve.
4. **Teclado em primeiro lugar:** tudo tem atalho, e o foco é sempre visível.
5. **Consistente:** todas as cores, espaçamentos e raios vêm de tokens; nada de valores soltos no CSS.

## Referências
- Post-its físicos (cores pastel, papel fosco).
- Microsoft Sticky Notes (concorrente: referência do que já é familiar no Windows).
- Raycast / PowerToys Run (janela de atalho global que abre e some rápido).

## Tokens de cor
Contraste calculado pela fórmula WCAG 2.x (script em node, 28/10/2026). Todas as combinações abaixo passam de **AA (≥ 4,5:1)**.

```css
:root {                         /* tema claro */
  --ink:        #1F1E1C;  /* texto principal */
  --ink-muted:  #5C5A55;  /* metadados, placeholders */
  --accent:     #2F55C8;  /* foco, links, ação primária */
  --danger:     #B3261E;  /* erro, excluir */
  --sticker:    var(--sticker-yellow); /* fundo da janela/nota */
  --surface-2:  rgb(0 0 0 / 0.05);     /* hover em itens de lista */
  --border:     rgb(0 0 0 / 0.12);
  --shadow:     0 6px 20px rgb(0 0 0 / 0.14), 0 1px 3px rgb(0 0 0 / 0.08);

  --sticker-yellow: #FFF4B8; --sticker-pink:  #FFDDE5; --sticker-blue:  #D9ECFF;
  --sticker-green:  #DDF3D5; --sticker-lilac: #E9E0FF; --sticker-paper: #F4F2EE;
}
:root[data-theme="dark"] {      /* também aplicado via prefers-color-scheme quando theme = system */
  --ink:        #F3F1EC;
  --ink-muted:  #B9B5AD;
  --accent:     #8DB2FF;
  --danger:     #FFB4AB;
  --sticker:    var(--sticker-paper);
  --surface-2:  rgb(255 255 255 / 0.06);
  --border:     rgb(255 255 255 / 0.12);
  --shadow:     0 6px 20px rgb(0 0 0 / 0.45);

  --sticker-yellow: #3A3522; --sticker-pink:  #3D2A31; --sticker-blue:  #22313E;
  --sticker-green:  #25342A; --sticker-lilac: #302A42; --sticker-paper: #2A2927;
}
```

| Fundo | ink claro | muted claro | accent claro | ink escuro | muted escuro | accent escuro |
|---|---|---|---|---|---|---|
| yellow | 14,98 | 6,19 | 5,80 | 10,87 | 6,00 | 5,81 |
| pink | 13,27 | 5,49 | 5,14 | 11,82 | 6,53 | 6,32 |
| blue | 13,80 | 5,70 | 5,34 | 11,80 | 6,52 | 6,31 |
| green | 14,16 | 5,86 | 5,49 | 11,60 | 6,41 | 6,20 |
| lilac | 13,14 | 5,44 | 5,09 | 12,12 | 6,69 | 6,48 |
| paper | 14,90 | 6,16 | 5,77 | 12,88 | 7,11 | 6,88 |

Qualquer cor nova precisa passar no mesmo cálculo antes de entrar.

## Paleta de stickers
| Nome | Uso sugerido |
|---|---|
| `yellow` | Padrão no tema claro: anotação geral |
| `pink` | Urgente / lembrar hoje |
| `blue` | Estudo / vocabulário |
| `green` | Ideias / feito |
| `lilac` | Código / técnico |
| `paper` | Neutro; padrão no tema escuro |

No MVP, a cor por nota é "could" (T55); até lá, o app usa o padrão do tema.

## Tipografia
- **Inter** (SIL Open Font License 1.1), arquivo variável `.woff2` embutido em `src/assets/fonts/` via `@font-face`. Fallback: `"Segoe UI", system-ui, sans-serif`.
- Editor: monoespaçada **não**; o texto da nota usa Inter.

| Token | Tamanho | Peso | Altura de linha | Uso |
|---|---|---|---|---|
| `--text-xs` | 12px | 400 | 1.4 | Metadados, contador, toast |
| `--text-sm` | 14px | 400/500 | 1.45 | Lista do histórico, botões, configurações |
| `--text-md` | 16px | 400 | 1.55 | Texto do editor |
| `--text-lg` | 18px | 600 | 1.3 | Títulos de tela (Histórico, Configurações) |

## Espaçamento, raio e sombra
- Escala com base 4px: `--space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px`.
- Raio: `--radius-window: 12px` (se a transparência funcionar; plano B: 0), `--radius-control: 6px`.
- Sombra: só `--shadow` na janela/nota e nos menus. Os controles não têm sombra.

## Componentes e estados
| Componente | Normal | Hover | Foco (teclado) | Desabilitado | Erro |
|---|---|---|---|---|---|
| Janela/nota | fundo `--sticker`, `--shadow` | — | — | — | — |
| Editor (`textarea`) | sem borda, fundo transparente, `--text-md` | — | sem contorno (o cursor basta); a janela já indica o foco | `readonly` na lixeira: `--ink-muted` | barra de status com `--danger` |
| Botão ícone ("+", histórico, config) | `--ink-muted`, 28×28px, área de toque ≥ 32px | fundo `--surface-2`, `--ink` | anel `2px solid var(--accent)`, offset 2px | opacidade 0.4, `aria-disabled` | — |
| Item da lista | título `--text-sm` 500 + preview `--ink-muted` | fundo `--surface-2` | anel `--accent` + fundo `--surface-2` | — | — |
| Campo de busca | borda `--border`, raio `--radius-control` | borda `--ink-muted` | anel `--accent` | — | — |
| Botão destrutivo (excluir definitivo) | texto `--danger` | fundo `--surface-2` | anel `--accent` | opacidade 0.4 | — |
| Toast ("Desfazer") | fundo `--ink`, texto `--sticker` | — | botão interno com anel | — | variante com borda `--danger` |
| Captura de atalho (config.) | mostra o atalho atual | — | "pressione as teclas…" | — | mensagem `--danger` se `SHORTCUT_UNAVAILABLE` |

Teclado: sempre use `:focus-visible`; a ordem de Tab segue a leitura; a lista do histórico usa ↑/↓ (roving tabindex); `Esc` sempre "volta um nível". O mapa completo está em "Telas e teclado", no fim deste documento.

## Animações
| Momento | Duração | Efeito | Com `prefers-reduced-motion: reduce` |
|---|---|---|---|
| Abrir janela | 120ms `ease-out` | opacidade 0→1 + escala 0.98→1 | só opacidade, 0ms |
| Esconder janela | 80ms `ease-in` | opacidade 1→0 | nenhuma |
| Trocar de tela | 120ms | crossfade | nenhuma |
| Toast | 150ms | deslizar 8px + fade | só fade |

A animação de abrir **nunca** pode atrasar o foco do editor.

## Faça / não faça
| Faça | Não faça |
|---|---|
| Use tokens para toda cor, espaço e raio | Hex solto no CSS de componente |
| Mantenha o editor com ≥ 80% da área | Barras de ferramentas grandes |
| Anel de foco visível em todo elemento interativo | `outline: none` sem substituto |
| Ícones com `aria-label` | Ícone sem rótulo acessível |
| Sombra única e leve | Sombras empilhadas e escuras no tema claro |
| Textos curtos de interface | Sobrepor animações ou passar de 150ms |
| Testar o contraste de cada cor nova | Branco puro `#FFF` / preto puro `#000` como fundo da nota |

## Telas e teclado

### Janela
- Tamanho inicial 360×320px (ajustar no T10), redimensionável, mínimo 280×200px.
- Sem borda, sempre no topo, fora da barra de tarefas, centralizada no monitor do cursor.
- Área de arrastar: a faixa superior (`data-tauri-drag-region`), exceto os botões.

### Tela 1: Nota (padrão)
**Objetivo:** escrever imediatamente.
```
┌───────────────────────────────────┐
│ [drag region]        [+] [⌕] [⚙]  │  ← barra de 32px, ícones discretos
│                                   │
│  editor (textarea, ~85% da área)  │
│                                   │
│                       ● salvo     │  ← status xs, ink-muted
└───────────────────────────────────┘
```
- Hierarquia: o editor (foco automático) vem primeiro; "+" (nova nota), Histórico e Configurações são secundários.
- Estados: vazio (placeholder curto) · salvando · salvo · erro ao salvar (status em `--danger` + nova tentativa no próximo debounce) · somente leitura (nota da lixeira, com a ação "Restaurar" na barra).
- Aviso não bloqueante quando ocorre `shortcut-registration-failed`, com uma ação que leva às Configurações.

### Tela 2: Histórico
**Objetivo:** reencontrar e gerenciar notas.
```
┌───────────────────────────────────┐
│ [←]  [ busca .................. ] │
│ [Notas | Lixeira]                 │
│ HOJE                              │
│  Título da nota          14:03    │
│  preview em ink-muted…            │
│ ONTEM                             │
│  …                                │
└───────────────────────────────────┘
```
- Ao abrir, o foco vai para a busca; ↓ entra na lista.
- Lista agrupada por dia (Hoje / Ontem / data por extenso), paginada ao rolar (50 por vez).
- Com busca ativa: lista plana por relevância, sem grupos.
- Ação por item: abrir (Enter/clique), excluir (Delete / botão no hover e no foco). Na lixeira: restaurar e excluir definitivo (com confirmação).
- Estados: carregando · lista vazia · busca sem resultado · erro.
- Toast "Desfazer" depois de excluir (5 s).

### Tela 3: Configurações
**Objetivo:** ajustar o comportamento sem editar arquivos.
- Seções em ordem: Aparência (tema: Sistema/Claro/Escuro) → Atalho (campo de captura + restaurar padrão) → Comportamento (esconder ao perder o foco; iniciar com o Windows) → Sobre (versão, link para a política de privacidade).
- Cada mudança aplica na hora (`set_setting`), sem botão "Salvar".
- Estados: erro de atalho indisponível no próprio campo.

### Menu da bandeja
- Clique esquerdo: mostra a janela (`window-shown` com `reason: "tray"`).
- Menu do clique direito: **Abrir** · separador · **Sair**.
- Tooltip: nome do app.

### Mapa de teclado
| Tecla | Contexto | Ação |
|---|---|---|
| `Ctrl+Alt+K` (configurável) | global | Mostrar / esconder |
| `Esc` | Nota | Esconder a janela |
| `Esc` | Histórico / Configurações | Voltar para Nota (na busca preenchida: limpa primeiro) |
| `Ctrl+N` | Nota | Nova nota |
| `Ctrl+H` | Nota | Abrir Histórico |
| `Ctrl+F` | Nota / Histórico | Histórico com foco na busca |
| `Ctrl+,` | qualquer | Configurações |
| `↑` / `↓` | lista | Mover a seleção |
| `Enter` | lista | Abrir nota |
| `Delete` | lista | Excluir (para a lixeira) |
| `Tab` / `Shift+Tab` | qualquer | Ordem natural de leitura |
