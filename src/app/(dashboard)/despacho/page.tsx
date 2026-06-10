import { DashboardPageShell } from "@/components/layout/DashboardPageShell";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export default function DespachoPage() {
  return (
    <DashboardPageShell
      title="Despacho"
      subtitle="Salida y entrega de mercadería"
    >
      <PagePlaceholder
        title="Despacho"
        description="Este módulo se implementará en una fase posterior."
      />
    </DashboardPageShell>
  );
}
