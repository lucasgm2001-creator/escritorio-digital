-- Desfaz o backfill de nicho a partir do company_name.
--
-- A tentativa anterior herdava o nicho do company_name porque o formulário do Magnetic não manda serviço.
-- Não funcionou: company_name é texto livre e as pessoas escrevem o próprio nome ("Aguinaldo", "Clovis
-- Nascimento"), o nome da empresa ("ADR Painting"), "Self-Employed" ou uma frase inteira. Nicho sem valor
-- confiável é PIOR que nicho vazio — não dá para filtrar nem segmentar por cima disso, e ainda passa a
-- impressão de que o dado existe.
--
-- Alvo exato do backfill: lead do Magnetic cujo nicho é IDÊNTICO ao company. Antes do backfill nenhum lead
-- do Magnetic tinha nicho, então isto não apaga nada que tenha sido preenchido à mão.
--
-- O nicho volta a sair SÓ de um campo próprio do formulário. O webhook já procura por nicho/service/servico/
-- niche/segmento/business_type/tipo e achata objetos aninhados (flattenCI), então quando o Magnetic passar a
-- mandar a chave — inclusive dentro de customData — ela é capturada sem mudança de código.

begin;

update public.leads
set nicho = null
where origem = 'magnetic'
  and deleted_at is null
  and nullif(trim(nicho), '') is not null
  and trim(nicho) = trim(company);

commit;
