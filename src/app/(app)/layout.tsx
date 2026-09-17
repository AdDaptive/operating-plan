import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getObjectivesFull, getUserById } from "@/lib/db";
import { objectiveProgress } from "@/lib/rollup";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) redirect("/login");

  const [objectives, currentUser] = await Promise.all([getObjectivesFull(), getUserById(userId)]);

  // getObjectivesFull() (not listObjectives() + listKeyResultsByObjective())
  // on purpose: only it derives each key result's status from its tasks
  // (computeKeyResultStatus). The raw key_results.status column is
  // vestigial -- always "NOT_STARTED" -- so using the raw rows here was
  // silently showing every objective's sidebar progress as 0%.
  const sidebarObjectives = objectives.map((o) => ({
    id: o.id,
    title: o.title,
    progress: objectiveProgress(o.keyResults),
  }));

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
