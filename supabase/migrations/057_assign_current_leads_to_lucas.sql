-- 057 — Responsavel padrao dos leads atuais: Lucas
--
-- Pedido operacional: todos os leads atuais devem ficar com Lucas como responsavel.
-- IMPORTANTE:
--   * altera SOMENTE public.leads;
--   * NAO altera public.clients;
--   * NAO apaga dados;
--   * preserva ids reais ja documentados em migrations anteriores.
--
-- IDs reais atuais:
--   Lucas user_id/profile id = 623dd724-ddeb-426c-956a-4c71f6653fa5
--   DR Growth M. team_id     = 7cf9b5d3-e42f-48d7-bfdf-575736e72827

update public.leads
   set assigned_to = '623dd724-ddeb-426c-956a-4c71f6653fa5'::uuid,
       assigned_name = 'Lucas',
       updated_at = coalesce(updated_at, now())
 where (team_id = '7cf9b5d3-e42f-48d7-bfdf-575736e72827'::uuid or team_id is null)
   and (
     assigned_to is distinct from '623dd724-ddeb-426c-956a-4c71f6653fa5'::uuid
     or assigned_name is distinct from 'Lucas'
   );
