import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded border border-zinc-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400";

export const labelClass = "block text-xs font-medium text-zinc-600 mb-1";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 border-b border-zinc-100 pb-1">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function StringListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      {items.map((s, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={inputClass}
            value={s}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={placeholder}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-xs text-zinc-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="text-xs text-zinc-600 hover:text-zinc-900 underline"
      >
        + add
      </button>
    </div>
  );
}
