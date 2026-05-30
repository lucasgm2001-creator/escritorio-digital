#!/bin/bash

# Script para executar seed no Supabase
# Uso: SUPABASE_SERVICE_ROLE_KEY=sk_xxx npm run seed

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Erro: variável SUPABASE_SERVICE_ROLE_KEY não definida"
  echo "Defina a variável de ambiente antes de executar:"
  echo "  export SUPABASE_SERVICE_ROLE_KEY=your_key"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ Erro: variável NEXT_PUBLIC_SUPABASE_URL não definida"
  exit 1
fi

echo "🌱 Iniciando seed no Supabase..."
echo "URL: $NEXT_PUBLIC_SUPABASE_URL"

# Executa o script com npx tsx
npx tsx scripts/seed.ts

if [ $? -eq 0 ]; then
  echo "✓ Seed completado com sucesso!"
else
  echo "❌ Erro ao executar seed"
  exit 1
fi
