// Normaliza um telefone para o formato que o wa.me/sms esperam: SÓ dígitos, com código do país.
// O \D do replace é ASCII → tira também caracteres invisíveis (zero-width, RTL/LTR marks) e hífens
// não-padrão que às vezes vêm nos leads. US sem código do país (10 dígitos) → prefixa '1'.
// Ex.: "‪+1 (561) 774‑9323‬" → "15617749323".
export function waNumber(raw?: string | null): string | null {
  if (!raw) return null
  let d = String(raw).replace(/\D/g, '')
  if (d.length === 10) d = '1' + d
  return d || null
}

// Telefone para LEITURA HUMANA: "+1 (561) 774-9323" — país, DDD e número separados, como o cliente dos EUA
// reconhece o próprio número. O banco guarda o telefone cru (às vezes "+12019081945", tudo grudado), que é
// bom para discar e ruim para ler/ditar. Só formata o que reconhece: 10 dígitos (US sem país) ou 11 com o 1.
// Outros comprimentos (internacional fora dos EUA) voltam com país e resto separados, sem inventar máscara.
export function formatPhoneBR(raw?: string | null): string | null {
  if (!raw) return null
  const d = String(raw).replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10) return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith('1')) {
    const n = d.slice(1)
    return `+1 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`
  }
  if (d.length > 11) return `+${d.slice(0, d.length - 10)} ${d.slice(-10, -7)} ${d.slice(-7)}`
  return `+${d}`
}
