// Indicador de módulo (KPI) — hierarquia visual profissional. Sem dados nesta fase: value cai em "—".
export function AdminStat({ label, value = '—', hint }: { label: string; value?: string | number; hint?: string }) {
  return (
    <div className="bento-fx p-3">
      <p className="font-display font-bold text-lg text-bento-text leading-none">{value}</p>
      <p className="text-[11px] text-bento-muted mt-1.5 truncate">{label}</p>
      {hint && <p className="text-[10px] text-bento-dim mt-0.5 truncate">{hint}</p>}
    </div>
  )
}
