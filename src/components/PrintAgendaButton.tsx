"use client";

/**
 * Triggers the browser's own print dialog. No print-specific CSS is added
 * elsewhere in the app (the sidebar/nav still prints along with the page) --
 * this is just a convenience shortcut for "I want a paper/PDF copy of what's
 * on screen," not a dedicated print layout. Worth a follow-up if a cleaner
 * print-only view is wanted later.
 */
export default function PrintAgendaButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-surface-panel"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      Print
    </button>
  );
}
