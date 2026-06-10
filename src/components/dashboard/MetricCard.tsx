type MetricCardProps = {
  label: string;
  value: string;
  tone: "primary" | "neutral" | "success" | "danger";
};

const toneStyles = {
  primary: {
    icon: "bg-cyan-50 text-cyan-600 ring-cyan-100",
    accent: "from-cyan-500/10 to-transparent",
  },
  neutral: {
    icon: "bg-slate-100 text-slate-600 ring-slate-200",
    accent: "from-slate-500/10 to-transparent",
  },
  success: {
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    accent: "from-emerald-500/10 to-transparent",
  },
  danger: {
    icon: "bg-rose-50 text-rose-600 ring-rose-100",
    accent: "from-rose-500/10 to-transparent",
  },
};

export function MetricCard({ label, value, tone }: MetricCardProps) {
  const styles = toneStyles[tone];

  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${styles.accent}`}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${styles.icon}`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-current opacity-80" />
        </div>
      </div>
    </article>
  );
}
