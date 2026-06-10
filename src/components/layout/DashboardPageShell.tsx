import { Header } from "@/components/layout/Header";

type DashboardPageShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function DashboardPageShell({
  title,
  subtitle,
  children,
}: DashboardPageShellProps) {
  return (
    <>
      <Header title={title} subtitle={subtitle} />
      <main className="flex-1 overflow-auto px-6 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      </main>
    </>
  );
}
