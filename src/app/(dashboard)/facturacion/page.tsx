import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export default function FacturacionPage() {
  return (
    <DashboardPageShell
      title="Facturación"
      subtitle="Emisión y control de facturas"
    >
      <PagePlaceholder
        title="Facturación"
        description="Este módulo se implementará en una fase posterior."
      />
    </DashboardPageShell>
  );
}
