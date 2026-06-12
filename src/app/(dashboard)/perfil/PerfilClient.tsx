'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  userId: string
  email: string
  initialName: string
  initialPhone: string
  initialCargo: string
  initialAvatarUrl: string | null
}

async function resizeImage(file: File, maxKb = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const MAX_DIM = 400
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      const tryQuality = (q: number) => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Falha ao converter imagem')); return }
          if (blob.size > maxKb * 1024 && q > 0.3) {
            tryQuality(q - 0.1)
          } else {
            resolve(blob)
          }
        }, 'image/jpeg', q)
      }
      tryQuality(0.85)
    }
    img.onerror = reject
    img.src = url
  })
}

export function PerfilClient({ userId, email, initialName, initialPhone, initialCargo, initialAvatarUrl }: Props) {
  const [name, setName]       = useState(initialName)
  const [phone, setPhone]     = useState(initialPhone)
  const [cargo, setCargo]     = useState(initialCargo)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [saving, setSaving]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2.5 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Selecione uma imagem válida.'); return }

    setUploading(true)
    setError('')
    try {
      const blob = await resizeImage(file, 200)
      const ext = 'jpg'
      const path = `${userId}/avatar.${ext}`
      const supabase = createClient()

      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const urlWithBust = `${publicUrl}?t=${Date.now()}`

      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: urlWithBust }).eq('id', userId)
      if (dbErr) throw dbErr
      setAvatarUrl(urlWithBust)
      setSuccess('Foto atualizada com sucesso.')
    } catch (err) {
      console.error(err)
      setError('Erro ao enviar foto. Verifique o bucket "avatars" no Supabase.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Nome é obrigatório.'); return }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const supabase = createClient()
      const { error: err } = await supabase.from('profiles').update({
        name: name.trim(),
        phone: phone.trim() || null,
        cargo: cargo.trim() || null,
      }).eq('id', userId)

      if (err) throw err
      setSuccess('Perfil atualizado com sucesso.')
    } catch {
      setError('Erro ao salvar perfil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gerencie suas informações pessoais</p>
      </div>

      {/* Avatar section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Foto de Perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              {avatarUrl ? (
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#2d3748]">
                  <Image src={avatarUrl} alt="Avatar" width={80} height={80} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-lime flex items-center justify-center border-2 border-bento-border">
                  <span className="text-2xl font-bold text-lime-ink">{name[0]?.toUpperCase() ?? 'U'}</span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl">
                  <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                JPG ou PNG. Máximo 200kb após otimização automática.
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 bg-bento-bg border border-bento-border text-bento-text px-4 py-2 rounded-btn text-sm hover:border-lime transition-colors disabled:opacity-50 min-h-[44px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {uploading ? 'Enviando...' : 'Alterar foto'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome *</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Seu nome completo" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">E-mail</label>
              <div className={`${inputCls} text-muted-foreground cursor-not-allowed`}>{email}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Telefone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="(11) 99999-9999" type="tel" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cargo</label>
              <input value={cargo} onChange={e => setCargo(e.target.value)} className={inputCls} placeholder="Ex: Gestor de Tráfego" />
            </div>
          </div>

          {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-sm text-green-400 bg-green-900/20 border border-green-800/40 rounded-lg px-3 py-2">{success}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="bento-btn w-full sm:w-auto px-6 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]"
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
