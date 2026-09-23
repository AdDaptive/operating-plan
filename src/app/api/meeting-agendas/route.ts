import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createMeetingAgenda, getObjectivesFull, listUsers, type UserRow } from "@/lib/db";
import { buildMeetingAgendaSections } from "@/lib/meetingAgenda";
import { sendMeetingAgendaEmail } from "@/lib/notifications";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { meetingDate, attendeeIds } = body ?? {};
  if (!meetingDate) {
    return NextResponse.json({ error: "Meeting date is required." }, { status: 400 });
  }
  if (!Array.isArray(attendeeIds) || attendeeIds.length === 0) {
    return NextResponse.json({ error: "Pick at least one attendee." }, { status: 400 });
  }

  const creator = session.user as { id?: string } | undefined;
  const agenda = await createMeetingAgenda({
    meetingDate,
    attendeeIds,
    createdById: creator?.id ?? null,
  });

  // Same never-block-the-request, awaited-but-failure-isolated pattern as
  // every other notification in this app (see notifications.ts) -- build
  // the agenda content once here and reuse it for every attendee's email,
  // rather than each one recomputing it.
  const [objectives, users] = await Promise.all([getObjectivesFull(), listUsers()]);
  const sections = buildMeetingAgendaSections(objectives, attendeeIds);
  const userById = new Map(users.map((u) => [u.id, u]));
  const attendees = (attendeeIds as string[])
    .map((id) => userById.get(id))
    .filter((u): u is UserRow => Boolean(u));
  await sendMeetingAgendaEmail(agenda, attendees, sections);

  return NextResponse.json(agenda, { status: 201 });
}
