import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export default function ProductosPage() {
  return (
    <DashboardPageShell
      title="Maestro de Productos"
      subtitle="Catálogo y gestión de productos"
    >
      <PagePlaceholder
        title="Maestro de Productos"
        description="Este módulo se implementará en una fase posterior."
      />
    </DashboardPageShell>
  );
}
