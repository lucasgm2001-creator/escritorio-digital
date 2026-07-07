# HALL-PREMIUM-003 (Fase 2) — corpo do Hall

> Continuação da Fase 1 (hero). Só apresentação: nada de regra/query/service/métrica/cálculo/permissão/
> server action/responsividade/DS alterado. Só tokens/componentes existentes. Limitação honesta: **não vejo os
> pixels** — implemento o que é estruturalmente certo/seguro e documento o que exige verificação visual.

## Análise inicial (Parte 1 — corpo)
- **Peso igual demais:** os 3 grupos de KPI ("Receita", "Comercial & carteira", "Operação") renderizavam
  **idênticos** (`MetricCard size="sm"`, mesmo grid) → "muro de cards". O financeiro não se destacava do
  operacional. **← prioridade máxima (Parte 2).**
- **Espaço desperdiçado no desktop:** corpo em coluna única `max-w-7xl`; conteúdo estreito (receita, notícias)
  ocupa a largura toda.
- **Grids com colunas vazias:** grupos de 4 e 3 KPIs num grid `lg:grid-cols-5` deixavam células vazias.

## Decisão / o que reorganizei (implementado)
**KPIs — hierarquia financeiro × operacional (Parte 2/3):**
- 1º grupo (**Receita** — Recebida/Prevista/Fechado/**MRR/ARR**) vira o **tier de Comando**: `size="md"`
  (fonte do valor ~33% maior, clamp até 1.5rem vs 1.125rem) numa faixa de 5 colunas → **destaca Receita/MRR/ARR**
  sem cor extra (respeita R1 "lime ≤ 5"; o destaque é tamanho, não lime).
- Grupos operacionais (**Comercial & carteira**, **Operação**): `size="sm"`, grid `sm:grid-cols-4` (mais
  compacto, sem as colunas vazias do `grid-cols-5`).
- **Como:** por **índice** (`gi === 0`), sem detectar rótulo, sem tocar `dashboard.kpiGroups`. `md` tem o mesmo
  footprint de `sm` (px-3) — só o número cresce → **zero risco de estouro/quebra**.

Resultado: o financeiro lê como a "faixa de indicadores" dominante; o operacional recua. Some a sensação de
5+4+3 cards idênticos.

## O que mantive (e por quê)
- **MetricCard** (não virou faixa custom): o card é o componente oficial; `size="md"` já entrega o destaque sem
  inventar layout que eu não consigo validar no pixel, e sem "card dentro de card".
- **Ordem do corpo** (Trabalho → Indicadores → Receita → Pulso): já reflete a narrativa; não reordenei blocos.
- **Agenda / Mapa:** intactos (Mapa já é excelente; Agenda usa o `Calendar` compartilhado).
- **Ritmo:** o 12px/8px (HALL-PREMIUM-002) segue consistente.

## O que descartei nesta rodada (com motivo — precisa da sua revisão visual)
| Item (Parte 4/7) | Por que não agora |
|---|---|
| **Split 8/4 no desktop** (Agenda \| rail Receita+Notícias) | Estruturalmente é um `lg:grid` padrão, mas envolve **reordenar blocos + grids condicionais + interop com `CollapsibleSection` (`lg:contents`)**, e — sobretudo — **proporções/alturas que só se validam no pixel**. Fazer às cegas pode deixar o corpo **pior** (células vazias, alturas descasadas), o que contraria "mais premium, não pior". Quero fazer **com você olhando**. |
| **Timeline de Atividades** (dot + hora à direita) | A Fase 1 já comprimiu (`py-2`). Ir além (reestruturar a linha) é refino que precisa de olho no pixel. |
| **Rail de Notícias/Receita** | idem split — depende do 8/4. |

## Fase 3 proposta (pareada com sua tela)
1. **Split 8/4 desktop** — `lg:grid lg:grid-cols-3`: coluna principal (Trabalho/Atividades) + rail
   (Receita/Notícias). Padrão seguro: `CollapsibleSection` → envolver o conteúdo num `lg:col-span-*` (mobile
   intacto: `lg:*` inerte, acordeão funciona). Faço em 15 min **com você conferindo as proporções**.
2. **Timeline de Atividades** (densidade final).

## Auto-review (US$ 399/mês)
- **Orgulho?** Os KPIs agora têm **hierarquia** (financeiro grande, operacional compacto) — o "muro" sumiu, e
  é o ganho de maior impacto do corpo. Somado ao hero da Fase 1, o topo + os números já parecem executivos.
- **Ainda parece MVP em:** o corpo abaixo dos KPIs segue em **coluna única** — o salto para "dashboard de duas
  colunas" (split 8/4) é o que falta, e é o que preciso fazer com sua revisão visual.

## Riscos
Muito baixo: só `size`/grid dos KPIs por índice (mesmo footprint, número maior), sem tocar dados/lógica/
responsividade; só tokens do DS; tsc+lint+build verdes. Reversível num commit.
