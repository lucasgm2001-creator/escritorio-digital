# CRM-02B — Contacts Premium (lista de consulta)

> Escopo: **exclusivamente** a tela Contatos (`ContatosTab.tsx`). Nada de Dashboard/Radar/Funil/Métricas. Objetivo:
> a melhor tela de **consulta** do sistema — o olho encontra automaticamente quem merece atenção, sem abrir o lead.
> Regras duras: **não** adicionar dado/campo/funcionalidade, **não** aumentar altura do card, **não** esconder
> informação, **não** virar tabela, **não** criar layout novo. Só reorganizar visualmente o que já existe.

## Problemas encontrados (auditoria)
1. **Excesso de bordas / pills competindo (dev-tell #1).** A 2ª linha do card renderizava **3 selos com borda +
   fundo** (Fase · Nicho · Fuso), cada um disputando atenção → cartão "coberto de adesivos", difícil de escanear.
   O sinal que importa (a **Fase** = estágio/prioridade) não se destacava dos metadados (nicho/fuso).
2. **Hover fraco.** A linha inteira é clicável, mas o hover só mudava a **borda** (`hover:border-lime/40`) — sem
   preenchimento. Numa lista de consulta rápida, a falta de feedback de superfície faz parecer "formulário", não app.
3. **Cor fora da paleta.** As affordances de perigo (excluir) usavam `red-*` cru (`red-400/500/600/700/800/900/200`)
   em vez do token semântico `destructive` — 4 vocabulários de cor no sistema.

## O que foi ALTERADO (implementado)
1. **Densidade / escaneabilidade — 1 âncora + metadados quietos.** A **Fase** continua sendo o **único selo**
   (pill com borda + ponto colorido de estágio = merece o badge). **Nicho** e **Fuso** perdem borda/fundo/raio e
   viram **texto meta** (`text-label text-bento-muted`; fuso em `font-tech` p/ distinguir). Nicho ganha `truncate
   max-w-[40%]` p/ nunca empurrar o telefone. Ritmo do agrupamento: `gap-1.5` → `gap-x-2 gap-y-1`.
   → **mesma altura, mesmo dado, ~60% menos borda** na linha; o estágio salta como âncora de leitura.
2. **Hover premium.** Card: `hover:border-lime/40` → **`hover:border-lime/40 hover:bg-bento-surface`** — a linha
   inteira ganha superfície ao passar o mouse (feedback claro do alvo clicável). Só estado de hover, reversível.
3. **Perigo tokenizado.** Todos os `red-*` → **`destructive`** (botão excluir da linha + ícone/callout/botão do
   diálogo de exclusão). Mesma semântica (vermelho de perigo), agora on-palette e theme-aware.

## O que NÃO foi alterado
SQL · Services · APIs · Hooks · Queries · Banco · Regras · **Lógica** (dedup lead/cliente, período, exclusão com
guarda anti-cliente, lixeira como grupo à parte) · Responsividade · DS/Tokens · **altura do card** · **nenhuma
informação escondida** · nenhum campo/dado novo. O `renderRow` mudou só em **classes de apresentação** — o markup
de dados (nome, empresa, data, fase, nicho, fuso, telefone) é idêntico.

## Antes → Depois
| | Antes | Depois |
|---|---|---|
| Linha de meta | 3 selos com borda+fundo competindo | **1 selo (Fase)** + nicho/fuso como texto quieto |
| Hover | só a borda muda | **borda + superfície** (linha inteira reage) |
| Perigo (excluir) | `red-*` cru (6 tons) | token `destructive` (on-palette) |
| Altura / dado | — | **idênticos** |

## Impacto esperado
Menos ruído de borda → o olho encontra **estágio + nome** mais rápido ao rolar centenas de leads. O hover deixa a
navegação tátil. A tela para de "denunciar" o vermelho cru do Tailwind.

## Screenshots esperados
- **Card:** nome + empresa (linha 1, com data/atalhos à direita); linha 2 com **um** pill de Fase (ponto colorido +
  rótulo) seguido de nicho/fuso **sem caixa** e telefone à direita. Ao passar o mouse, a linha inteira ganha um
  leve preenchimento.
- **Excluir:** ícone de lixeira e diálogo de confirmação em vermelho `destructive` (idêntico em tom, agora do DS).
- **Mobile:** igual (só classes; sem mudança de layout/altura).

## Riscos
**Baixo.** Presentation-only: remoção de borda/fundo de 2 selos (mesmo texto/altura), 1 classe de hover, e troca de
`red-*`→`destructive`. Sem estrutura/lógica/dado/responsividade. `tsc`+`lint`+`build` verdes. **Flag honesto:** a
troca de cor de perigo é theme-aware — vale um olhar no diálogo de exclusão em light+dark (o tom é praticamente o
mesmo). **Deixado de fora de propósito:** `min-h-[40px]` dos filtros/busca (+4px = visível; e são controles, não o
card-foco desta sprint).

## Auto review (brutalmente honesto)
- **Ainda parece software interno?** Menos — a lista ficou mais limpa e tátil. Mas o card ainda é **modesto**: sem
  hierarquia forte de prioridade além da Fase.
- **O card ainda parece um CRUD?** Bem menos "formulário" (o hover + o selo único ajudam), mas **ainda é uma linha
  de dados** — não um cartão "inteligente".
- **Encontra um lead rápido?** Sim para **nome + estágio** (agora escaneáveis). Rolar centenas ficou mais leve.
- **O que ainda impede cobrar US$399?** **O card não mostra `temperatura` nem `responsável`.** A missão pede que o
  vendedor veja "quem está **quente**" e "quem **atende**" sem abrir o lead — mas hoje esses sinais **não estão no
  card** (o `Row` não mapeia `temperature`/`assigned_name`; ambos existem no lead). Surfacá-los seria o maior salto
  de "inteligência" — porém colide com "**não colocar mais informação / não aumentar altura**". Por isso **não fiz**
  às cegas: é a decisão que depende de você (aceitar um card um pouco mais denso, ou manter enxuto).
- **O que ficou para depois?** (1) **Temperatura como âncora de prioridade** (ex.: ponto de calor à esquerda do
  nome, ou faixa de acento — sem nova linha); (2) **Responsável** (inicial/avatar compacto na linha 2 liberada);
  (3) `min-h` dos filtros. Todos pedem seu aval visual + a liberação do "mais informação".
- **Próxima sprint?** **CRM-02C = "card inteligente"** — surfacar temperatura + responsável dentro da altura atual
  (a linha 2, agora sem 2 pills, tem espaço), **se** você liberar o "1 sinal a mais". Alternativa: **CRM-02D =
  Funil** (a maior dívida de token do módulo, já mapeada na CRM-01).

## Gates
`tsc` ✅ 0 · `lint` ✅ 0 · `build` ✅ 0 · residual mágico: só `min-h-[40px]` ×2 (filtros/busca, deferido de propósito).
