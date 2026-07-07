# HALL-PREMIUM-004 (Fase 3) — split desktop 8/4

> Só apresentação: nenhum dado/regra/query/service/métrica/permissão/estado/API/responsividade-mobile/DS
> alterado. Só tokens/componentes existentes. Formato pareado: implemento → você revisa proporções na tela.

## Descoberta técnica (importante)
O `CollapsibleSection` é `lg:contents` no desktop (o wrapper "some" e os filhos sobem para o pai). E
**`display: contents` ignora `margin`** — logo **`space-y-*` NÃO espaça** os painéis que vêm de um
CollapsibleSection no desktop (a margem cai no elemento sem caixa). Efeito colateral: os label-hugs de
Atividades/Informações (HALL-PREMIUM-002, feitos com `space-y-2`) estavam **sem efeito no desktop** — label
grudado no painel. **`gap` (flex/grid) sobrevive** ao `display:contents` (espaça os filhos dissolvidos como
itens do flex). Por isso troquei os containers para `flex flex-col gap-*`.

## O que mudou
1. **Container da Visão Geral** `space-y-3` → `flex flex-col gap-3` — corrige o espaçamento no desktop entre
   painéis de CollapsibleSection (que antes se tocavam) e habilita o split.
2. **Label-hug de Atividades/Informações** `space-y-2` → `flex flex-col gap-2` — agora funciona no desktop.
3. **SPLIT 8/4 no desktop** (`lg:grid lg:grid-cols-12 lg:gap-4 lg:items-start`):
   - **Coluna principal (8/12)** — pulso/trabalho: **Atividades + Agenda**.
   - **Rail lateral (4/12)** — consulta/apoio: **Receita por vendedor/plano + Notícias**.
   - Receita empilha no rail estreito (`lg:grid-cols-1`).
   - `items-start` → o rail fica na altura natural (sem "rail gigante vazio").
4. Blocos **acima do split** (full-width, em ordem): Tarefas de hoje, Leads aguardando, KPIs.

## Por que essa composição
- **Ação à esquerda, consulta à direita** (padrão de dashboard): Atividades (o que aconteceu) e Agenda
  (que precisa de largura) na coluna larga; Receita e Notícias (referência compacta) no rail.
- **KPIs full-width acima** (não dentro de uma coluna): são a "faixa de comando" — merecem a largura toda.
- **Mobile intacto:** `lg:*` inerte abaixo de 1024 → tudo empilha com `gap-3` (12px, igual ao de antes);
  acordeões/agenda/notícias funcionam; BottomNav/safe-area não tocados.

## O que ficou igual
Dados, cálculos, KPIs (hierarquia da Fase 2), hero (Fase 1), Mapa, comportamento dos colapsáveis, mobile.

## O que descartei / deixei para depois
- **Timeline de Atividades** (dot + hora à direita): a Fase 1 já comprimiu (`py-2`); ir além é refino que
  precisa de olho no pixel. Documentado.

## Antes → Depois
| | Antes | Depois |
|---|---|---|
| Desktop | coluna única (tudo full-width) | **8/4**: principal (Atividades+Agenda) \| rail (Receita+Notícias) |
| Gaps desktop | painéis de CollapsibleSection **se tocavam** (bug do `space-y`+`contents`) | 12/16px consistentes (via `gap`) |
| Label-hug (Atividades/Notícias) | sem efeito no desktop | 8px correto |
| Mobile | ordem A | ~igual (topo idêntico; Receita desce 2 posições no fim) |

## Screenshots esperados
- **Desktop (≥1024):** abaixo dos KPIs, **duas colunas** — larga à esquerda (Atividades em cima, Agenda
  embaixo), rail estreito à direita (Receita por vendedor/plano empilhadas, Notícias abaixo). Rail na altura
  natural (não estica até o fim da coluna principal).
- **Mobile/tablet (<1024):** empilha tudo, acordeões e agenda funcionando; a única diferença é Receita aparecer
  mais abaixo (depois de Agenda) em vez de logo após os KPIs.

## Riscos
- **Estrutural: baixo** — tsc/lint/build verdes; blocos corretamente aninhados (verificado); mobile inerte
  (lg:*), acordeões intactos; só tokens do DS; 0 valor mágico; dados/lógica intocados.
- **Estético (proporções): sua revisão** — o 8/4, o gap-4 entre colunas e a altura do rail são o que você
  ajusta na tela. Ajustes triviais: `col-span-8/4` → `9/3` ou `7/5`; `gap-4` → `gap-6`; trocar bloco de coluna.
- **Ressalva honesta:** não vejo os pixels; garanti a ESTRUTURA (colunas certas, mobile intacto). As proporções
  ficam para o seu olho — como combinado.

## Ajustes rápidos que você pode pedir
- Rail mais largo/estreito → mudo `lg:col-span-8`/`4` (ex.: `7`/`5` ou `9`/`3`).
- Trocar bloco de lado → movo Agenda p/ rail ou Receita p/ principal.
- Mais/menos respiro entre colunas → `lg:gap-4` → `lg:gap-6`/`lg:gap-3`.
- Receita voltar para cima no mobile → reordeno.
