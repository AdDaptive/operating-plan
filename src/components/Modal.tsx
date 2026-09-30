"use client";

import { createPortal } from "react-dom";

/**
 * Renders via a portal into document.body rather than inline at this
 * component's own position in the tree. This matters beyond just
 * z-index/overflow hygiene: several callers (e.g. ObjectiveModal's edit
 * button, used inside ObjectiveCard's whole-card <Link> to the board
 * page) open this modal from a spot that sits inside a clickable
 * ancestor. Without a portal, every click inside the modal -- including
 * just clicking into the title field to edit it -- was still a click on
 * a DOM descendant of that ancestor <a>, and stopPropagation() alone
 * doesn't cancel the browser's native default action (navigation) the
 * way preventDefault() does, so the click silently navigated away and
 * the modal "disappeared" mid-edit. Portaling to document.body removes
 * the modal from that ancestor's DOM subtree entirely, so this can't
 * happen regardless of where a future caller triggers it from.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-card bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-[17px] font-bold text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-ink-tertiary hover:bg-surface-panel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
