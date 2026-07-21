'use client'

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

export interface PreloadableMaterial {
  id: string
  name: string
  url: string
  mime_type: string | null
}

type PreparationTimings = {
  totalMs: number
  dependencyMs?: number
  documentMs?: number
  firstPageMs?: number
  firstFrameMs?: number
  loadMs?: number
  decodeMs?: number
}

export type PreparedMaterial =
  | { kind: 'image'; materialId: string; url: string; image: HTMLImageElement; timings: PreparationTimings }
  | { kind: 'pdf'; materialId: string; url: string; document: PDFDocumentProxy; firstCanvas: HTMLCanvasElement; timings: PreparationTimings }
  | { kind: 'generic'; materialId: string; url: string; timings: PreparationTimings }

let pdfJsPromise: Promise<typeof import('pdfjs-dist')> | null = null

export function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist').then(pdfjs => {
      // Empacota o worker da mesma dependência do app. Evita executar JavaScript de CDN
      // durante uma apresentação e elimina risco de troca externa do arquivo.
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()
      return pdfjs
    }).catch(error => {
      pdfJsPromise = null
      throw error
    })
  }
  return pdfJsPromise
}

export async function renderPdfPageIntoCanvas(page: PDFPageProxy, canvas: HTMLCanvasElement, containerWidth: number) {
  const base = page.getViewport({ scale: 1 })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const MAX_SIDE = 8192
  const MAX_AREA = 16_000_000
  const cw = Math.max(containerWidth, 100)
  const fit = cw / base.width
  let scale = fit * dpr
  const w = base.width * scale
  const h = base.height * scale
  const cap = Math.min(1, MAX_SIDE / w, MAX_SIDE / h, Math.sqrt(MAX_AREA / (w * h)))
  if (cap < 1) scale *= cap
  const viewport = page.getViewport({ scale })

  canvas.style.width = '100%'
  canvas.style.aspectRatio = `${base.width} / ${base.height}`
  canvas.className = 'block w-full max-w-full mb-3 bg-transparent rounded-sm shadow-lg'
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar o canvas do PDF.')
  await page.render({ canvasContext: ctx, viewport }).promise
}

async function prepareImage(material: PreloadableMaterial): Promise<PreparedMaterial> {
  const startedAt = performance.now()
  const image = new Image()
  image.alt = material.name
  image.decoding = 'async'

  const loadStartedAt = performance.now()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Não foi possível carregar “${material.name}”.`))
    image.src = material.url
  })
  const loadedAt = performance.now()

  const decodeStartedAt = performance.now()
  if (typeof image.decode === 'function') {
    try {
      await image.decode()
    } catch {
      throw new Error(`Não foi possível preparar “${material.name}”.`)
    }
  }
  const decodedAt = performance.now()
  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error(`O arquivo “${material.name}” não possui dimensões válidas.`)
  }
  image.onload = null
  image.onerror = null

  return {
    kind: 'image',
    materialId: material.id,
    url: material.url,
    image,
    timings: {
      totalMs: decodedAt - startedAt,
      loadMs: loadedAt - loadStartedAt,
      decodeMs: decodedAt - decodeStartedAt,
    },
  }
}

async function preparePdf(material: PreloadableMaterial, targetWidth: number): Promise<PreparedMaterial> {
  const startedAt = performance.now()
  const dependencyStartedAt = performance.now()
  const pdfjs = await loadPdfJs()
  const dependencyReadyAt = performance.now()

  const documentStartedAt = performance.now()
  const pdfDocument = await pdfjs.getDocument(material.url).promise
  const documentReadyAt = performance.now()

  try {
    const pageStartedAt = performance.now()
    const firstPage = await pdfDocument.getPage(1)
    const pageReadyAt = performance.now()
    const firstCanvas = window.document.createElement('canvas')
    const frameStartedAt = performance.now()
    await renderPdfPageIntoCanvas(firstPage, firstCanvas, targetWidth)
    const frameReadyAt = performance.now()

    return {
      kind: 'pdf',
      materialId: material.id,
      url: material.url,
      document: pdfDocument,
      firstCanvas,
      timings: {
        totalMs: frameReadyAt - startedAt,
        dependencyMs: dependencyReadyAt - dependencyStartedAt,
        documentMs: documentReadyAt - documentStartedAt,
        firstPageMs: pageReadyAt - pageStartedAt,
        firstFrameMs: frameReadyAt - frameStartedAt,
      },
    }
  } catch (error) {
    try { await pdfDocument.destroy() } catch { /* noop */ }
    throw error
  }
}

async function prepareMaterial(material: PreloadableMaterial, targetWidth: number): Promise<PreparedMaterial> {
  const mime = material.mime_type ?? ''
  if (mime.startsWith('image/')) return prepareImage(material)
  if (mime === 'application/pdf') return preparePdf(material, targetWidth)
  return { kind: 'generic', materialId: material.id, url: material.url, timings: { totalMs: 0 } }
}

/** Cache de vida curta, pertencente a um único Modo de Reunião. */
export class PresentationPreparationCache {
  private promises = new Map<string, Promise<PreparedMaterial>>()
  private prepared = new Map<string, PreparedMaterial>()
  private disposed = false

  constructor(private readonly targetWidth: () => number) {}

  prepare(material: PreloadableMaterial): Promise<PreparedMaterial> {
    const key = `${material.id}:${material.url}`
    const existing = this.promises.get(key)
    if (existing) return existing

    const promise = prepareMaterial(material, this.targetWidth()).then(result => {
      if (this.disposed) {
        disposePreparedMaterial(result)
        throw new Error('A preparação foi cancelada.')
      }
      this.prepared.set(key, result)
      if (process.env.NODE_ENV === 'development') {
        // Diagnóstico local, sem URL/tokens e eliminado do comportamento de produção.
        console.debug('[Studio preload]', { materialId: result.materialId, kind: result.kind, ...result.timings })
      }
      return result
    }).catch(error => {
      this.promises.delete(key)
      throw error
    })
    this.promises.set(key, promise)
    return promise
  }

  get(material: PreloadableMaterial): PreparedMaterial | null {
    return this.prepared.get(`${material.id}:${material.url}`) ?? null
  }

  dispose() {
    this.disposed = true
    this.prepared.forEach(disposePreparedMaterial)
    this.prepared.clear()
    this.promises.clear()
  }
}

function disposePreparedMaterial(material: PreparedMaterial) {
  if (material.kind === 'pdf') {
    material.firstCanvas.remove()
    try { material.document.destroy() } catch { /* noop */ }
  } else if (material.kind === 'image') {
    material.image.onload = null
    material.image.onerror = null
    material.image.remove()
  }
}
