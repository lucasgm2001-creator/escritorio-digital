# Scripts

## Seed

Script para popular o banco de dados com usuários iniciais.

### Usuários criados:
- **Daniel** (daniel@drgrowth.com) - Role: admin
- **Lucas** (lucas@drgrowth.com) - Role: comercial  
- **Gabriel** (gabriel@drgrowth.com) - Role: trafego
- **Thamyris** (thamyris@drgrowth.com) - Role: financeiro

Senhas padrão:
- Daniel: `Daniel@123456`
- Lucas: `Lucas@123456`
- Gabriel: `Gabriel@123456`
- Thamyris: `Thamyris@123456`

### Como executar:

1. Configure as variáveis de ambiente:
```bash
export NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="sua-service-key"
```

2. Execute o script:
```bash
npm run seed
# ou
bash scripts/seed.sh
```

### Obter a SUPABASE_SERVICE_ROLE_KEY:

1. Acesse o Supabase Dashboard do seu projeto
2. Vá em Settings → API
3. Copie a chave `service_role` (cuidado: ela tem acesso total)

### ⚠️ Aviso:

O script cria usuários no Auth do Supabase com email confirmado e insere os perfis na tabela `profiles`. Se os usuários já existirem, o script tentará criar novamente e pode gerar erros.
