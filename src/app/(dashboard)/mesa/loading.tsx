export default function MesaLoading() {
  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto animate-pulse">
      <div className="h-8 w-48 rounded bg-bento-panel mb-3" />
      <div className="h-4 w-80 max-w-full rounded bg-bento-panel mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-bento bg-bento-panel border border-bento-border" />)}
      </div>
      <div className="grid xl:grid-cols-[180px_minmax(0,1fr)_360px] gap-3">
        <div className="h-80 rounded-bento bg-bento-panel border border-bento-border" />
        <div className="h-[32rem] rounded-bento bg-bento-panel border border-bento-border" />
        <div className="h-[32rem] rounded-bento bg-bento-panel border border-bento-border" />
      </div>
    </div>
  )
}
