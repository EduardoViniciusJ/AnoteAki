# BRIEF: AnoteAki

| | |
|---|---|
| **Problema** | Anotar algo rápido no meio do estudo ou do trabalho obriga a trocar de janela, e isso quebra a concentração. |
| **Solução** | Um app de Windows que abre um post-it digital com um atalho global, salva sozinho e some quando você termina. |
| **Público** | Estudantes (idiomas, concursos, faculdade), desenvolvedores e quem anota muito sem querer sair do que está fazendo. |
| **Modelo** | Gratuito e de uso próprio + distribuição pública grátis (GitHub Releases). Sem monetização planejada. |

## Diferencial
O concorrente direto é o **Sticky Notes**, que já vem no Windows. O AnoteAki se diferencia por:
1. **Atalho global instantâneo:** abre e fecha sem trocar de janela, com o foco já no texto.
2. **Histórico e busca melhores:** lista por data e busca de texto completo sem diferenciar acentos.
3. **Foco em estudo (futuro):** envio de cartões para o Anki e exportação para o Obsidian e o Notion (fora do MVP).

Também é offline, privado e sem conta.

## Métricas de sucesso do MVP
| Métrica | Como medir | Meta |
|---|---|---|
| Uso real | O próprio autor usa o app em dias úteis por 2 semanas | ≥ 8 de 10 dias úteis |
| Confiabilidade do foco | 20 aberturas sobre apps diferentes: o texto digitado cai na nota | 20/20 |
| Busca | 10 notas antigas buscadas por palavra lembrada | Encontradas na 1ª busca em ≥ 9/10 |
| Perda de dados | Processo encerrado à força 1 s depois de digitar | Nada perdido além da janela de debounce (500 ms) |
| Latência e memória | Medidas e registradas (ver `PRD.md`, riscos) | Sem meta antes da primeira medição |

Mais detalhes: `PRD.md` · `MVP-SCOPE.md`.
