# Inventário oficial de UI — Escritório Digital v2

> **Fonte de verdade dos componentes do produto.** Toda tela futura usa componentes oficiais (import de
> `@/components/ui`), nunca JSX repetido. Complementa a fundação em [09-design-system.md](09-design-system.md)
> (categorias, tokens bento, DS-005 "componentes invisíveis").
>
> **Manutenção:** sempre que um componente oficial nascer, atualizar este inventário (status + localização).
> **Regra de criação (DS-007 · REGRA 2):** antes de criar cada componente — levantar onde será usado,
> comparar as props atuais e propor uma API que cubra ≥90% dos casos, para a migração exigir o mínimo de
> alterações por tela. **Preferir evoluir o existente a criar novo.**

**Status:** `Oficial` (pronto em `ui/`, uso liberado) · `Existente` (existe, a promover/formalizar) ·
`Legado` (aposentar, não usar em tela nova) · `Em construção` (na fila; ainda não criar tela em cima).

**Sequência de construção da fundação (DS-007 · REGRA 1):**
MetricCard ✅ → Button → IconButton → CloseButton → StatusBadge → TrendBadge → Spinner → LoadingState →
EmptyState → ErrorState → DrawerHeader → SectionHeader → SegmentedTabs → SearchBar → FilterChip.
**Só depois** disso migrar telas (Hall, Comercial, Clientes, Financeiro, Equipe, Studio, Agenda, Tráfego).

---

## Actions
| Nome | Status | Localização | Usado hoje | Reuso futuro | Responsabilidade | Obs |
|---|---|---|---|---|---|---|
| **Button** | **Oficial** | `components/ui/Button.tsx` | ainda nenhum (novo); alvo: ~59× `.bento-btn` (~36 primary, ~23 secondary) | todos os modais/forms/ações | ação primária/secundária/destrutiva | DS-011; API: `variant(primary\|secondary\|destructive\|ghost) size(md 44px\|sm) loading leftIcon rightIcon fullWidth asChild`; primary reusa `.bento-btn` |
| **IconButton** | **Oficial** | `components/ui/IconButton.tsx` | ainda nenhum (novo); alvo: `p-1`/`p-1.5` (~23×, todos <44px) | editar/excluir/reordenar/limpar | botão só-ícone | DS-012; 44px padrão; `variant(ghost\|outline\|solid\|destructive) size(md\|sm) loading`; `aria-label` obrigatório; compatível com Button |
| **CloseButton** | Em construção | `ui/actions/CloseButton.tsx` | X reimplementado (SVG cru vs `<X>`, 1 sem aria) | todo modal/drawer | fechar overlay | especialização de IconButton |
| Fab | Em construção (fase 4) | — | não existe | ação flutuante | FAB | fora da fila DS-007 |

## Feedback
| Nome | Status | Localização | Usado hoje | Reuso futuro | Responsabilidade | Obs |
|---|---|---|---|---|---|---|
| **Spinner** | Em construção | `ui/feedback/Spinner.tsx` | `border-2 animate-spin` (8+×) | botões/loaders | indicador de carga | size/tone |
| **LoadingState** | Em construção | `ui/feedback/LoadingState.tsx` | "Carregando…" (7×) | listas/painéis | estado de carga | usa Spinner |
| **EmptyState** | Em construção | `ui/feedback/EmptyState.tsx` | "Nenhum…/Nada…" (~16×) | toda lista vazia | estado vazio | variante inline/rica |
| **ErrorState** | Em construção | `ui/feedback/ErrorState.tsx` | — (só `ErrorBoundary` existe) | telas com falha | UI de erro + retry | par de `system/ErrorBoundary` |

## Layout
| Nome | Status | Localização | Usado hoje | Reuso futuro | Responsabilidade | Obs |
|---|---|---|---|---|---|---|
| **Panel** | Existente→Oficial | `components/bento/Panel.tsx` | Hall e tabs | cards de conteúdo | superfície c/ label+action | adotar no lugar de `bento-fx` cru (12 arqs); evoluir `padding?` |
| **BentoCard** | Em construção | `ui/layout/BentoCard.tsx` | classe `.bento-fx` | superfícies | card base | reconciliar com Card legado |
| **Card** | **Legado** | `components/ui/card.tsx` | pouco/nenhum no módulo | — | card shadcn | tokens `border/card` divergentes do bento → aposentar |
| **SectionHeader** | Existente→Oficial | (de `SectionLabel`, `hall/HallClient.tsx`) | Hall (DASH-005) | topo de seção | rótulo + fio | promover p/ ui |
| Section / Divider | Em construção (fase 3) | — | inline | agrupar/separar | — | — |

## Navigation
| Nome | Status | Localização | Usado hoje | Reuso futuro | Responsabilidade | Obs |
|---|---|---|---|---|---|---|
| **SegmentedTabs** | Em construção | `ui/navigation/SegmentedTabs.tsx` | visual em `DraggableTabs.tsx` + VendedoresTab:324 + ApresentacaoTab:466 | sub-abas de painel/modal | abas horizontais c/ sublinhado | base estática; DraggableTabs a estende |
| **DrawerHeader** | Em construção | `ui/navigation/DrawerHeader.tsx` | SellerProfile:271 + LeadDiary:498 | painéis laterais | header do drawer | `pt` safe-area embutido (resolve COM-001) |
| **Portal** + **useDialog** | Oficial (existente) | `components/ui/` | modais/drawers | todo overlay | Portal + ESC/focus-trap/scroll-lock | base de SheetModal/DrawerHeader |
| **CollapsibleSection** | Oficial (existente) | `components/mobile/` | Hall | seções colapsáveis | disclosure mobile | — |
| BottomSheetHeader / SheetModal | Em construção (fase 3) | — | header/modal repetido | overlays | — | — |

## Metrics
| Nome | Status | Localização | Usado hoje | Reuso futuro | Responsabilidade | Obs |
|---|---|---|---|---|---|---|
| **MetricCard** | **Oficial** | `components/ui/MetricCard.tsx` | Hall (KPIs da Visão Geral, DS-013) | Comercial/Financeiro/Clientes/Vendedores | KPI label+valor | DS-006 + DS-015: `size(sm\|md\|lg)`, `tone(default\|positive\|negative\|muted\|emerald\|blue\|lime)`, subtitle/icon/trend/href/onClick (md+default = uso do Hall, inalterado) |
| **StatusBadge** | Em construção | `ui/metrics/StatusBadge.tsx` | "StatusPill" 5× (VendedoresTab:610, CommissionSection:146/940/1028, FasesTab:464) | status vendedor/venda/fase | badge de status | tons lime/slate/amber/red |
| **TrendBadge** | Em construção | `ui/metrics/TrendBadge.tsx` | delta "+X%" `text-[9px]` (VendedoresTab:300) | KPIs c/ variação | variação c/ cor por sinal | usado por MetricCard.trend |

## Forms
| Nome | Status | Localização | Usado hoje | Reuso futuro | Responsabilidade | Obs |
|---|---|---|---|---|---|---|
| **Input** | Existente→Oficial | (de `bentoInput`, `hall/calendarShared.ts`) | EventModal + forms | todos os campos | campo de texto | promover string→componente; `min-h-44` |
| **Select** | Em construção | `ui/forms/Select.tsx` | `bentoInput` em `<select>` + selects crus | seleções | seleção | `min-h-44` |
| **SearchBar** | Em construção | `ui/forms/SearchBar.tsx` | HubTab + buscas ad-hoc | buscas | busca c/ limpar | — |
| **FilterChip** | Existente→Oficial | (de `PeriodChips`, `comercial/PeriodChips.tsx`) | Funil, Contatos, NewsSection | filtros/segmentos | chip de filtro | generalizar options; grupo "SegmentedPills" |

## Lists
| Nome | Status | Localização | Usado hoje | Reuso futuro | Responsabilidade | Obs |
|---|---|---|---|---|---|---|
| ListItem | Em construção (fase 4) | — | linhas `divide-y` | listas | linha genérica | — |
| ActivityItem | Em construção (fase 4) | — | Hall feed + HistoryModal | atividade | item de atividade | — |
| TimelineItem | Em construção (fase 4) | — | LeadDiary timeline | timeline | item de linha do tempo | — |

## Utilitários oficiais existentes (não-visuais de conteúdo)
`toast` (`ui/toast.tsx`), `TimeAgo` (`system/TimeAgo.tsx`), `LiveDot` (`bento/LiveDot.tsx`), `Markdown`
(`ui/Markdown.tsx`), `ErrorBoundary` (`system/ErrorBoundary.tsx`) — **Oficiais/Existentes**, reusar como estão.
`Avatar` (local em `VendedoresTab.tsx:78`) — **Existente**, promover p/ `ui/` (2 reimplementações inline no mesmo arquivo).
