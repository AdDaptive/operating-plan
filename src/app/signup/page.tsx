"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, managerEmail: managerEmail || undefined }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong creating your account.");
      setLoading(false);
      return;
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.error) {
      router.push("/login");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface-sunk p-10 font-sans">
      <div className="w-full max-w-[420px] rounded-card border border-line bg-white p-9">
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

        <h2 className="font-display text-[24px] font-bold text-ink">Create your account</h2>
        <p className="mt-1.5 text-[14px] text-ink-secondary">
          Every person on your team gets their own account.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
              Full name
            </label>
            <input
              id="name"
              required
              placeholder="Jamie Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="you@addaptive.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="managerEmail" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">
              Manager&rsquo;s email <span className="font-normal text-ink-tertiary">(optional)</span>
            </label>
            <input
              id="managerEmail"
              type="email"
              placeholder="their-manager@addaptive.com"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              className="w-full rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
            />
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-tertiary">
              Used so reminders on your tasks also reach your manager. They need an
              account already — you can add this later from Settings.
            </p>
          </div>

          {error && <p className="text-[13px] text-status-offTrackText">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-accent px-0 py-3 text-[14.5px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="mt-5 text-center text-[13.5px] text-ink-secondary">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
