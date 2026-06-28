// Copia texto pro clipboard COM fallback pra contexto não-seguro (HTTP / acesso por IP na LAN), onde
// navigator.clipboard é undefined ou rejeita. Retorna true SÓ em sucesso real (pra UI só mostrar "Copiado!"
// quando copiou de verdade). Nunca lança.
export async function copyText(text: string): Promise<boolean> {
  // Caminho moderno (precisa de HTTPS/localhost).
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* cai no fallback */ }

  // Fallback: textarea temporária + execCommand('copy') (funciona em HTTP).
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
