-- 054 PRODUCT-SPRINT-003 (Parte 2): forma de pagamento do cliente.
-- Texto livre/curto (PIX, cartão, transferência, dinheiro, wire, outro) — é só cadastro/registro. NÃO afeta o
-- motor financeiro (que continua por semana/paid_on) nem a comissão. O "valor personalizado" reusa plan_weekly
-- (número já existente) — sem coluna nova. Aditivo, sem drops.
alter table public.clients add column if not exists forma_pagamento text;
