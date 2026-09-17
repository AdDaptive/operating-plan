export const inputClass =
  "w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-[#344054]">{label}</span>
      {children}
    </label>
  );
}
