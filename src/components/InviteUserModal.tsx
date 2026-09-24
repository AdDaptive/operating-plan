"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PermissionLevel } from "@/lib/db";
import { LEVEL_ORDER, LEVEL_META } from "@/lib/permissions";

type Props = {
  /** Existing accounts, for the optional "reports to" dropdown. */
  users: { id: string; name: string }[];
};

/**
 * Admin-only "Invite person" flow (Team page). This is the only way a new
 * account gets created now that public /signup is gone -- the person gets
 * emailed a link to set their own password (see /api/admin/invite and
 * src/app/activate).
 */
export default function InviteUserModal({ users }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [managerId, setManagerId] = useState("");
  const [level, setLevel] = useState<PermissionLevel>("EMPLOYEE");
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setManagerId("");
    setLevel("EMPLOYEE");
    setIsAdmin(false);
    setError(null);
    setResult(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, managerId: managerId || undefined, isAdmin, level }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong sending the invite.");
      return;
    }

    setResult(
      data.emailSent
        ? `Invite emailed to ${data.email}.`
        : `Account created for ${data.email}, but the invite email couldn't be sent (email isn't configured yet) — see the README for setting up SMTP_HOST/SMTP_USER/SMTP_PASS, or use "Resend invite" once it is.`
    );
    setName("");
    setEmail("");
    setManagerId("");
    setLevel("EMPLOYEE");
    setIsAdmin(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-accent-hover"
      >
        Invite person
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          <div
            className="w-full max-w-[420px] rounded-card bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-[18px] font-bold text-ink">
              Invite someone to AdDaptive OS
            </h3>
            <p className="mt-1 text-[13px] text-ink-secondary">
              They&rsquo;ll get an email with a link to set their own password.
            </p>

            <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3.5">
              <div>
                <label htmlFor="invite-name" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Full name
                </label>
                <input
                  id="invite-name"
                  required
                  placeholder="Jamie Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="invite-email" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Work email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="you@addaptive.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
              </div>
              <div>
                <label htmlFor="invite-manager" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Reports to <span className="font-normal text-ink-tertiary">(optional)</span>
                </label>
                <select
                  id="invite-manager"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                >
                  <option value="">No manager</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="invite-level" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Level
                </label>
                <select
                  id="invite-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value as PermissionLevel)}
                  className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                >
                  {LEVEL_ORDER.map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_META[l].label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11.5px] text-ink-tertiary">
                  Decides which objectives, key results, and tasks they can see -- editable later
                  from this Team page.
                </p>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D0D5DD]"
                />
                Make this person an admin too (they&rsquo;ll be able to invite others)
              </label>

              {error && <p className="text-[13px] text-status-offTrackText">{error}</p>}
              {result && <p className="text-[13px] text-ink-secondary">{result}</p>}

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  className="rounded-lg px-4 py-2 text-[13.5px] font-semibold text-ink-secondary hover:bg-surface-panel"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
