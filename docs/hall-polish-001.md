# HALL-POLISH-001 — auditoria visual + polish (arquitetura congelada)

> Só polish. Nada de arquitetura/grid/hierarquia/posição/métrica/lógica/query/comportamento/DS/responsividade/
> componente compartilhado. Limitação honesta: **não vejo os pixels** — a auditoria mira as inconsistências de
> **código** que são perceptíveis (cor crua, tracking, raio, rótulo duplicado); implementei só as de risco ~zero.

## Auditoria — todos os achados (maior → menor impacto)
1. **Rótulo duplicado no desktop (dev-tell #1).** Blocos com `SectionLabel` (fora) **+** `Panel label` (dentro,
   `headerClassName="max-lg:hidden"` → aparece no desktop) mostram o título **2×** no desktop.
   - **Receita por vendedor/plano:** duplicata EXATA no desktop.  → **CORRIGIDO** (removi o `Panel label`; fica
     só o `SectionLabel`, igual ao padrão dos grupos de KPI).
   - **Atividades:** SectionLabel + Panel label (desktop) e SectionLabel + header do acordeão (mobile). O header
     do Panel carrega o **LiveDot** → remover exige cuidado. → **DEFERIDO** (precisa preservar o LiveDot + decisão
     mobile).
2. **Cor crua fora da paleta.** Fallback do ícone de Atividades usava `bg-slate-800/60 text-slate-400` (slate do
   Tailwind). → **CORRIGIDO** → `bg-bento-panel text-bento-muted` (tokens bento).
3. **Tracking inconsistente em CAPS.** Botões "Ver mais / Ver histórico / ver todas" usavam `tracking-wide`
   (0.025em); os `SectionLabel` usam `tracking-label` (0.12em). → **CORRIGIDO** → `tracking-label` (bate com os
   labels na tela; é o token de CAPS do DS).
4. **Mistura `space-y-2` × `flex gap-2`** nos label-hugs. `space-y` não sobrevive ao `display:contents` do
   CollapsibleSection (por isso alguns já eram `flex gap-2`). → **CORRIGIDO** → uniformizei KPI + Mapa para
   `flex flex-col gap-2` (imperceptível: 8px nos dois; padrão único).
5. **Raio legado do ícone de Atividades** (`rounded-md` 6px) ≠ ícone de Leads (`rounded-bento`). → **DEFERIDO**
   (mudança de raio visível; `rounded-bento` num ícone de 28px vira quase círculo — precisa do seu olho).
6. **Notícias:** `SectionLabel "Informações"` + acordeão `"Notícias do Setor"` — textos diferentes (não é
   duplicata exata, mas há 2 níveis de título). → **DEFERIDO** (decisão de copy/hierarquia).
7. **Estados vazios** ("Nada para hoje", "Nenhuma atividade") em `py-6` — consistentes entre si. → **manter**.

## Corrigidos (todos os critérios: baixo risco, melhoria evidente, sem estrutura/lógica/comportamento/DS/resp.)
| # | O quê | Efeito |
|---|---|---|
| 2 | slate cru → tokens bento (fallback do ícone) | fora-da-paleta some (raro, mas dev-tell) |
| 3 | `tracking-wide` → `tracking-label` (3 botões CAPS) | CAPS consistente com os SectionLabel |
| 4 | `space-y-2` → `flex flex-col gap-2` (KPI + Mapa) | padrão de label-hug único (imperceptível) |
| 1 | remove `Panel label` duplicado da Receita (×2) | fim da duplicata "RECEITA…" no desktop |

## Deferidos (visíveis/estruturais — precisam do seu olho ou de decisão)
- **#1 Atividades** — remover a duplicata preservando o LiveDot (desktop) e resolver o SectionLabel×acordeão
  no mobile.
- **#5** raio do ícone de Atividades (`rounded-md` → token) — visível.
- **#6** hierarquia de título de Notícias (Informações × Notícias do Setor).

## "Ainda denuncia dev-built?"
Sim, restam: (a) a duplicata de rótulo de **Atividades** no desktop (a de Receita foi corrigida); (b) o raio
legado do ícone de Atividades. Ambas são visíveis e ficaram deferidas para não mexer às cegas — recomendo
aplicar com você olhando a tela.

## Antes → Depois (o que muda no pixel)
- **Receita (desktop):** deixa de mostrar "RECEITA POR VENDEDOR/PLANO" **duas vezes** — fica só o eyebrow, como
  nos KPIs. **Mobile: idêntico** (o header do Panel já era escondido).
- **Botões CAPS:** "Ver mais/Ver histórico" com o mesmo tracking dos rótulos de seção.
- **Ícone de atividade de tipo desconhecido:** cinza-bento em vez de cinza-slate.
- KPI/Mapa: espaçamento rótulo→conteúdo idêntico (8px), só código mais uniforme.

## Riscos
Muito baixo: só troca de token/classe (cor, tracking, spacing equivalente) + remoção de 1 rótulo duplicado
(desktop-only; mobile intacto). Sem estrutura/lógica/dados/responsividade. tsc+lint+build verdes; 0 valor mágico.
Ressalva: não vejo os pixels — os itens visíveis (raio, Atividades) ficaram deferidos de propósito.
