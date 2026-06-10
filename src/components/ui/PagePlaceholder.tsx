type PagePlaceholderProps = {
  title: string;
  description: string;
  moduleLabel?: string;
};

export function PagePlaceholder({
  title,
  description,
  moduleLabel = "Módulo en desarrollo",
}: PagePlaceholderProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100">
            <span className="text-lg">◆</span>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
              {moduleLabel}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          </div>
        </div>
      </div>

      <div className="px-6 py-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <span className="text-2xl">▢</span>
        </div>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-slate-600">
          {description}
        </p>
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
          Disponible en una fase posterior del prototipo
        </div>
      </div>
    </div>
  );
}
