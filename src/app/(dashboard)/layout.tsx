import { redirect } from "next/navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { UserProfileProvider } from "@/components/layout/UserProfileProvider";
import { getAppUserProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getAppUserProfile(supabase, user.id);

  return (
    <UserProfileProvider profile={profile}>
      <AuthGuard>
        <div className="flex min-h-screen bg-slate-100">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </AuthGuard>
    </UserProfileProvider>
  );
}
