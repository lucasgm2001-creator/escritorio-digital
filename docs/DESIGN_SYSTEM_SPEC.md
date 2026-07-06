# DESIGN SYSTEM SPEC — "Bento Compacto" (v2.0)

> **Constituição visual do Escritório Digital.** Fonte única da linguagem visual: toda tela nova e toda
> migração devem apontar para os tokens e componentes abaixo. Nada de valor mágico.
> Referência viva renderizada: **`/design-system`** (rota interna, autenticada).
>
> **Regra de ouro:** se um valor não está aqui, ele não existe. Precisa de um novo? Adicione ao token,
> não ao `className`.

---

## 0. Princípios (DS-005 / DS-010)
1. **Invisível** — o usuário percebe a tarefa, não o componente. Sem enfeite, sem glow/animação ambiente.
2. **Um jeito só** — cada coisa tem UM tamanho, UM raio, UM rótulo. Consistência > criatividade por tela.
3. **Acento com parcimônia** — o verde-lima só aparece no dado positivo/enfático, nunca decorativo.
4. **Escala, não improviso** — espaçamento/tipografia numa escala fechada; meia-medida (2.5/3.5) é exceção justificada.
5. **Compatibilidade** — o DS cresce por adição; tokens novos nunca mudam o valor de tokens existentes.

---

## 1. Tokens de cor (theme-aware — `tailwind.config.ts` + `globals.css`)
Definidos como canais RGB em `:root` (dark) e `html.light` (claro); usados via `rgb(var(--x) / <alpha>)`.

| Papel | Token Tailwind | Uso |
|---|---|---|
| Canvas | `bg-bento-bg` | fundo da página |
| Painel | `bg-bento-panel` | superfície de card (via `.bento-fx`) |
| Overlay opaco | `bg-bento-surface` | dropdown / menu / modal / sheet |
| Borda | `border-bento-border` | todas as bordas neutras |
| Texto | `text-bento-text` | corpo (não é branco puro) |
| Texto fraco | `text-bento-dim` | secundário |
| Texto muito fraco | `text-bento-muted` | rótulos / meta |
| **Acento** | `lime` (`text-lime-fg`, `bg-lime`, `border-lime`, `lime-soft`, `lime-ink`) | positivo/ênfase/seleção |
| **Sucesso** | `success` (`#22c55e`) | estado ok / positivo binário |
| **Perigo** | `destructive` (`#ef4444`) | erro / destrutivo |
| **Atenção** | `warning` (`#f5b83d`) | alerta / âmbar |
| Marca | `brand` (`#0f2044`) | identidade DR Growth |

**⛔ Proibido:** hex cru no JSX. `#22C55E` → `success`/`lime`; qualquer cor → token. (Hoje: **20 arquivos** com hex — ver migração.)

## 2. Raio (`borderRadius`)
| Token | Valor | Uso |
|---|---|---|
| `rounded-btn` | 10px | botões, inputs, chips |
| `rounded-bento` | 14px | cards / painéis (é o raio do `.bento-fx`) |
| `rounded-frame` | 22px | superfície grande / canvas |
| `rounded-full` | ∞ | avatares, dots, pills |

**⛔ Proibido:** `rounded-xl`/`rounded-lg`/`rounded-md` no JSX (viram os tokens acima). Nota: `rounded-lg` foi sobrescrito p/ 12px e coincide com `rounded-xl` — origem da mistura.

## 3. Sombra (`boxShadow`)
`shadow-card` (repouso) · `shadow-card-hover` (hover de card interativo) · `shadow-glow`/`-sm`/`-lg` (só ênfase de acento) · `shadow-inner` (topo pegando luz). **Não** inventar `shadow-[...]` cru (hoje há 2 exceções: BottomNav, TaskModal inset).

## 4. Tipografia
**Famílias:** `font-display` (títulos/números) · `font-tech` (rótulos CAPS, mono) · `font-body` (corpo).

**Escala oficial (tokens novos v2.0 + Tailwind):**
| Token | px | Uso |
|---|---|---|
| `text-label` | 10 | rótulo CAPS (eyebrow de seção) |
| `text-caption` | 11 | legenda / meta / valores pequenos |
| `text-note` | 13 | texto pequeno de apoio |
| `text-xs` | 12 | — |
| `text-sm` | 14 | corpo padrão |
| `text-base` | 16 | corpo grande |
| `text-lg…text-4xl` | 18–36 | títulos / números (`font-display font-bold`) |

**⛔ Proibido:** `text-[9px]` (ilegível — sobe p/ `text-label`), `text-[13px]`→`text-note`, etc. Hoje: `text-[9/10/11/13px]` espalhados.

**Tracking:** `tracking-label` (0.12em) para rótulos CAPS. **⛔** `tracking-[0.14/0.15/0.22em]` (viram `tracking-label`).

**Pesos:** `font-medium` (rótulo/label forte), `font-semibold` (título de card/linha), `font-bold` (número/título). Só esses 3.

## 5. Alturas de controle (tokens novos v2.0)
| Token | px | Uso |
|---|---|---|
| `min-h-control-sm` | 36 | chip / botão compacto / ação secundária densa |
| `min-h-control` | 44 | **padrão**: input, botão, alvo de toque (a11y) |
| `min-h-control-lg` | 52 | linha de navegação, header de accordion |

**⛔ Proibido:** `min-h-[38px]` (corrigido), `[32/40/48/56px]` avulsos → um dos 3 tokens. Hoje: **8 valores** de altura.

## 6. Espaçamento & Grid
- **Escala:** múltiplos de 4 → `gap-1`(4) `gap-2`(8) `gap-3`(12) `gap-4`(16) `gap-6`(24); `space-y-*` idem. Meia-medida (`gap-2.5`/`p-3.5`) só com justificativa.
- **Padding de card:** `p-4` (padrão) / `p-5` (`Panel`/herói). **Não** `p-3.5`.
- **Container de página (canônico):** `mx-auto w-full max-w-6xl` para telas de leitura; `max-w-3xl` para formulários focados. **Aproveitar ≥1440p** com `2xl:max-w-7xl` onde a densidade justifica. Hoje: `3xl/5xl/6xl/7xl/[960px]` misturados.
- **Grid bento:** 4 colunas desktop (`Panel` `span` hero/tall/wide/1), cai p/ 1–2 no mobile.
- **Grid de KPIs:** `grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5` (padrão vigente do Financeiro/Remuneração).

## 7. Componentes oficiais (usar SEMPRE estes)

### Panel — `@/components/bento/Panel`
Card base do bento. Props: `label` (rótulo canônico), `action`, `span` (hero/tall/wide/1), `hero`, `*ClassName`. **O `label` do Panel É o rótulo de seção canônico** (`font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted`).

### MetricCard — `@/components/ui/MetricCard`
KPI. Props: `title`, `value`, `subtitle`, `icon`, `trend`, `tone` (default/positive/negative/muted/emerald/blue/lime/warning), `size` (sm/md/lg), `href`/`onClick`. Superfície `.bento-fx`; acento só no `tone`.

### EmptyState — `@/components/ui/EmptyState`
Vazio honesto. Props: `icon`, `title`, `description`. Sempre que uma lista/seção não tiver dado.

### Superfícies utilitárias (classes globais)
- `.bento-fx` — card/painel (gradação sutil + borda + inset + raio 14px). Base do Panel/MetricCard.
- `.bento-btn` — botão primário lima (`bg-lime`, `text-lime-ink`).
- `.bento-canvas` — fundo de grade de instrumento (frame 22px).

### Rótulo de seção (SectionLabel) — **padrão canônico**
`font-tech text-label uppercase tracking-label text-bento-muted`. Preferir `<Panel label="…">`; fora do Panel, usar exatamente essa combinação. Hoje reinventado inline com 4 variações — **maior fonte de inconsistência**.

### Botões
| Variante | Classe base | Altura |
|---|---|---|
| Primário | `.bento-btn rounded-btn px-4 font-semibold` | `min-h-control` |
| Secundário | `border border-bento-border text-bento-text hover:border-lime hover:text-lime-fg rounded-btn px-4` | `min-h-control` |
| Ghost | `text-bento-muted hover:text-bento-text rounded-btn px-3` | `min-h-control-sm` |
| Destrutivo | `bg-red-500/90 hover:bg-red-500 text-white rounded-btn` | `min-h-control` |

### Inputs
`w-full bg-bento-bg border border-bento-border rounded-btn px-3 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime min-h-control`.

### Badges / Chips
- Neutro: `border border-bento-border text-bento-muted rounded-full text-caption px-2 py-0.5`.
- Sucesso: `border-lime/30 text-lime-fg bg-lime/10`. Atenção: `border-amber-500/40 text-amber-400 bg-amber-900/30`. Perigo: `border-red-400/40 text-red-400 bg-red-400/10`.

### Accordion
Header `min-h-control-lg` clicável (`ChevronDown` rotaciona 180°); corpo `border-t border-bento-border`. Padrão em MinhaRemuneração/CommissionSection.

### Modal / Sheet
Overlay `fixed inset-0 bg-black/50`; painel `bg-bento-surface border border-bento-border rounded-bento shadow-card-hover`; mobile full-screen, `sm:` centralizado. Usar `Portal` + `useDialog` (foco/esc).

### Tabelas / Listas
Linha: `flex items-center justify-between gap-3 px-3.5 py-2.5` com `divide-y divide-bento-border/60`. Números `tabular-nums`.

### Charts
Barras via `div` com `bg-lime rounded-full` + trilho `bg-bento-panel`. Sem lib pesada. Rótulos `text-label`.

### Sidebar / Navbar / Header / Footer
Sidebar: `DomainNav`/`Sidebar` (linha `min-h-control-lg`). Header de página: `h1 font-display text-2xl font-bold` + subtítulo `text-sm text-bento-muted`. Footer de nota: `text-caption text-bento-dim`.

### Loading / Skeleton
Fallback discreto: `py-16 text-center text-sm text-bento-muted "Carregando…"` (DS-005). Skeleton: `animate-pulse bg-bento-panel rounded-bento`.

## 8. Estados
| Estado | Padrão |
|---|---|
| Hover (card) | `hover:border-lime/40` (borda), sem scale |
| Hover (botão 2º) | `hover:border-lime hover:text-lime-fg` |
| Focus | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40` |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed` |
| Active/pressed | acento `-dim` (verde fechado) |
| Selecionado | `bg-lime/15 text-lime-fg` (nav/aba ativa) |

## 9. Feedback semântico
Sucesso `text-lime-fg`/`success` · Atenção `text-amber-400`/`warning` · Perigo `text-red-400`/`destructive` · Info `text-blue-400`. **Cor = significado** (nunca decorativa).

## 10. Animações (`tailwind.config`)
`animate-fade-in` (0.2s) · `slide-up`/`slide-down` · `count-up` (número entra) · `live` (LiveDot) · `spin`. Duração ≤ 0.25s. **⛔** animação ambiente/decorativa (DS-005).

## 11. Responsividade
Breakpoints: mobile < `sm`(640) · iPad `md`(768)/`lg`(1024) · MacBook Air `xl`(1280) · 1440p/ultrawide `2xl`(1536). Variante `coarse:` para toque (iPad) sem inchar desktop. Toda tela deve ter alvo ≥ `min-h-control` no toque e não estourar horizontalmente (usar `min-w-0`/`truncate`).

---

_v2.0 — DESIGN-SYSTEM-2.0. Tokens `text-label/caption/note`, `tracking-label`, `min-h-control*` adicionados
(aditivos). Migração das telas: ver plano no relatório da sprint (nenhuma tela migrada nesta fase)._
