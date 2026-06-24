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
