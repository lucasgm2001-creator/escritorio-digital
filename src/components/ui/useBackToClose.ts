'use client'
import { useEffect, useRef } from 'react'

// VOLTAR FECHA O PAINEL (MOBILE-VOLTAR-001). No celular, painel/folha/modal parece uma TELA: o gesto de voltar do
// iPhone (deslizar da borda), o botão voltar do Android e o "voltar" do navegador devem fechá-lo — antes saíam
// da página inteira (ou não faziam nada no app instalado), e o único caminho era um "X" pequeno no topo, colado
// na barra de status.
//
// Cada painel aberto empilha UMA entrada no histórico (mesma URL). Voltar fecha só o painel do TOPO (pilha →
// painéis aninhados fecham um por vez). Fechou pelo botão/ESC/salvar? A entrada dele é retirada com
// history.back(), e esse popstate é ignorado — senão fecharia também o painel de baixo.
//
// A entrada leva junto o estado interno do Next (spread de history.state), então o popstate dele restaura a
// MESMA página, sem recarregar nem buscar nada.

type Entry = { id: string; close: () => void; closedByBack: boolean }

const stack: Entry[] = []
let ignorePops = 0
let listening = false
let seq = 0

function onPopState() {
  if (ignorePops > 0) { ignorePops--; return }
  const top = stack.pop()
  if (!top) return
  top.closedByBack = true
  top.close()
}

export function useBackToClose(onClose: () => void, enabled = true) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    if (!listening) { window.addEventListener('popstate', onPopState); listening = true }

    const entry: Entry = { id: `ed-sheet-${++seq}`, close: () => onCloseRef.current(), closedByBack: false }
    stack.push(entry)
    window.history.pushState({ ...(window.history.state ?? {}), __edSheet: entry.id }, '')

    return () => {
      const i = stack.indexOf(entry)
      if (i >= 0) stack.splice(i, 1)
      if (entry.closedByBack) return
      // Só retira a entrada se ela ainda é a atual: se o painel sumiu porque a pessoa navegou para outra página,
      // voltar aqui a mandaria de volta para a página anterior.
      if (window.history.state?.__edSheet === entry.id) {
        ignorePops++
        window.history.back()
      }
    }
  }, [enabled])
}
