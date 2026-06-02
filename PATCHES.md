# PATCHES

Registro de correções, mudanças e novidades. Mais recentes no topo.

Categorias: 🐛 Fix · 🔄 Mudança · ✨ Novidade

---

🐛 Fix — verify-password virou oráculo de brute-force. Causa: rota sem rate
limit e usando `signInWithPassword` no client SSR (criava sessão paralela e
podia embaralhar os cookies da sessão ativa). Corrigido com rate limit
agressivo e isolado (5 tentativas / 15 min por usuário, bucket próprio, 429 +
Retry-After) e validação da senha via client Supabase efêmero (`persistSession:
false`), que nunca toca nos cookies da requisição. Resposta mantida genérica
(`{valid:false}`) para não vazar informação.
