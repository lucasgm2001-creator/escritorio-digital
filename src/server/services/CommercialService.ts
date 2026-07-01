import 'server-only'

import type { RequestContext } from '@/server/context/request-context'

/**
 * Arquitetura planejada para o dominio Commercial:
 *
 * UI / Server Actions
 *   -> CommercialService
 *   -> LeadRepository (futuro)
 *   -> Supabase
 *
 * Esta camada vai concentrar regras de negocio de leads, funil comercial,
 * conversao para clientes e permissoes comerciais. Nesta primeira etapa ela
 * ainda nao altera comportamento nem substitui queries existentes.
 */

export async function createLead(context: RequestContext): Promise<void> {
  void context
  // Futuro: validar permissao commercial.create, normalizar payload e delegar para LeadRepository.
}

export async function updateLead(context: RequestContext): Promise<void> {
  void context
  // Futuro: validar permissao commercial.edit, aplicar regras de edicao e delegar para LeadRepository.
}

export async function deleteLead(context: RequestContext): Promise<void> {
  void context
  // Futuro: validar permissao commercial.delete, proteger historico relacionado e delegar para LeadRepository.
}

export async function moveLeadStage(context: RequestContext): Promise<void> {
  void context
  // Futuro: validar permissao commercial.edit, registrar evento de etapa e atualizar metricas derivadas.
}

export async function convertLeadToClient(context: RequestContext): Promise<void> {
  void context
  // Futuro: validar permissoes commercial.edit e clients.create, criar cliente e preservar origem do lead.
}
