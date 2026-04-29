import { useSpecStore } from "@/lib/store/spec";

interface FlowPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  excludeId?: string;
}

export function FlowPicker({ selected, onChange, excludeId }: FlowPickerProps) {
  const flows = useSpecStore((s) => s.spec?.flows ?? []);
  const candidates = flows.filter((f) => f.id !== excludeId);
  const selectedSet = new Set(selected);

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  }

  if (candidates.length === 0) {
    return <div className="text-xs text-zinc-400 italic">(no other flows)</div>;
  }

  return (
    <div className="max-h-48 overflow-auto rounded border border-zinc-200 p-1 space-y-0.5">
      {candidates.map((f) => (
        <label
          key={f.id}
          className="flex items-center gap-2 px-1.5 py-1 text-xs rounded hover:bg-zinc-50 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selectedSet.has(f.id)}
            onChange={() => toggle(f.id)}
          />
          <span className="text-zinc-700 truncate">{f.name}</span>
          <span className="ml-auto text-[10px] text-zinc-400">{f.type}</span>
        </label>
      ))}
    </div>
  );
}

interface SingleFlowPickerProps {
  selected: string | null;
  onChange: (id: string | null) => void;
  excludeId?: string;
  allowNull?: boolean;
}

export function SingleFlowPicker({ selected, onChange, excludeId, allowNull }: SingleFlowPickerProps) {
  const flows = useSpecStore((s) => s.spec?.flows ?? []);
  const candidates = flows.filter((f) => f.id !== excludeId);

  return (
    <select
      value={selected ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs bg-white"
    >
      {allowNull && <option value="">(none)</option>}
      {candidates.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );
}
