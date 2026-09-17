import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listObjectives, listKeyResultsByObjective, getUserById } from "@/lib/db";
import { objectiveProgress } from "@/lib/rollup";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) redirect("/login");

  const [objectives, currentUser] = await Promise.all([listObjectives(), getUserById(userId)]);

  const sidebarObjectives = await Promise.all(
    objectives.map(async (o) => {
      const keyResults = await listKeyResultsByObjective(o.id);
      return {
        id: o.id,
        title: o.title,
        progress: objectiveProgress(keyResults),
      };
    })
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface-sunk font-sans text-ink">
      <Sidebar
        objectives={sidebarObjectives}
        user={{
          name: currentUser?.name ?? session.user?.name ?? "",
          email: currentUser?.email ?? session.user?.email ?? "",
        }}
      />
      <div className="flex min-w-0 flex-grow flex-col overflow-hidden">{children}</div>
    </div>
  );
}
