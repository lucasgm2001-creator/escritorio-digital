-- Backfill do NICHO dos leads do Magnetic a partir do company_name.
--
-- O formulário do Magnetic não envia serviço/nicho: `customData` chega {} e nenhuma das chaves que o webhook
-- procura (nicho, service, servico, business_type, segmento…) existe no payload. Conferido em 129 leads:
-- ZERO com nicho preenchido. Quem carrega o serviço na prática é o company_name — chegam valores como
-- "Marketing" e "(C.N.A.) Certified Nurses Assistant", que são profissão e não razão social.
--
-- O webhook passou a gravar o mesmo texto nos dois campos (nicho para filtrar/segmentar, empresa para
-- exibir). Esta migration aplica a mesma regra ao histórico, para o funil não ficar com metade dos cards
-- mostrando "Tipo de serviço: —" só por terem entrado antes.
--
-- Só toca em lead do Magnetic que está SEM nicho e COM empresa: não sobrescreve nicho preenchido à mão nem
-- inventa valor onde não há origem. Assim que o formulário tiver o campo próprio, ele ganha precedência no
-- webhook e este backfill não precisa ser repetido.

begin;

update public.leads
set nicho = trim(company)
where origem = 'magnetic'
  and deleted_at is null
  and nullif(trim(nicho), '') is null
  and nullif(trim(company), '') is not null;

commit;
