# Proposta — Radar Comercial (Situação do Lead)

**ID:** RADAR-COMERCIAL-001
**Status:** PROPOSTA — **nada aplicado.** Aguarda autorização para a migration.
**Princípios:** ARCH-001, TEAM-001, reaproveitar `leads`/`lead_interactions`/`tasks`/`activities`/Event Bus —
sem tabela nova de timeline, sem escrita client-direct, estados honestos.

---

## 1. Auditoria — o que já existe (Part 5)

| Conceito (Part 1) | Campo/entidade existente | Veredito |
|---|---|---|
| Data da próxima ação | ✅ `leads.next_contact` (date) | **Reusar** — não criar coluna |
| Última interação / histórico | ✅ `lead_interactions` (lead_id, type, note, created_by, created_at, team_id) | **Reusar** p/ histórico (Part 7) — não duplicar timeline |
| Temperatura (aproximada) | 🟡 `leads.score` (int) | Derivável, mas o usuário quer escolher explícito → campo próprio |
| Estado do acompanhamento | 🟡 derivável de `next_contact`/`last_contact_at`/`status` | Melhor um campo explícito p/ "Desistiu/Aguardando" |
| Responsável | ✅ `leads.assigned_to`/`assigned_name` | Reusar |
| Empresa/Status | ✅ `leads.company`/`status` | Reusar |
| **Situação atual** (texto curto editável) | ❌ **não existe** | **Precisa de campo** |
| Última ação / Próxima ação (enums) | ❌ | **Precisam de campo** |

Conclusão: dá pra derivar bastante, mas **"situação atual" + os enums de última/próxima ação + temperatura +
estado** não têm onde morar. Migration **simples e aditiva** em `leads` (sem tabela nova; histórico usa
`lead_interactions`).

---

## 2. Migration proposta (aditiva em `leads`)

```sql
-- PROPOSTA (não aplicado)
alter table public.leads
  add column if not exists current_situation    text,          -- resumo curto editável ("Disse que vai falar com o sócio")
  add column if not exists last_action          text,          -- enum app: mensagem_enviada|ligacao_feita|proposta_enviada|reuniao_marcada|sem_resposta|pediu_retorno|aguardando_decisao|desistiu
  add column if not exists next_action          text,          -- enum app: nenhuma|ligar|mensagem|cobrar_retorno|enviar_proposta|marcar_reuniao|aguardar
  add column if not exists temperature          text,          -- frio|morno|quente|muito_quente
  add column if not exists followup_state       text,          -- precisa_agir|aguardando|agendado|sem_atualizacao|desistiu|fechado|perdido
  add column if not exists situation_updated_at timestamptz;   -- quando a situação foi atualizada (p/ "sem atualização há X dias")
create index if not exists idx_leads_followup on public.leads(team_id, followup_state);
create index if not exists idx_leads_next_action_at on public.leads(team_id, next_contact);
```

- **`next_action_at` REUSA `leads.next_contact`** — não crio coluna nova.
- Enums validados **na aplicação** (não CHECK rígido no banco, p/ evoluir sem migration).
- **RLS**: as novas colunas herdam as policies team-scoped já existentes de `leads` — nada novo.
- **Impacto**: 100% aditivo/retrocompatível; nenhuma linha invalidada; nenhum delete; nada financeiro.

---

## 3. Como fica (com a migration)

- **Situação atual** = `current_situation` (editável, honesto: "Sem situação registrada" quando null — Part 6).
- **Última/Próxima ação** = enums + `next_contact` (quando).
- **Temperatura/Estado** = campos explícitos (frio→muito quente; precisa_agir→perdido).
- **Histórico** (Part 7) = cada atualização grava um `lead_interaction` (type `situacao`) — reusa a timeline, sem duplicar.
- **Fluxo ao concluir tarefa** (Parts 2/3/11) = drawer compacto com 5 perguntas → grava situação + interação + cria próxima tarefa (se houver próxima ação) → atualiza `next_contact`.
- **Radar** (Part 4) = aba no Comercial, tabela/cards modernos + filtros (Precisa agir hoje / Aguardando / Sem atualização / Quentes / Todos).
- **Event Bus** (Part 8): `lead.situation.updated` / `lead.next_action.created` / `lead.followup.scheduled` / `lead.response.recorded` — adicionar ao catálogo (contratos) e publicar best-effort.
- **Hall** (Part 9): "Leads que exigem atenção" (próxima ação hoje / aguardando há X dias / quente sem próxima ação) — preparado.

---

## 4. Alternativa SEM migration (derivada) — se preferir começar já

Dá pra entregar HOJE um Radar **derivado** dos campos existentes (sem editar "situação atual"):
- Próxima ação (data) = `next_contact`; Última ação = último `lead_interaction`; Temperatura = faixa de `score`;
  Estado = derivado (`next_contact`<=hoje→precisa agir; sem next+contato recente→aguardando; `status` fechado/perdido…).
- "Situação atual" mostraria **"Sem situação registrada"** (honesto) até a migration.

Isso vira útil na hora; a migration depois habilita o texto editável + os enums explícitos + o fluxo completo.

---

## 5. Decisão pendente (para você)

- [ ] Aplicar a migration da seção 2 e construir o **Radar completo** (editável)?
- [ ] Ou começar pelo **Radar derivado** (seção 4, sem migration) e aplicar a migration depois?
- [ ] Nome da aba: **Radar Comercial** (sua preferência) — confirmo.

Nada roda sem aval.
