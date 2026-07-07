# Hall — resposta à Direção Visual (Hall-Redesign-Direction-001)

> A direção do Claude Design é uma **proposta**, não spec. Atuei como Product Designer + Eng. Frontend:
> aproveitei o excelente, adaptei o que colide com as regras, descartei o que arriscaria o produto.
> Regras absolutas respeitadas: nada de regra/query/service/métrica/cálculo/permissão/server action/**estado**/
> API/hook de negócio/**componente compartilhado do DS**/**responsividade existente**. Só apresentação, só tokens
> do DS 2.0. Limitação honesta: **não vejo os pixels** — por isso implementei o que é reorganização de dados
> (baixo risco de "parecer errado") e documentei o que exige verificação visual.

## IMPLEMENTADO (Fase 1 — commit desta sprint)
| Item | O que | Por quê |
|---|---|---|
| **Hero executivo (Z1 Contexto)** | Saudação + data inline + **frase do dia** (pendentes · hoje · reuniões · leads) + **alertas como chips** clicáveis (não painel) | Entrega "Contexto" e o resumo executivo pedido; corta o desperdício vertical do topo (D1); dado 100% já existente |
| **Alertas → chips** | Painel âmbar de ~180px vira linha de chips clicáveis no hero | R2 do PDF ("âmbar só em chip"); **sem popover** (popover = estado novo, proibido) |
| **Fim da duplicação** | "Prioridades de hoje" (resumo) foi absorvida pelo hero; o canvas começa direto no Trabalho | §07 do PDF ("fundir Prioridades + Tarefas") — parte segura |
| **Atividades mais densa** | linhas `py-3` → `py-2` | pedido explícito: "reduza altura, mais densidade" |

Resultado: a tela passa a contar a história **Contexto (hero) → Trabalho (tarefas/leads) → Resultado (KPIs/
receita) → Pulso (atividades/agenda/notícias)** — o topo virou um resumo de comando, não "Bom dia" solto.

## ADAPTADO
- **Ritmo:** mantido o 12px entre seções + 8px rótulo→conteúdo (HALL-PREMIUM-002), em vez dos 24px do PDF —
  não adoto um loosening que não consigo validar no pixel.
- **Contexto acima das abas:** mantive o hero **acima** das abas (não abaixo, como o PDF) — evita reordenar o
  sticky das abas e é igualmente válido ("você primeiro, depois navega").

## DESCARTADO (com motivo — precisa relaxar regra ou revisão visual)
| Item do PDF | Por que não agora |
|---|---|
| **Faixa única de KPIs (Z2)** | Os KPIs vêm dinâmicos de `dashboard.kpiGroups`. Hardcodar uma faixa (Recebida/Prevista/MRR/ARR/Carteira) assumiria a estrutura e poderia **dropar/reordenar** o que é exibido = mexe no que o dado mostra. Mantidos os MetricCards (consistentes, mostram tudo). |
| **Split 8/4 (Trabalho/Pulso)** | Briga com o `lg:contents` do `CollapsibleSection` (que dissolve no desktop) e arrisca a **responsividade existente** (acordeão mobile). Precisa reescrever o CollapsibleSection com cuidado + ver no pixel. |
| **Abas sem ícone / left-align / 44px** | Ícones já somem no mobile; `flex-1` é o alvo de toque. Left-align muda o layout mobile → risco de responsividade. |
| **Redesign da Agenda (lista vertical)** | O `Calendar` é **componente compartilhado** com 4 vistas + CRUD — fora do permitido. |
| **Alerta com popover** | Popover = **estado novo** (proibido). Resolvido com chips clicáveis. |

## MELHORAR (Fase 2 — proposto, precisa do seu aval visual ou de relaxar 1 regra)
1. **Faixa de comando dos KPIs** com Receita/MRR/ARR em destaque — exige mapear a estrutura de
   `dashboard.kpiGroups` (sem alterar os dados) e ver no pixel.
2. **Split 8/4 no desktop** (Tarefas | Agenda; Atividades | rail de Receita+Notícias) — exige rework do
   `CollapsibleSection` + teste em 1280/1440/1920/iPad/mobile.
3. **Timeline de Atividades** (dot + texto + hora à direita, 36px) — refino visual.
4. **Notícias:** 15 chips → 1 dropdown + segmento Recentes/Histórico (precisa checar o componente NewsSection).

## Auto-review (US$ 399/mês)
- **Orgulho?** O topo agora **parece executivo** (resumo de comando + alertas discretos) — grande salto de
  primeira impressão. O corpo ainda é vertical (sem o split 8/4), então falta o "layout de duas colunas" para o
  nível pleno de dashboard premium — está no Fase 2.
- **Ainda parece MVP em:** KPIs como grade de cards iguais (falta a faixa/hierarquia); corpo em coluna única.

## Riscos (Fase 1)
Baixo: só reorganizei dados já existentes no hero + comprimi alertas (mesmos hrefs, sem estado novo) + `py-2`
nas atividades. Nenhuma lógica/estado/query/responsividade tocada; só tokens do DS; tsc+lint+build verdes.
Ressalva: não vejo os pixels — o hero é tipografia + resumo + chips (baixo risco de "parecer errado"); ajuste
fino fica para sua revisão.
