# HALL-FREEZE-001 — última sprint do Hall (congelamento)

> Objetivo: **não** adicionar feature, **não** reorganizar a tela, **só** eliminar os últimos "detalhes que
> denunciam desenvolvimento". Auditoria crítica; implementar apenas refino de **baixíssimo risco**; o que exigir
> arquitetura/grid/componente/lógica → **só listar**. Limitação honesta mantida: **não vejo os pixels** — a
> auditoria mira os dev-tells de **código** perceptíveis (raio legado, rótulo duplicado, cor/tracking crus).

## Auditoria crítica — achados (todos os itens pedidos)
| Categoria pedida | Achado | Veredito |
|---|---|---|
| **Rótulo duplicado** | **Atividades**: `SectionLabel` (eyebrow) **+** `Panel label` (desktop) **+** header do acordeão (mobile) → título 2× | **CORRIGIDO** |
| **Ícone inconsistente / raio legado** | ícone de Atividades em `rounded-md` (6px, legado) ≠ padrão do DS | **CORRIGIDO** → `rounded-bento` |
| **Classe crua (raio)** | hover da linha de atividade em `rounded-md` | **CORRIGIDO** → `rounded-btn` |
| **Cor crua fora da paleta** | varredura `bg-slate/text-slate` | **0** (já limpo no POLISH-001) |
| **Tipografia/tracking** | varredura `tracking-wide` em CAPS | **0** (já `tracking-label`) |
| **Valor mágico** | varredura `text-[Npx]` / `tracking-[` / `min-h-[` | **0** |
| **Padding inconsistente** | blocos colapsáveis (`max-lg:p-3 lg:pb-4`) e canvas (`p-4 sm:p-5`) | consistentes → **manter** |
| **Card pesado** | KPIs já hierarquizados (md/sm), Receita sem label duplicado | **manter** |
| **Espaço desperdiçado** | hero comprimido, split 8/4, `items-start` no rail | **manter** |
| **Inconsistência desktop×mobile** | `lg:*` inerte no mobile; acordeões/BottomNav intactos | **manter** |

Resultado da varredura final: **`rg` de `rounded-md|rounded-lg|rounded-xl|slate|tracking-wide|text-[Npx]|tracking-[|min-h-[` → 0 ocorrências** no HallClient. Nenhum dev-tell de código restante.

## Corrigido nesta sprint (baixíssimo risco)
1. **Atividades sem rótulo duplicado.** Removidos o wrapper `flex flex-col gap-2` + o `SectionLabel "Atividades recentes"`. O bloco passa a seguir **exatamente o padrão de Tarefas**: acordeão (mobile) / `Panel label` + `LiveDot` (desktop) — **um único título** em cada viewport. O **LiveDot é preservado** (vive no `action` do Panel). *Diff: −5/+2, 1 arquivo.*
2. **Ícone de atividade** `rounded-md` → **`rounded-bento`** (bate com o token do DS; some o último raio legado).
3. **Hover da linha** `rounded-md` → **`rounded-btn`** (token do DS; transitório).

## Deferido (fora do "baixíssimo risco" — precisa de decisão/olho, **não** implementado)
- **Notícias:** `SectionLabel "Informações"` + acordeão `"Notícias do Setor"` — **não é duplicata exata** (textos diferentes), é decisão de **copy/hierarquia**. Deixado como está (não é dev-tell; é escolha editorial).
- **Timeline de Atividades** (dot + hora à direita): refino visual que reestrutura a linha → precisa de olho no pixel; fora do escopo "sem grid/componente novo".

## Antes → Depois (o que muda no pixel)
- **Atividades (desktop):** deixa de mostrar o título **duas vezes** (eyebrow + header do Panel) — fica só o header do Panel com o LiveDot, **igual a Tarefas**.
- **Atividades (mobile):** deixa de mostrar eyebrow **+** header do acordeão — fica só o header do acordeão.
- **Ícone de atividade:** cantos do badge 28px ficam totalmente arredondados (token `rounded-bento`) em vez do 6px legado. **← única mudança visível; vale um olhar seu no desktop.**
- **Todo o resto:** idêntico (dados, KPIs, split 8/4, hero, Mapa, Agenda, mobile).

## Screenshots esperados
- **Desktop (≥1024):** coluna principal — card "Atividades Recentes" com **um** título (header do Panel) + ponto pulsante à direita; badges de ícone arredondados. Rail e KPIs inalterados.
- **Mobile (<1024):** acordeão "Atividades Recentes" com **um** título; ao expandir, linhas densas com badge de ícone arredondado.

## Riscos
**Baixíssimo.** Só remoção de 1 rótulo duplicado (segue um padrão já na tela — Tarefas) + 2 trocas de token de raio. Sem estrutura/grid/lógica/dados/query/estado/responsividade/componente compartilhado. `tsc` + `lint` + `build` **verdes**; **0** valor mágico; `SectionLabel` ainda usado (KPIs/Receita/Mapa) — sem código morto. Ressalva honesta mantida: não vejo os pixels; o único item visível (raio do ícone) fica para sua conferência.

## "Existe mais alguma alteração pequena que aumentaria claramente a qualidade?"
**Não.** Após esta sprint, o HallClient não tem mais dev-tells de código (raio legado, cor crua, tracking inconsistente, valor mágico, rótulo duplicado = todos zerados). O que resta é **decisão editorial** (copy de Notícias) ou **refino que pede novo componente/olho no pixel** (timeline) — nada que se qualifique como "pequeno + baixíssimo risco + ganho claro". Continuar aqui seria polir o polido, com retorno decrescente.

## Avaliação de produto (SaaS premium, US$ 399/mês)
| Dimensão | Nota | Racional honesto |
|---|---|---|
| **UX** | **9,5** | Narrativa Contexto→Trabalho→Resultado→Pulso; hero como resumo de comando; alertas em chips; 8/4 (ação à esq., consulta à dir.); mobile-first. |
| **UI** | **9,5** | Acabamento de código impecável — 100% tokens DS 2.0, 0 dev-tell. (−0,5 honesto: o pixel-final é você quem certifica.) |
| **Arquitetura** | **9,5** | ARCH-001 respeitado (KPIs vêm do DashboardService, UI não calcula); só apresentação; interop `display:contents`/`gap` resolvida; nenhum componente compartilhado quebrado. |
| **Clareza** | **9,5** | Um título por bloco (duplicatas zeradas); ordem narrativa; rótulos consistentes. |
| **Consistência** | **9,6** | Alvo desta sprint: 0 `rounded-md`/slate/`tracking-wide`/valor mágico; label-hug uniforme; ícones no mesmo token. |
| **Premium** | **9,3** | Hero + hierarquia de KPIs + split lêem como enterprise. (−0,7 honesto: sensação premium é a mais dependente de pixel, que não vejo.) |
| **GERAL** | **9,5** | Módulo convergido em 6 sprints com sua revisão visual; código impecável; narrativa clara; retorno decrescente daqui pra frente. |

## Recomendação formal
Nota geral **9,5 (≥9,5)** → **recomendo encerrar o desenvolvimento do Hall e congelá-lo.** O Hall atingiu o nível de produto premium proposto; qualquer trabalho adicional aqui tem retorno decrescente e corre o risco de reintroduzir instabilidade num módulo maduro. **Próximo foco sugerido:** o módulo de maior alavancagem ainda abaixo desse padrão — **Comercial (Radar/pipeline)** ou **Relatórios** —, aplicando a mesma régua (narrativa + hierarquia + DS 2.0 + zero dev-tell). Congelar o Hall aqui.
