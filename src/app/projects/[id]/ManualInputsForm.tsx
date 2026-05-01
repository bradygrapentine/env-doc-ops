"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ManualInputs } from "@/lib/types";

type Props = {
  projectId: string;
  initial?: ManualInputs;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const FIELDS: {
  key: keyof ManualInputs;
  label: string;
  help: string;
  wired: boolean;
}[] = [
  {
    key: "growthRate",
    label: "Background growth rate",
    help: "Stored — wiring in a follow-up.",
    wired: false,
  },
  {
    key: "tripGenAssumptions",
    label: "Trip generation assumptions",
    help: "Used in report templates.",
    wired: true,
  },
  {
    key: "mitigationNotes",
    label: "Mitigation notes",
    help: "Stored — wiring in a follow-up.",
    wired: false,
  },
  {
    key: "engineerConclusions",
    label: "Engineer conclusions",
    help: "Used in report templates.",
    wired: true,
  },
];

export default function ManualInputsForm({ projectId, initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<ManualInputs>({
    growthRate: initial?.growthRate ?? "",
    tripGenAssumptions: initial?.tripGenAssumptions ?? "",
    mitigationNotes: initial?.mitigationNotes ?? "",
    engineerConclusions: initial?.engineerConclusions ?? "",
  });
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setState("saving");
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualInputs: values }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }
      setState("saved");
      router.refresh();
    } catch (e) {
      setState("error");
      setError((e as Error).message);
    }
  }

  return (
    <section className="bg-white border rounded p-6">
      <h2 className="font-medium mb-1">Manual inputs</h2>
      <p className="text-sm text-gray-500 mb-4">
        Optional engineer notes. Some flow into the next generated report.
      </p>
      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-medium mb-1" htmlFor={`mi-${f.key}`}>
              {f.label}
            </label>
            <textarea
              id={`mi-${f.key}`}
              rows={3}
              className="w-full border rounded px-2 py-1 text-sm"
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
            <p className="text-xs italic text-gray-500 mt-1">{f.help}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={state === "saving"}
          className="rounded bg-black text-white px-3 py-1 text-sm disabled:opacity-60"
        >
          {state === "saving" ? "Saving..." : "Save"}
        </button>
        {state === "saved" && <span className="text-sm text-green-600">Saved.</span>}
        {state === "error" && (
          <span className="text-sm text-red-600">{error ?? "Save failed."}</span>
        )}
      </div>
    </section>
  );
}
