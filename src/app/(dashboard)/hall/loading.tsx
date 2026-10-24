// Skeleton Bento do Hall — mesma estrutura do painel da empresa (cabeçalho, 4 cartões de Dinheiro,
// gráfico de 12 meses, grupos menores) enquanto o server busca.
export default function HallLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded bg-bento-border/40 animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-bento-border/30 animate-pulse" />
      </div>
      <div className="h-10 w-full rounded bg-bento-border/30 animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-24 rounded-bento bg-bento-border/30 animate-pulse" />)}
      </div>
      <div className="h-56 rounded-bento bg-bento-border/30 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-bento bg-bento-border/30 animate-pulse" />)}
      </div>
    </div>
  )
}
