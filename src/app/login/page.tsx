"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("That email and password don't match an account.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen w-full bg-white font-sans">
      <div className="hidden w-[480px] flex-shrink-0 flex-col justify-between bg-[#181B3A] p-14 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent font-display text-[17px] font-extrabold text-white">
            A
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-white">AdDaptive</span>
            <span className="rounded-md bg-white/10 px-[7px] py-0.5 text-[10px] font-bold tracking-wide text-white/80">
              OS
            </span>
          </div>
        </div>

        <div className="max-w-[400px]">
          <h1 className="mb-4 font-display text-[34px] font-extrabold leading-tight text-white">
            Run every objective, key result, and task in one place.
          </h1>
          <p className="text-[15px] leading-relaxed text-white/70">
            Give every task an owner and a key result, track color-coded status against
            due dates, and let automatic reminders keep owners and managers on schedule.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[13px] text-white/50">
          <span>AdDaptive OS — internal operating software</span>
        </div>
      </div>

      <div className="flex flex-grow items-center justify-center p-10">
        <div className="flex w-[380px] flex-col gap-6">
          <div>
            <h2 className="font-display text-[27px] font-bold text-ink">Welcome back</h2>
            <p className="mt-1.5 text-[14.5px] text-ink-secondary">
              Sign in to your AdDaptive OS workspace.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-[13px] font-semibold text-[#344054]">
                  Password
                </label>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </div>

            {error && <p className="text-[13px] text-status-offTrackText">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-lg bg-accent px-0 py-3 text-[14.5px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="text-center text-[13.5px] text-ink-secondary">
            Don&rsquo;t have an account? Ask your admin to invite you from the Team page.
          </div>
        </div>
      </div>
    </div>
  );
}
