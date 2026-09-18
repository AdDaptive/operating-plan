"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Mode = "invite" | "reset";

const COPY: Record<Mode, { heading: string; subheading: string; button: string; buttonLoading: string }> = {
  invite: {
    heading: "Set your password",
    subheading: "Finish setting up the account your admin created for you.",
    button: "Activate account",
    buttonLoading: "Setting password…",
  },
  reset: {
    heading: "Reset your password",
    subheading: "Choose a new password for your account.",
    button: "Reset password",
    buttonLoading: "Resetting…",
  },
};

/**
 * The form half of both /activate (claiming a brand-new invite) and
 * /reset-password (forgot password) -- both are "take a token, set a
 * password" and both post to the same /api/set-password route, so this
 * component only needs a `mode` to know which copy to show.
 */
export default function SetPasswordForm({ token, mode }: { token: string; mode: Mode }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const copy = COPY[mode];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", {
      email: data.email,
      password,
      remember: "true",
      redirect: false,
    });
    setLoading(false);
    if (signInRes?.error) {
      router.push("/login");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const logo = (
    <div className="mb-6 flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent font-display text-[17px] font-extrabold text-white">
        A
      </div>
      <div className="flex items-center gap-2">
        <span className="font-display text-lg font-bold text-ink">AdDaptive</span>
        <span className="rounded-md bg-surface-panel px-[7px] py-0.5 text-[10px] font-bold text-ink-secondary">
          OS
        </span>
      </div>
    </div>
  );

  if (!token) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-surface-sunk p-10 font-sans">
        <div className="w-full max-w-[420px] rounded-card border border-line bg-white p-9">
          {logo}
          <h2 className="font-display text-[22px] font-bold text-ink">Missing link token</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
            This page needs a token in the link. Use the link straight from the email, or
            {mode === "invite" ? " ask whoever invited you to resend it." : " request a new reset link."}
          </p>
          <Link
            href={mode === "invite" ? "/login" : "/forgot-password"}
            className="mt-5 inline-block text-[13.5px] font-semibold text-accent hover:underline"
          >
            {mode === "invite" ? "Back to sign in" : "Request a new link"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface-sunk p-10 font-sans">
      <div className="w-full max-w-[420px] rounded-card border border-line bg-white p-9">
        {logo}

        <h2 className="font-display text-[24px] font-bold text-ink">{copy.heading}</h2>
        <p className="mt-1.5 text-[14px] text-ink-secondary">{copy.subheading}</p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
              {mode === "reset" ? "New password" : "Password"}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-[13px] font-semibold text-[#344054]"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-[13px] text-status-offTrackText">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-accent px-0 py-3 text-[14.5px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? copy.buttonLoading : copy.button}
          </button>
        </form>
      </div>
    </div>
  );
}
