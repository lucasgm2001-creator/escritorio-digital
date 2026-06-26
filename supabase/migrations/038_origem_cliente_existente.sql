-- Permite marcar um lead que JÁ É CLIENTE (adicionado ao funil a partir de um cliente existente).
-- origem = 'cliente_existente' é um FLAG p/ os relatórios NÃO contarem como venda/comissão nova.
-- Mudança ADITIVA: só amplia o CHECK de `origem` (não recalcula histórico, não toca dinheiro).
-- APLICAR MANUALMENTE (Supabase único, migrations manuais).

alter table public.leads drop constraint if exists leads_origem_check;
alter table public.leads add constraint leads_origem_check
  check (origem = any (array[
    'instagram', 'google', 'indicacao', 'tiktok', 'site', 'outro', 'magnetic', 'cliente_existente'
  ]));
