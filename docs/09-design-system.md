# Design System — Escritório Digital v2

> **Fundação da biblioteca oficial de componentes de UI.** Toda tela futura deve ser construída com
> componentes oficiais, **não** com JSX repetido. Esta etapa (DS-003) apenas **organiza a fundação**:
> inventário do que já existe, o que evoluir e o que criar, com API proposta por componente e ordem
> de construção. **Nenhum componente é implementado aqui** — cada um vira um commit pequeno depois.

## Princípios (inegociáveis)

1. **Verificar antes de criar.** Sempre checar se já existe equivalente; se existir, **adotar**.
2. **Evoluir > criar.** Se uma pequena prop resolve, evoluir o componente existente em vez de criar outro.
3. **Responsabilidade única + API simples.** Cada componente faz uma coisa; poucas props, nomes óbvios.
4. **Mobile-first.** Alvo de toque ≥44px por padrão; nada `< text-xs` em informação; safe-area quando fixo.
5. **Aparência consistente = tokens `bento`.** Usar `bento-fx / bento-btn / bento-border / lime / rounded-btn|bento|frame` e as safe-area helpers. **Não** construir sobre os tokens shadcn de `ui/card.tsx` (legado).
6. **Só UI.** DS não toca regra de negócio, banco, integrações, cálculo, Services ou Repositories.

## Casa oficial e estrutura

Home das primitivas: **`src/components/ui/`** (já contém `Portal`, `useDialog`, `toast`, `Markdown`).
Estrutura proposta (flat + barrel), migrando o que hoje está espalhado/local:

```txt
src/components/ui/
  actions/    Button, IconButton, CloseButton, Fab
  feedback/   Spinner, LoadingState, EmptyState, ErrorState
  layout/     Panel(→bento), Section, SectionHeader, Divider, BentoCard
  navigation/ Tabs, SegmentedTabs, BottomSheetHeader, DrawerHeader
  metrics/    MetricCard, StatusBadge, TrendBadge
  forms/      Input, Select, SearchBar, FilterChip
  lists/      ListItem, TimelineItem, ActivityItem
  index.ts    barrel — imports oficiais vêm daqui
```
Regra de import: `import { Button, EmptyState } from '@/components/ui'`. Nada de reimplementar em telas.

**Legado a reconciliar:** `src/components/ui/card.tsx` (tokens `border/card/muted-foreground`) é paralelo ao bento e pouco usado — aposentar/absorver em `BentoCard`. `Avatar` (local em `VendedoresTab.tsx:78`), `PeriodChips` (`comercial/PeriodChips.tsx`), `SectionLabel` (`hall/HallClient.tsx`) e `bentoInput` (`hall/calendarShared.ts`) devem ser **promovidos** para `ui/`.

---

## Inventário por categoria (status / onde hoje / responsabilidade / API / mobile / reuso)

Status: **EXISTE** (adotar) · **EVOLUIR** (existe algo a generalizar/promover) · **CRIAR** (novo).

### • Actions
| Componente | Status | Onde hoje | Responsabilidade | API proposta | Mobile |
|---|---|---|---|---|---|
| **Button** | CRIAR | classe `.bento-btn` + JSX repetido (~59×: primary ~36, secondary ~23) | ação primária/secundária/destrutiva | `variant('primary'\|'secondary'\|'destructive'\|'ghost') size('md'\|'sm') loading? leftIcon? fullWidth? disabled?` | `min-h-44` (md); `sm`=36 só quando denso |
| **IconButton** | CRIAR | `p-1`/`p-1.5` (~23×, todos <44px) | botão só-ícone | `aria-label(obrig.) icon variant('ghost'\|'solid'\|'outline') size('md'44\|'sm')` | hit-area 44px por padrão |
| **CloseButton** | EVOLUIR | X reimplementado (SVG cru vs `<X>`, 1 sem `aria-label`) | fechar modal/drawer | `onClose className?` (= IconButton especializado, `aria-label="Fechar"`) | 44px; nunca sob o notch |
| **Fab** (FloatingActionButton) | CRIAR | não existe | ação primária flutuante | `icon aria-label onClick` | fixo bottom-right acima da BottomNav + `env(safe-area-inset-bottom)` |

### • Feedback
| Componente | Status | Onde hoje | Responsabilidade | API | Mobile |
|---|---|---|---|---|---|
| **Spinner** | CRIAR | `border-2 … animate-spin` (8+×) | indicador de carregamento | `size('sm'\|'md'\|'lg') tone?` | — |
| **LoadingState** | CRIAR | "Carregando…" (7×) | estado de carga centrado | `label? showSpinner?` | usa Spinner |
| **EmptyState** | CRIAR | "Nenhum…/Nada…" (~16×) | estado vazio | `message icon? hint? action?` (variante inline/rica) | padding uniforme |
| **ErrorState** | CRIAR | `ErrorBoundary` (existe, captura) mas sem UI de erro | UI de erro + retry | `message onRetry?` | par com `ErrorBoundary` existente |

### • Layout
| Componente | Status | Onde hoje | Responsabilidade | API | Mobile |
|---|---|---|---|---|---|
| **Panel** | EXISTE | `bento/Panel.tsx` | card de conteúdo c/ label+action | evoluir: `padding?('4'\|'5')` (call-sites usam p-4) | adotar no lugar de `bento-fx` cru (12 arquivos) |
| **BentoCard** | EVOLUIR | classe `.bento-fx` + `ui/card.tsx` (legado) | superfície base | `as? className` sobre tokens bento | reconciliar/aposentar card.tsx |
| **Section** | CRIAR | agrupamento inline | agrupar blocos c/ espaçamento | `children spacing?` | — |
| **SectionHeader** | EVOLUIR | `SectionLabel` (local em HallClient, DASH-005) | rótulo de seção + fio | promover p/ ui: `title action? divider?` | discreto |
| **Divider** | CRIAR | `h-px bg-bento-border` inline | separador | `label? orientation?` | — |

### • Navigation
| Componente | Status | Onde hoje | Responsabilidade | API | Mobile |
|---|---|---|---|---|---|
| **SegmentedTabs** | EVOLUIR | visual em `DraggableTabs.tsx` + VendedoresTab:324 + ApresentacaoTab:466 | abas horizontais c/ sublinhado | `tabs[{key,label,icon?,count?}] active onChange` (base estática; DraggableTabs a estende) | overflow-x rolável, alvo 44px |
| **Tabs** | CRIAR | — | abas genéricas (painel) | `items active onChange` | usa SegmentedTabs |
| **BottomSheetHeader** | CRIAR | header de modal repetido (6×) | título+X do bottom-sheet | `title subtitle? onClose action?` | par com um futuro SheetModal |
| **DrawerHeader** | CRIAR | SellerProfile:271 + LeadDiary:498 | header do painel lateral | `title onClose left?` — **`pt` safe-area embutido** | resolve o bug do COM-001 de forma central |

### • Metrics
| Componente | Status | Onde hoje | Responsabilidade | API | Mobile |
|---|---|---|---|---|---|
| **MetricCard** | CRIAR | KPI reimpl. 4× (MetricasTab:149/245, KanbanBoard:66, VendedoresTab:296) | KPI label+valor | `label value sub? accent? size?` | escala tipográfica única; valor ≥ legível |
| **StatusBadge** | CRIAR | "StatusPill" 5× (VendedoresTab:610, CommissionSection:146/940/1028, FasesTab:464) | badge de status | `tone('lime'\|'slate'\|'amber'\|'red') label size?` | ≥text-[11px] |
| **TrendBadge** | CRIAR | delta "+X% vs mês" em `text-[9px]` (VendedoresTab:300) | variação c/ cor por sinal | `value(number) suffix?` | ≥text-[11px] |

### • Forms
| Componente | Status | Onde hoje | Responsabilidade | API | Mobile |
|---|---|---|---|---|---|
| **Input** | EVOLUIR | `bentoInput` (string em calendarShared) | campo de texto | promover p/ componente: `label? error? ...inputProps` | `min-h-44` |
| **Select** | CRIAR | `bentoInput` em `<select>` + selects crus | seleção | `options label? ...` | `min-h-44` |
| **SearchBar** | CRIAR | HubTab + buscas ad-hoc | busca c/ limpar | `value onChange placeholder onClear?` | `min-h-44` |
| **FilterChip** | EVOLUIR | `PeriodChips` (existe) + chips em NewsSection | chip de filtro/segmento | `active label onClick` (+ grupo "SegmentedPills" generalizando PeriodChips) | rolável, alvo confortável |

### • Lists
| Componente | Status | Onde hoje | Responsabilidade | API | Mobile |
|---|---|---|---|---|---|
| **ListItem** | CRIAR | linhas `divide-y` repetidas | linha de lista genérica | `leading? title subtitle? trailing? onClick?` | linha inteira tocável ≥44px |
| **ActivityItem** | EVOLUIR | HallClient (feed) + HistoryModal | item de atividade (ícone+desc+tempo) | `icon tone title meta onClick?` | — |
| **TimelineItem** | CRIAR | timeline/interações do LeadDiary | item de linha do tempo | `time title? body?` | — |

---

## Ordem de construção (alinhada ao UX-002: maior valor visual / menor risco)

1. **Fase 1 — Actions + Feedback** (risco baixo, alcance máximo): `Button`, `IconButton`, `CloseButton`, `Spinner`, `LoadingState`, `EmptyState`. → resolve os alvos <44px, o X que sobrepõe, e empty/loading em todo o app.
2. **Fase 2 — Metrics + Forms base**: `MetricCard`, `StatusBadge`, `TrendBadge`, `Input`, `Select`, `SearchBar`, `FilterChip`. → resolve a legibilidade de dinheiro e padroniza campos.
3. **Fase 3 — Navigation + Layout**: `SegmentedTabs`, `Tabs`, `BottomSheetHeader`, `DrawerHeader`, `Panel`(evoluir)/`BentoCard`, `Section`, `SectionHeader`, `Divider`. → overlays c/ safe-area e abas 44px.
4. **Fase 4 — Lists + reconciliações**: `ListItem`, `ActivityItem`, `TimelineItem`, `Fab`, `ErrorState`; aposentar `card.tsx`; promover `Avatar`/`PeriodChips`/`SectionLabel`/`bentoInput` para `ui/`.

**Cada componente = 1 commit pequeno:** criar em `ui/` (+ barrel) → migrar call-sites incrementalmente → `tsc`+`lint`. Sem "big bang", sem tocar lógica.

## Governança

- **Imports oficiais:** telas importam de `@/components/ui`; JSX repetido de botão/card/badge/empty deixa de ser aceito em review.
- **Tokens bento** são a fonte da verdade visual; novas telas não usam os tokens de `card.tsx`.
- **Verificar-antes-de-criar** e **evoluir-antes-de-criar** valem para toda nova necessidade de UI.
- Escopo permanente: DS fortalece **só a camada de UI** — nunca regra de negócio, banco, integrações, cálculo, Services ou Repositories.
