"use client";

import { useState } from "react";
import Link from "next/link";

/** The "Forgot password?" request form (src/app/forgot-password/page.tsx). */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // The API always returns the same generic response regardless of
    // whether the email matches an account (see /api/forgot-password) --
    // this page doesn't need to branch on the result at all, which is
    // exactly the point: it can't be used to tell who has an account here.
    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setLoading(false);
    setSubmitted(true);
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

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface-sunk p-10 font-sans">
      <div className="w-full max-w-[420px] rounded-card border border-line bg-white p-9">
        {logo}

        {submitted ? (
          <>
            <h2 className="font-display text-[22px] font-bold text-ink">Check your email</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
              If an account exists for <span className="font-semibold text-ink">{email}</span>, we&rsquo;ve
              sent a link to reset the password. It expires in 7 days.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block text-[13.5px] font-semibold text-accent hover:underline"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h2 className="font-display text-[24px] font-bold text-ink">Reset your password</h2>
            <p className="mt-1.5 text-[14px] text-ink-secondary">
              Enter your work email and we&rsquo;ll send you a link to reset it.
            </p>

            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@addaptive.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-lg bg-accent px-0 py-3 text-[14.5px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <div className="mt-5 text-center text-[13.5px] text-ink-secondary">
              <Link href="/login" className="font-semibold text-accent hover:underline">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
