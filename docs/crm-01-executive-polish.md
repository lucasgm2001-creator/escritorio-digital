# CRM-01 — Executive Commercial Polish (auditoria + lapidação · Fase 1)

> Missão: transformar um CRM que já funciona bem em um que **pareça** um produto premium de US$399/mês —
> lapidar, nunca reinventar. Regra do sprint: **auditar → explicar → propor → só então implementar**, e
> implementar só o de **baixíssimo risco**. Limitação honesta: **não vejo os pixels** — implementei apenas o que é
> troca de token **invisível / ±1px / inequívoca**; tudo que é **visível** (cor, hierarquia, densidade, reorg,
> microinteração) está **PROPOSTO** para sua revisão, não aplicado.

## Método
5 auditorias em paralelo (1 por prioridade), cada uma travada ao vocabulário do **DS 2.0** (`tailwind.config.ts`):
`text-label/caption/note`, `tracking-label`, `min-h-control-sm/control/control-lg`, `rounded-btn/bento/frame`,
paleta `bento-*`/`lime`/`success`/`warning`. Cada achado foi classificado por risco: **ZERO** (troca de token,
imperceptível) · **LOW** (visível, seguro, 1 arquivo) · **STRUCTURAL** (layout/reorg/cor sensível a tema — não
fazer às cegas).

## Descoberta transversal (a causa-raiz do "dev-tell")
O **Comercial foi construído ANTES do DS 2.0 se consolidar**. O design system existe no config, mas estas telas
**não o usam**: `text-[10px]` cru em vez de `text-label`, `rounded-md`/`rounded-[10px]` em vez de `rounded-btn`,
`tracking-wide` em CAPS em vez de `tracking-label`, cores fora da paleta (`slate`/`blue`/`#hex`). Não é falta de
design — é o **design system que não alcançou estas telas**. É exatamente o detalhe que "denuncia equipe pequena".

---

## ✅ IMPLEMENTADO agora (Fase 1 — token hygiene, baixíssimo risco)
Varredura de valores mágicos → tokens exatos. **6 arquivos, ~45 trocas simétricas.** Sem mudar 1 pixel perceptível.

| Troca | Efeito visual | Risco |
|---|---|---|
| `text-[9/10px]`→`text-label`, `[11/12px]`→`text-caption`, `[13px]`→`text-note` | exato / ±1px imperceptível | ZERO |
| `tracking-[0.12em]` e `tracking-wide` (CAPS) → `tracking-label` | `[0.12em]` exato; `wide`→`label` alarga levemente as CAPS (canônico do app) | ZERO / clearly-correct |
| `min-h-[36px]`→`min-h-control-sm`, `min-h-[44px]`→`min-h-control` | exato | ZERO |
| `rounded-[8/10px]` e `rounded-md` → `rounded-btn` | ≤2px de raio; alinha aos demais controles | ZERO / clearly-correct |

**Arquivos:** `RadarTab.tsx`, `SituationDrawer.tsx`, `MetricasTab.tsx`, `DashboardExecutivo.tsx`,
`comercial/dashboard/page.tsx`, `ContatosTab.tsx`.
**Preservados de propósito:** `text-[15px]` do nome do lead no Radar (ênfase, sem token exato) e `min-h-[40px]`
dos filtros/busca de Contatos (é +4px de altura → é visível, foi para a proposta).

---

## 🔎 PROPOSTO — precisa do seu aval / revisão visual (por prioridade)

### P1 · Dashboard Comercial — narrativa (STRUCTURAL, maior impacto)
- **Problema:** muro de cards sem narrativa; responde *"quais são meus números?"* e não *"como está meu comercial?"*.
  Pior, há **duplicação**: as faixas *Receita* (6 cards) e *Comercial & carteira* (4 cards) repetem valores que já
  estão no **hero** (Recebida, MRR, Conversão, Ticket) e nos painéis de barras. O olho bate em ~10 cards iguais
  **antes** de qualquer "onde está o problema". `Insights` (a resposta literal a isso) está enterrado em 4º.
- **Proposta (só reorganizar dado existente — ZERO métrica/gráfico/query novo):** (a) mantém o hero; (b) sobe o
  painel **Insights** para logo abaixo do hero (a faixa "onde está o problema"); (c) **remove os cards duplicados**
  das faixas — mantém só o que NÃO está no hero (Semanal, Prevista, Valor Fechado, ARR, Clientes Ativos/Novos)
  numa faixa `sm`; (d) vendedor/plano → conversões → funil como cauda de detalhe.
- **Impacto:** dinheiro primeiro → problema segundo → detalhe por último. **Risco:** STRUCTURAL (reordena + remove
  blocos) — revisão no pixel obrigatória.

### P5 · Métricas — a hierarquia que você pediu (LOW/STRUCTURAL)
- **Problema:** os 6 KPIs renderizam todos em `size="lg"` no mesmo grid = muro plano; *Receita Fechada* pesa igual
  a uma contagem.
- **Proposta:** aplicar o **padrão já provado no Hall** — grupo financeiro (Receita Fechada · Ticket · Pipeline) em
  `size="md"` + indicadores (Recebidos · Fechados · Conversão) em `size="sm"`. Mesmos 6 números, mesma fonte; muda
  só **peso/tamanho**. *(Qual métrica é "financeira" vs "indicador" é decisão sua — proponho essa divisão.)*
- **Cor/legado (LOW):** temperatura *Frio* usa `slate` cru → tom `bento` (mantendo laranja/amarelo da rampa de
  calor); `text-muted-foreground`/`text-foreground` (vocabulário antigo) convivendo com `bento-*` → unificar em
  `bento` (revisão de contraste). **Risco:** LOW.

### P3 · Funil — a maior dívida de token (sub-sprint CRM-02 próprio)
- **17 achados:** radii legado em TODA a estrutura de card (`rounded-md/lg/[10px]`), px cru em toda a tipografia
  dos cards, `tracking-wide`, cores cruas (`blue` no botão *Mensagem*, `emerald/red` no toast, `green/red` nas
  pills de Ganho/Perdido). **Estrutura/ordem/DnD do Funil = intocáveis (correto e provado).**
- **Ressalvas críticas:** (a) o bloco **ACCENT** (gradiente/borda-esquerda com `#hex`) é **ajuste deliberado de
  light-mode** — não trocar às cegas; (b) `PHASE_COLOR`/`PALETTE`/`stage.cor` são **dado** (identidade da etapa),
  não estilo — não tocar.
- **Proposta:** sub-sprint **CRM-02** focado só no Funil (radii + tipografia + tracking ≈ ZERO risco; cores =
  revisão) **com você olhando light+dark**. Não entrou neste commit por ser **grande + sensível a light-mode + 6
  arquivos** — coerente com "baixíssimo risco".

### P2 · Radar — quase congelado (micro only)
- **Veredito:** uma das melhores partes; nada estrutural. Já recebeu a token hygiene (Fase 1).
- **Proposta (micro):** `rows`/`chips` sem feedback de *press* → `active:scale-[0.99]`/`scale-95` (microinteração
  premium, aditiva); badges `slate`/`zinc` (*sem atualização*/*desistiu*) fora da paleta → tom `bento` (revisão de
  contraste/estado). **Risco:** LOW.

### P4 · Contatos — agenda inteligente (LOW)
- **Densidade:** a 2ª linha do card repete **3 pills com borda** (fase + nicho + fuso) → manter só a **fase** como
  pill (tem o ponto de status = merece badge), rebaixar nicho/fuso a **texto meta** (mesma altura, muito mais
  escaneável). **Feedback:** hover só muda a borda → `+hover:bg-bento-surface` (sem mudar altura). **Cor:** `red`
  cru → `destructive` (token de perigo). **Altura:** `min-h-[40px]`→`min-h-control` (cresce 4px, alinha às linhas).
  **Risco:** LOW. *Garantia respeitada: nenhuma proposta aumenta a altura do card nem esconde informação.*

---

## 🚫 O que NÃO será alterado (garantia da missão)
SQL · Services · APIs · Queries · Hooks · Regras · Permissões · Responsividade · Tokens do DS · Fluxo operacional ·
Estrutura/ordem do Funil · Métricas/dados · Banco · Integrações. **Nesta Fase 1 também não toquei** cor, layout,
hierarquia, densidade, microinteração — nem o **componente compartilhado `MetricCard`** (ele é do **Hall
CONGELADO**; mudar seu `tracking`/tipo vazaria para o Hall). Tudo isso está na proposta, para o seu aval.

## Antes → Depois (o que muda de fato)
- **Código:** ~45 valores mágicos viram tokens do DS — as telas do Comercial passam a *falar* o design system.
- **Pixel (Fase 1):** essencialmente idêntico. As únicas diferenças perceptíveis são as CAPS levemente mais
  espaçadas (`tracking-label`) e cantos de 3 controles do Contatos 2px mais arredondados — ambas **clearly-correct**.
- **Pixel (proposta):** é onde mora o salto premium — narrativa do Dashboard, hierarquia das Métricas, densidade do
  Contatos, lapidação do Funil. Aguarda seu aval/olho.

## Riscos
**Fase 1: baixíssimo.** Só troca de token (tipo/tracking/altura/raio), simétrica (+45/−45), sem estrutura/lógica/
dado/cor/responsividade. `tsc`+`lint`+`build` verdes. **Proposta: média** — por isso está separada e não aplicada.

## Autocrítica (brutalmente honesta)
- **Ainda denuncia equipe pequena?** Depois da Fase 1, **menos** — o cluster de valor mágico sumiu nas 5 telas. Mas
  **sim, ainda**: o **Funil** continua com radii legado/cores cruas (dívida real, adiada de propósito), e o
  **Dashboard** ainda é um muro de cards com duplicação (a narrativa é proposta, não feita).
- **Ainda parece CRM interno?** Em partes. Radar e (após a Fase 1) Contatos/Métricas já respiram DS. O **Dashboard
  Comercial** é o que mais parece "tela de números internos" — é a maior alavanca de percepção premium.
- **O que impede de parecer produto de empresa bilionária?** (1) A **narrativa** do Dashboard (dinheiro→problema→
  ação); (2) a **hierarquia** das Métricas; (3) a **lapidação do Funil** (o coração do produto ainda usa tokens
  legados); (4) **cor**: 4 vocabulários de cor convivem (bento, lime, tailwind cru, #hex).
- **O que eu faria com liberdade total?** O reorg do Dashboard + a hierarquia das Métricas **hoje** (tenho o padrão
  provado do Hall), e um passe de cor unificando tudo em tokens semânticos. Não fiz porque são **visíveis** e você
  revisa no pixel — e a regra do sprint é audit-first.
- **O que deliberadamente NÃO fiz por risco?** Reorg do Dashboard (remove blocos), split de hierarquia das Métricas
  (decisão de quais KPIs dominam é sua), sweep do Funil (light-mode + 6 arquivos), qualquer troca de cor, e o
  `MetricCard` compartilhado (vaza para o Hall congelado).
- **Próxima sprint?** **CRM-02 = Dashboard Comercial** (narrativa/dedup — maior impacto) **ou** o **sweep do Funil**
  (maior dívida de token). Recomendo Dashboard primeiro: é o que mais muda a percepção "como está meu comercial?".

## Gates
`tsc` ✅ 0 · `lint` ✅ 0 · `build` ✅ 0 · varredura residual: só os 2 valores mágicos preservados de propósito.
