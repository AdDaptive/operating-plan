import Link from "next/link";
import SignOutButton from "./SignOutButton";
import { initials, colorForName } from "@/lib/avatar";

const NAV_ICONS: Record<string, JSX.Element> = {
  home: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <path d="M9 22V12h6v10"></path>
    </svg>
  ),
  tasks: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"></path>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
  ),
  objectives: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"></circle>
      <circle cx="12" cy="12" r="5"></circle>
      <circle cx="12" cy="12" r="1"></circle>
    </svg>
  ),
  team: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  reports: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10"></path>
      <path d="M12 20V4"></path>
      <path d="M6 20v-6"></path>
    </svg>
  ),
};

export default function Sidebar({
  objectives,
  user,
}: {
  objectives: { id: string; title: string; progress: number }[];
  user: { name: string; email: string };
}) {
  return (
    <div className="flex w-[252px] flex-shrink-0 flex-col border-r border-line bg-white p-3.5">
      <div className="flex items-center gap-2.5 px-2 pb-4 pt-1">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-accent font-display text-sm font-extrabold text-white">
          A
        </div>
        <span className="font-display text-[15px] font-bold text-ink">AdDaptive</span>
        <span className="rounded-md bg-surface-panel px-1.5 py-0.5 text-[10px] font-bold text-ink-secondary">
          OS
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        <SidebarLink href="/objectives" icon="home" label="Home" />
        <SidebarLink href="/objectives" icon="tasks" label="My Tasks" />
        <SidebarLink href="/objectives" icon="objectives" label="Objectives" active />
        <SidebarLink href="/objectives" icon="team" label="Team" />
        <SidebarLink href="/objectives" icon="reports" label="Reports" />
      </nav>

      <div className="mb-2 mt-5 px-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary">
        OBJECTIVES
      </div>
      <div className="flex flex-col gap-2.5 px-2.5">
        {objectives.length === 0 && (
          <p className="text-[12px] text-ink-tertiary">No objectives yet.</p>
        )}
        {objectives.map((obj) => (
          <Link key={obj.id} href={`/board/${obj.id}`} className="group block">
            <div className="mb-1 truncate text-[12.5px] font-semibold text-[#344054] group-hover:text-accent">
              {obj.title}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 flex-grow overflow-hidden rounded-full bg-[#EEF0F3]">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${obj.progress}%` }}
                />
              </div>
              <span className="text-[11px] text-ink-tertiary">{obj.progress}%</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex gap-2 rounded-lg border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <span className="text-[11px] leading-relaxed text-ink-secondary">
            Reminders auto-send to the task owner and their manager 3 days and 1 day
            before the due date.
          </span>
        </div>
        <div className="flex items-center gap-2.5 border-t border-[#EEF0F3] px-1 pt-3.5">
          <div
            className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
            style={{ background: colorForName(user.name || user.email) }}
          >
            {initials(user.name || user.email)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold text-ink">{user.name}</div>
            <div className="truncate text-[10.5px] text-ink-tertiary">{user.email}</div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: keyof typeof NAV_ICONS;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition ${
        active
          ? "bg-accent-soft font-semibold text-accent"
          : "font-medium text-[#344054] hover:bg-surface-sunk"
      }`}
    >
      {NAV_ICONS[icon]}
      {label}
    </Link>
  );
}
