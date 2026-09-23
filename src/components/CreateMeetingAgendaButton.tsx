"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputClass } from "./form";

/**
 * Opens a modal to pick a meeting date and any number of attendees, then
 * POSTs to /api/meeting-agendas, which builds the agenda (every key result
 * an attendee owns, plus every task an attendee owns or is a delegated
 * sub-owner of, highest priority then soonest due date first -- see
 * src/lib/meetingAgenda.ts), emails each attendee a link to it, and
 * returns the new agenda's id. On success, navigates straight to the
 * generated /agenda/[id] page.
 */
export default function CreateMeetingAgendaButton({
  users,
}: {
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [meetingDate, setMeetingDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (attendeeIds.length === 0) {
      setError("Pick at least one attendee.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/meeting-agendas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingDate, attendeeIds }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    const agenda = await res.json();
    setOpen(false);
    setAttendeeIds([]);
    setMeetingDate("");
    router.push(`/agenda/${agenda.id}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:bg-surface-panel"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        Create Meeting Agenda
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Create meeting agenda">
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          <Field label="Meeting date">
            <input
              required
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={`Attendees${attendeeIds.length ? ` (${attendeeIds.length} selected)` : ""}`}>
            <div className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto rounded-lg border border-[#D0D5DD] p-2">
              {sortedUsers.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink hover:bg-surface-panel"
                >
                  <input
                    type="checkbox"
                    checked={attendeeIds.includes(u.id)}
                    onChange={() => toggleAttendee(u.id)}
                  />
                  {u.name}
                </label>
              ))}
            </div>
          </Field>
          {error && <p className="text-[12.5px] text-status-offTrackText">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create agenda & email attendees"}
          </button>
        </form>
      </Modal>
    </>
  );
}
