# Vercel CLI - Setup Completo

## ✅ Vercel Instalado com Sucesso!

**Versão:** Vercel CLI 54.6.1

## Como Usar

### 1. **Fazer Login no Vercel**
```bash
npm run vercel login
# ou
vercel login
```

### 2. **Fazer Deploy para Produção**
```bash
npm run deploy
# ou
vercel --prod
```

### 3. **Fazer Deploy para Preview**
```bash
npm run vercel
# ou
vercel
```

### 4. **Outras Comandos Úteis**

**Ver informações do projeto:**
```bash
vercel projects list
```

**Ver deployments:**
```bash
vercel deployments
```

**Configurar domínio:**
```bash
vercel domains add seu-dominio.com
```

**Ver logs:**
```bash
vercel logs
```

**Remover projeto:**
```bash
vercel remove
```

## Configuração Recomendada

### 1. Crie um arquivo `vercel.json` na raiz do projeto:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@next_public_supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@next_public_supabase_anon_key"
  }
}
```

### 2. Configure as variáveis de ambiente no Vercel Dashboard:

1. Acesse https://vercel.com/dashboard
2. Selecione o projeto
3. Vá em Settings → Environment Variables
4. Adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (se necessário)

## Fluxo de Deploy

### Desenvolvimento Local
```bash
npm run dev
```

### Testar Build
```bash
npm run build
npm start
```

### Deploy para Staging
```bash
npm run vercel
# Será criado um URL de preview
```

### Deploy para Produção
```bash
npm run deploy
# Atualiza o domínio principal
```

## Primeiros Passos

1. Execute: `npm run vercel login`
2. Siga as instruções no navegador
3. Conecte sua conta GitHub
4. Selecione este projeto para deploy
5. Configure as variáveis de ambiente
6. Pronto! Agora você pode fazer deploy

## Monitoramento

Acesse https://vercel.com/dashboard para:
- Ver deployments
- Monitorar performance
- Verificar logs
- Configurar domínios
- Gerenciar variáveis de ambiente

## Dicas de Segurança

⚠️ **NUNCA** commit `.env.local` ou variáveis sensíveis no GitHub!

Use o Vercel Dashboard para:
- Gerenciar `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Gerenciar `SUPABASE_SERVICE_ROLE_KEY`
- Configurar secrets para CI/CD

## Suporte

- Docs: https://vercel.com/docs
- Dashboard: https://vercel.com/dashboard
- Help: https://vercel.com/support
