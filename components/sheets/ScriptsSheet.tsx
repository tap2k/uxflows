import { useState } from "react";
import { useSpecStore } from "@/lib/store/spec";
import { genId } from "@/lib/ids";
import type { Flow, ScriptLine } from "@/lib/schema/v0";

interface ScriptsSheetProps {
  flow: Flow;
  onClose: () => void;
}

interface Row {
  id: string;
  textsByLang: Record<string, string>;
}

// Compute table rows from flow.scripts. Row identity is the script line id;
// cells with no entry in a given language render as empty strings.
function rowsFromFlow(flow: Flow, languages: string[]): Row[] {
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  for (const lang of languages) {
    for (const line of flow.scripts?.[lang] ?? []) {
      if (!seen.has(line.id)) {
        seen.add(line.id);
        orderedIds.push(line.id);
      }
    }
  }
  return orderedIds.map((id) => {
    const textsByLang: Record<string, string> = {};
    for (const lang of languages) {
      const line = flow.scripts?.[lang]?.find((l) => l.id === id);
      textsByLang[lang] = line?.text ?? "";
    }
    return { id, textsByLang };
  });
}

function rowsToScripts(rows: Row[], languages: string[]): Record<string, ScriptLine[]> {
  const out: Record<string, ScriptLine[]> = {};
  for (const lang of languages) {
    out[lang] = rows
      .filter((r) => r.textsByLang[lang] !== undefined && r.textsByLang[lang] !== "")
      .map((r) => ({ id: r.id, text: r.textsByLang[lang] }));
  }
  return out;
}

export function ScriptsSheet({ flow, onClose }: ScriptsSheetProps) {
  const agentLanguages = useSpecStore((s) => s.spec?.agent.meta.languages) ?? [];
  const updateFlow = useSpecStore((s) => s.updateFlow);
  const updateAgent = useSpecStore((s) => s.updateAgent);
  const agent = useSpecStore((s) => s.spec?.agent);
  const [newLang, setNewLang] = useState("");

  if (!agent) return null;
  const languages = agentLanguages.length > 0 ? agentLanguages : ["EN"];
  const rows = rowsFromFlow(flow, languages);

  function commit(nextRows: Row[]) {
    const scripts = rowsToScripts(nextRows, languages);
    const hasAny = Object.values(scripts).some((arr) => arr.length > 0);
    updateFlow(flow.id, { scripts: hasAny ? scripts : undefined });
  }

  function addRow() {
    const id = genId("s");
    const empty: Record<string, string> = {};
    for (const lang of languages) empty[lang] = "";
    commit([...rows, { id, textsByLang: empty }]);
  }

  function removeRow(rowId: string) {
    commit(rows.filter((r) => r.id !== rowId));
  }

  function editCell(rowId: string, lang: string, text: string) {
    commit(
      rows.map((r) =>
        r.id === rowId ? { ...r, textsByLang: { ...r.textsByLang, [lang]: text } } : r
      )
    );
  }

  function addLanguage() {
    const code = newLang.trim();
    if (!code || agentLanguages.includes(code)) return;
    updateAgent({
      meta: { ...agent!.meta, languages: [...agentLanguages, code] },
    });
    setNewLang("");
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-5xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between border-b border-zinc-200 px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Scripts</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{flow.name}</p>
          </div>
          <button onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-900">
            close
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="w-8"></th>
                {languages.map((lang) => (
                  <th
                    key={lang}
                    className="text-left font-medium text-zinc-600 border-b border-zinc-200 px-2 py-1.5"
                  >
                    {lang}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={languages.length + 1} className="text-center text-zinc-400 italic py-6">
                    No script lines. Click &ldquo;+ Add row&rdquo; below.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="py-1.5 pr-2">
                    <button
                      onClick={() => removeRow(row.id)}
                      className="text-zinc-400 hover:text-red-600"
                      title="remove row"
                    >
                      ×
                    </button>
                  </td>
                  {languages.map((lang) => (
                    <td key={lang} className="px-1.5 py-1.5">
                      <textarea
                        className="w-full rounded border border-zinc-200 px-2 py-1 text-xs font-sans resize-y min-h-[42px] focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        value={row.textsByLang[lang] ?? ""}
                        onChange={(e) => editCell(row.id, lang, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-zinc-200 px-5 py-3 flex items-center gap-3">
          <button
            onClick={addRow}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            + Add row
          </button>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="text"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLanguage()}
              placeholder="lang code (e.g. EN)"
              className="rounded border border-zinc-300 px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
            <button
              onClick={addLanguage}
              disabled={!newLang.trim() || agentLanguages.includes(newLang.trim())}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              + Add language
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
