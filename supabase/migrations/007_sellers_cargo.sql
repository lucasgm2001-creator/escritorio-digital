-- 007_sellers_cargo.sql
-- Adiciona campo cargo/perfil na tabela de vendedores

alter table public.sellers
  add column if not exists cargo text;
