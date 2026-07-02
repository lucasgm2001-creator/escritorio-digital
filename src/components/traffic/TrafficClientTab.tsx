import { TrafficDashboard } from './TrafficDashboard'

// PREPARAÇÃO ARQUITETURAL (PARTE 3) — a futura aba "Tráfego" no perfil do cliente.
// Reutiliza EXATAMENTE os mesmos componentes do domínio Tráfego (fonte única), só passando o cliente.
// Ainda NÃO wireado no perfil do cliente (isso tocaria a lógica de Clientes) — pronto para plugar.
export function TrafficClientTab({ clientName }: { clientName: string }) {
  return <TrafficDashboard clientName={clientName} />
}
