import type { InventoryAlert } from "@/modules/dashboard/services/metrics";

const levelStyles = {
  critical: {
    badge: "bg-rose-50 text-rose-700 ring-rose-100",
    dot: "bg-rose-500",
  },
  warning: {
    badge: "bg-amber-50 text-amber-700 ring-amber-100",
    dot: "bg-amber-500",
  },
};

type InventoryAlertsProps = {
  alerts: InventoryAlert[];
};

export function InventoryAlerts({ alerts }: InventoryAlertsProps) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">
          Alertas de inventario
        </h3>
        <p className="mt-0.5 text-sm text-slate-500">
          Productos que requieren reposición
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-slate-500">
            Sin alertas críticas de stock por ahora.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {alerts.map((alert) => {
            const styles = levelStyles[alert.level];

            return (
              <li
                key={alert.id}
                className="flex items-start gap-4 px-5 py-4 transition hover:bg-slate-50/70"
              >
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{alert.product}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{alert.detail}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${styles.badge}`}
                >
                  {alert.level === "critical" ? "Stock bajo" : "Stock mínimo"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
