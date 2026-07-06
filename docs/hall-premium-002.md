# HALL-PREMIUM-002 — Refinamento visual do Hall (auditoria + o que ficou represado)

> Só apresentação. Nenhuma regra/query/service/permissão/métrica/cálculo/estado/componente-DS/comportamento/
> responsividade alterada. Regra da sprint: **não fazer nada que gere dúvida visual** — só mudanças de baixo
> risco e ganho claro. Como não vejo os pixels renderizados, implementei **apenas o que é estruturalmente certo**
> (completar um padrão que já existe na tela) e **documentei** o resto (que exige julgamento de pixel).

## Mapa da tela (Visão Geral)
Header (saudação + data) → Tabs (sticky, 5× flex-1) → Canvas (`space-y-3`): Alertas · **Prioridades** · Tarefas
de hoje · Leads aguardando · **KPIs × N** · **Receita** vendedor/plano · **Atividades** · Agenda · **Informações**.

## Achado central (Parte 4/7) — o que foi corrigido
O gap **rótulo→conteúdo era inconsistente**:
- KPIs e Receita usam `space-y-2` → rótulo **cola** no conteúdo (8px). ✅ padrão bom
- Mapa usava um hack `-mt-1` para simular os mesmos 8px → prova de que **8px é o padrão intencional**.
- Prioridades / Atividades / Informações ficavam a **12px** (soltos) → inconsistência.

**Correção (baixo risco, completa um padrão existente):** envolvi Prioridades/Atividades/Informações/Mapa num
`space-y-2`, deixando **todos os rótulos colando no conteúdo (8px)** e as seções separadas por 12px (`space-y-3`
do canvas). Resultado: ritmo "apertado dentro da seção, respiro entre seções" — o que faz a tela parecer blocos
coesos (dashboard), não uma pilha de painéis. Mapa ficou **idêntico** (removeu o hack `-mt-1`; net 8px preservado).
Também `text-[12px]` → `text-xs` (amostra de leads) — valor mágico → token, **zero mudança visual**.

## Por que cada mudança melhora a UX
- **Rótulo colado (8px):** o olho agrupa rótulo+conteúdo como uma unidade → hierarquia visual mais clara
  (Parte 1) e ritmo variável (Parte 2), sem esmagar.
- **Consistência do gap:** todas as seções passam a respirar igual → "nenhuma seção parece feita por outra
  pessoa" (Parte 7).
- **`text-xs`:** alinha ao DS 2.0 (sem valor mágico).

## Auto-review (Parte 9) — honesto
- **Convenceria a US$399/mês?** Mais perto: o ritmo ficou coeso. Mas o salto "executivo" pleno depende dos
  itens represados abaixo (que preciso ver renderizados p/ ajustar com segurança).
- **O que ainda parece interno/MVP:** (1) 5 abas no mesmo peso — Tarefas/Relatório/Agente são features grandes
  enfiadas como abas do Hall; (2) sem "herói" — a saudação e os KPIs têm peso parecido; (3) Atividades/Agenda/
  Notícias competem com o topo (deveriam ser claramente 2ª/3ª prioridade).

## Represado (exige julgamento de pixel — NÃO implementado, por causa da regra "não gere dúvida")
Ordenado por impacto premium × risco:

| # | Recomendação | Por que | Risco de fazer às cegas |
|---|---|---|---|
| 1 | **Tiers de espaçamento entre seções** (ex.: prioridade 1 mais colada; 2ª/3ª com mais respiro antes) | cria hierarquia explícita (Parte 1/2) | médio — precisa calibrar no olho |
| 2 | **Herói do topo**: saudação + KPIs num bloco visualmente dominante | "dashboard executivo" (Parte 1) | médio — mexe em tamanho/peso |
| 3 | **Reduzir altura de painéis** (Atividades/Agenda/Notícias) quando têm pouco conteúdo | densidade acima da dobra (Parte 3/5) | médio — precisa ver o conteúdo real |
| 4 | **Abas**: revisar altura/underline/ícones para leram como um só sistema | Parte 6 | baixo/médio — `py`/underline no olho |
| 5 | `tracking-wide` → `tracking-label` nos CAPS inline ("Ver mais/histórico") | consistência (Parte 7) | **visível** (0.025em→0.12em) — precisa aprovar |
| 6 | `rounded-md` do ícone de atividade → token | consistência (Parte 2) | **visível** (6px→10px) — precisa aprovar |
| 7 | Unificar `gap-2.5` (KPI) vs `gap-3` (resumo Tarefas) | alinhamento (Parte 4) | baixo — 2px, mas em outra aba |

> Recomendo aplicar 1–4 numa sessão com você olhando a tela (ajuste fino de 1 token por vez). 5–6 são trocas
> de 1 linha, mas mudam pixels visíveis — só faço com seu "ok visual".

## Riscos do que foi implementado
Muito baixo: apenas envolvi rótulos+conteúdo num `space-y-2` (completando o padrão dos KPIs/Mapa que já existe)
+ 1 troca de token de valor-zero. tsc+lint+build verdes; JSX balanceado (verificado). Reversível num commit.
