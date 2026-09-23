import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getMeetingAgendaById, getObjectivesFull, listUsers, type UserRow } from "@/lib/db";
import { buildMeetingAgendaSections } from "@/lib/meetingAgenda";
import { STATUS_META, isOverdue } from "@/lib/status";
import { PRIORITY_META } from "@/lib/priority";
import { initials, colorForName } from "@/lib/avatar";
import PrintAgendaButton from "@/components/PrintAgendaButton";

/**
 * The generated meeting agenda for one CreateMeetingAgendaButton submission
 * (src/components/CreateMeetingAgendaButton.tsx). Only the meeting date and
 * attendee list are actually stored (meeting_agendas) -- the key
 * results/tasks below are recomputed live via buildMeetingAgendaSections
 * every time this page loads, so it always reflects current data right up
 * to the meeting, not a frozen snapshot from when the agenda was created.
 * The same content is what gets emailed to attendees at creation time (see
 * sendMeetingAgendaEmail in src/lib/notifications.ts).
 */
export default async function MeetingAgendaPage({ params }: { params: { id: string } }) {
  const agenda = await getMeetingAgendaById(params.id);
  if (!agenda) notFound();

  const [objectives, users] = await Promise.all([getObjectivesFull(), listUsers()]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const attendees = agenda.attendeeIds
    .map((id) => userById.get(id))
    .filter((u): u is UserRow => Boolean(u));
  const sections = buildMeetingAgendaSections(objectives, agenda.attendeeIds);

  return (
    <div className="flex-grow overflow-y-auto p-4 md:p-7">
      <div className="mx-auto flex max-w-[820px] flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-line bg-white p-5">
          <div>
            <div className="text-[10px] font-bold tracking-wide text-ink-tertiary">MEETING AGENDA</div>
            <h1 className="mt-1 font-display text-[21px] font-bold text-ink">
              {format(new Date(agenda.meetingDate), "EEEE, MMMM d, yyyy")}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {attendees.map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-full bg-surface-panel px-2.5 py-1 text-[12px] font-medium text-ink-secondary"
                >
                  <span
                    className="flex h-[16px] w-[16px] flex-shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                    style={{ background: colorForName(a.name) }}
                  >
                    {initials(a.name)}
                  </span>
                  {a.name}
                </span>
              ))}
            </div>
          </div>
          <PrintAgendaButton />
        </div>

        {sections.length === 0 ? (
          <div className="rounded-card border border-dashed border-line bg-white py-14 text-center text-[13px] text-ink-secondary">
            None of the selected attendees own or are delegated to any key result or task yet.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {sections.map((s) => (
              <div key={s.keyResultId} className="overflow-hidden rounded-card border border-line bg-white">
                <div className="border-b border-[#EEF0F3] px-5 py-3.5">
                  <div className="text-[10px] font-bold tracking-wide text-ink-tertiary">{s.objectiveTitle}</div>
                  <div className="text-[15px] font-bold text-ink">{s.keyResultTitle}</div>
                  {s.keyResultOwnerName && (
                    <div className="mt-0.5 text-[12px] text-ink-secondary">Owner: {s.keyResultOwnerName}</div>
                  )}
                </div>
                {s.tasks.length === 0 ? (
                  <div className="px-5 py-4 text-[13px] text-ink-tertiary">No tasks under this key result yet.</div>
                ) : (
                  s.tasks.map((task) => {
                    const overdue = isOverdue(task.dueDate, task.status);
                    return (
                      <div
                        key={task.id}
                        className="flex flex-wrap items-center gap-2.5 border-t border-[#F2F4F7] px-5 py-3"
                      >
                        <span
                          className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                          style={{ background: STATUS_META[task.status].dot }}
                        />
                        <span className="text-[13.5px] font-medium text-ink">{task.title}</span>
                        {task.priority && (
                          <span
                            className="flex-shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                            style={{ background: PRIORITY_META[task.priority].bg, color: PRIORITY_META[task.priority].text }}
                          >
                            {PRIORITY_META[task.priority].label}
                          </span>
                        )}
                        <span className="text-[12.5px] text-ink-secondary">{task.owner.name}</span>
                        <span
                          className="text-[12.5px] font-medium"
                          style={{ color: overdue ? "#B42318" : "#475467" }}
                        >
                          Due {format(new Date(task.dueDate), "MMM d")}
                          {overdue ? " · overdue" : ""}
                        </span>
                        <span
                          className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: STATUS_META[task.status].bg, color: STATUS_META[task.status].text }}
                        >
                          {STATUS_META[task.status].label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
