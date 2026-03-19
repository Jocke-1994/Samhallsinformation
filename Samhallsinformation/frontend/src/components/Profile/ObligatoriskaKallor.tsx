export default function ObligatoriskaKallor() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-xl shrink-0">🔒</div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Obligatoriska källor</h2>
            <p className="text-sm text-slate-500 mt-0.5">Kan inte stängas av — kontakta support vid önskemål</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Krisinformation.se</p>
            <p className="text-xs text-slate-400 mt-0.5">Nationell krisinformation</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-4 rounded-full bg-violet-300 relative cursor-not-allowed select-none">
                <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-white shadow-sm" />
              </div>
              <span className="text-xs text-slate-400">Mail</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-4 rounded-full bg-violet-300 relative cursor-not-allowed select-none">
                <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-white shadow-sm" />
              </div>
              <span className="text-xs text-slate-400">SMS</span>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">Direkt</span>
          </div>
        </div>
      </div>
    </div>
  )
}
