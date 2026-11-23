import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useItemStore } from "../store/itemStore";
import { useMasterStore } from "../store/masterStore";
import { notifyError, useToast } from "../store/toastStore";
import { STAGES, type ItemDetail, type ItemPayload, type QcParameter, type Stage } from "../types";

type SpecRow = { parameter_id: number; min: string; max: string; target: string; mandatory: boolean };

type FormState = {
  code: string; name: string; description: string;
  group_id: string; category_id: string; uom_id: string;
  pack_units: string; hsn_code: string;
  qc_iqc: boolean; qc_inprocess: boolean; qc_aql: boolean; qc_pdi: boolean;
  aql_level: string; aql_critical: string; aql_major: string; aql_minor: string;
};

const EMPTY: FormState = {
  code: "", name: "", description: "", group_id: "", category_id: "", uom_id: "", pack_units: "", hsn_code: "",
  qc_iqc: true, qc_inprocess: false, qc_aql: false, qc_pdi: false,
  aql_level: "II", aql_critical: "", aql_major: "", aql_minor: "",
};

const INSPECTION_LEVELS = ["S-1", "S-2", "S-3", "S-4", "I", "II", "III"];
const AQL_VALUES = [0.065, 0.1, 0.15, 0.25, 0.4, 0.65, 1, 1.5, 2.5, 4, 6.5];
const STAGE_HINT: Record<Stage, string> = {
  IQC: "Checked on material receipt (GRN).",
  IN_PROCESS: "Checked during printing, lamination, book making and packing.",
  AQL: "Sampling plan used to accept or reject a lot.",
  PDI: "Final inspection before dispatch.",
};

const str = (v: number | null | undefined) => (v == null ? "" : String(v));
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
const toSpecRow = (p: QcParameter): SpecRow => ({
  parameter_id: p.id, min: str(p.default_min), max: str(p.default_max), target: "", mandatory: true,
});

function Field({ label, required, children, className = "" }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  );
}

export function ItemFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const groups = useMasterStore((s) => s.groups);
  const categories = useMasterStore((s) => s.categories);
  const uoms = useMasterStore((s) => s.uoms);
  const processes = useMasterStore((s) => s.processes);
  const qcParameters = useMasterStore((s) => s.qcParameters);
  const saveItem = useItemStore((s) => s.saveItem);
  const show = useToast((s) => s.show);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const paramMap = useMemo(() => new Map(qcParameters.map((p) => [p.id, p])), [qcParameters]);
  const processSeq = useMemo(() => new Map(processes.map((p) => [p.id, p.seq])), [processes]);
  const categoryId = form.category_id ? Number(form.category_id) : null;
  const groupCategories = categories.filter((c) => String(c.group_id) === form.group_id);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<ItemDetail>(`/items/${id}`)
      .then((it) => {
        if (cancelled) return;
        setForm({
          code: it.code, name: it.name, description: it.description ?? "",
          group_id: String(it.group_id), category_id: String(it.category_id), uom_id: String(it.uom_id),
          pack_units: str(it.pack_units), hsn_code: it.hsn_code ?? "",
          qc_iqc: !!it.qc_iqc, qc_inprocess: !!it.qc_inprocess, qc_aql: !!it.qc_aql, qc_pdi: !!it.qc_pdi,
          aql_level: it.aql_level ?? "II", aql_critical: str(it.aql_critical), aql_major: str(it.aql_major), aql_minor: str(it.aql_minor),
        });
        setSpecs(it.specs.map((s) => ({
          parameter_id: s.parameter_id, min: str(s.min_value), max: str(s.max_value),
          target: s.target_value ?? "", mandatory: !!s.mandatory,
        })));
      })
      .catch(notifyError)
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id, isNew]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  /** Parameters that can be used for this item at a given stage */
  const applicable = (stage: Stage) =>
    qcParameters.filter(
      (p) =>
        p.active &&
        p.stage === stage &&
        (stage === "IN_PROCESS" ||
          (stage === "IQC" ? p.category_id === categoryId : p.category_id == null || p.category_id === categoryId))
    );

  const addParams = (list: QcParameter[]) =>
    setSpecs((prev) => {
      const have = new Set(prev.map((s) => s.parameter_id));
      return [...prev, ...list.filter((p) => !have.has(p.id)).map(toSpecRow)];
    });
  const patchSpec = (pid: number, patch: Partial<SpecRow>) =>
    setSpecs((prev) => prev.map((s) => (s.parameter_id === pid ? { ...s, ...patch } : s)));
  const removeSpec = (pid: number) => setSpecs((prev) => prev.filter((s) => s.parameter_id !== pid));

  /** When category changes, swap the IQC template (e.g. Paper → Board parameters) */
  const swapIqcTemplate = (oldCat: number | null, newCat: number | null) =>
    setSpecs((prev) => {
      const kept = prev.filter((s) => {
        const p = paramMap.get(s.parameter_id);
        return !(p && p.stage === "IQC" && p.category_id === oldCat);
      });
      if (!form.qc_iqc || newCat == null) return kept;
      const have = new Set(kept.map((s) => s.parameter_id));
      const tpl = qcParameters.filter((p) => p.active && p.stage === "IQC" && p.category_id === newCat && !have.has(p.id));
      return [...kept, ...tpl.map(toSpecRow)];
    });

  const onGroupChange = (v: string) => {
    setForm((f) => ({ ...f, group_id: v, category_id: "" }));
    swapIqcTemplate(categoryId, null);
  };
  const onCategoryChange = (v: string) => {
    set("category_id", v);
    swapIqcTemplate(categoryId, v ? Number(v) : null);
  };

  const toggleStage = (stage: Stage, on: boolean) => {
    set(STAGES.find((s) => s.key === stage)!.flag, on);
    const hasAny = specs.some((s) => paramMap.get(s.parameter_id)?.stage === stage);
    if (on && !hasAny && stage !== "IN_PROCESS") addParams(applicable(stage));
  };

  const specsFor = (stage: Stage) =>
    specs
      .filter((s) => paramMap.get(s.parameter_id)?.stage === stage)
      .sort((a, b) => {
        const pa = paramMap.get(a.parameter_id)!.process_id;
        const pb = paramMap.get(b.parameter_id)!.process_id;
        return (processSeq.get(pa ?? 0) ?? 0) - (processSeq.get(pb ?? 0) ?? 0);
      });

  const save = async () => {
    const missing = [
      !form.name.trim() && "Item name",
      !form.group_id && "Group",
      !form.category_id && "Category",
      !form.uom_id && "UOM",
      !form.hsn_code.trim() && "HSN code",
    ].filter(Boolean);
    if (missing.length) return show(`Please fill: ${missing.join(", ")}`, "error");
    if (!/^(\d{4}|\d{6}|\d{8})$/.test(form.hsn_code.trim())) return show("HSN code must be 4, 6 or 8 digits", "error");

    const enabled = (st: Stage) => form[STAGES.find((s) => s.key === st)!.flag];
    const finalSpecs = specs.filter((s) => {
      const p = paramMap.get(s.parameter_id);
      return p && enabled(p.stage);
    });
    const bad = finalSpecs.find((s) => s.min !== "" && s.max !== "" && Number(s.min) > Number(s.max));
    if (bad) return show(`Min is greater than Max for "${paramMap.get(bad.parameter_id)?.name}"`, "error");

    const payload: ItemPayload = {
      code: form.code.trim() || null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      group_id: Number(form.group_id),
      category_id: Number(form.category_id),
      uom_id: Number(form.uom_id),
      pack_units: numOrNull(form.pack_units),
      hsn_code: form.hsn_code.trim(),
      qc_iqc: form.qc_iqc,
      qc_inprocess: form.qc_inprocess,
      qc_aql: form.qc_aql,
      qc_pdi: form.qc_pdi,
      aql_level: form.qc_aql ? form.aql_level || null : null,
      aql_critical: form.qc_aql ? numOrNull(form.aql_critical) : null,
      aql_major: form.qc_aql ? numOrNull(form.aql_major) : null,
      aql_minor: form.qc_aql ? numOrNull(form.aql_minor) : null,
      specs: finalSpecs.map((s) => ({
        parameter_id: s.parameter_id,
        min_value: numOrNull(s.min),
        max_value: numOrNull(s.max),
        target_value: s.target.trim() || null,
        mandatory: s.mandatory,
      })),
    };

    setSaving(true);
    try {
      const saved = await saveItem(payload, isNew ? undefined : Number(id));
      show("Item saved");
      if (isNew) navigate(`/items/${saved.id}`, { replace: true });
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500">Loading item…</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <Link to="/items" className="btn-link">← Items</Link>
          <h1 className="page-title">{isNew ? "New Item" : `Edit ${form.code}`}</h1>
        </div>
        <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Item"}</button>
      </div>

      <section className="card">
        <h2 className="mb-4 font-semibold">Item Details</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Item Code">
            <input className="input" placeholder="Auto-generated if blank" value={form.code} onChange={(e) => set("code", e.target.value)} />
          </Field>
          <Field label="Item Name" required className="md:col-span-2">
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Group" required>
            <select className="input" value={form.group_id} onChange={(e) => onGroupChange(e.target.value)}>
              <option value="">— Select —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Category" required>
            <select className="input" disabled={!form.group_id} value={form.category_id} onChange={(e) => onCategoryChange(e.target.value)}>
              <option value="">{form.group_id ? "— Select —" : "Select a group first"}</option>
              {groupCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="UOM" required>
            <select className="input" value={form.uom_id} onChange={(e) => set("uom_id", e.target.value)}>
              <option value="">— Select —</option>
              {uoms.map((u) => <option key={u.id} value={u.id}>{u.code} – {u.name}</option>)}
            </select>
          </Field>
          <Field label="Pack Units">
            <input className="input" type="number" step="any" min="0" placeholder="e.g. 500 (sheets per ream)" value={form.pack_units} onChange={(e) => set("pack_units", e.target.value)} />
          </Field>
          <Field label="HSN Code" required>
            <input className="input" inputMode="numeric" maxLength={8} placeholder="4, 6 or 8 digits" value={form.hsn_code}
              onChange={(e) => set("hsn_code", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Description" className="md:col-span-3">
            <textarea className="input h-20" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-4 font-semibold">QC Parameters Applicable</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {STAGES.map((st) => (
            <label key={st.key}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${form[st.flag] ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200"}`}>
              <input type="checkbox" className="mt-1" checked={form[st.flag]} onChange={(e) => toggleStage(st.key, e.target.checked)} />
              <span>
                <span className="block text-sm font-medium">{st.label}</span>
                <span className="text-xs text-slate-500">{STAGE_HINT[st.key]}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {STAGES.filter((st) => form[st.flag]).map((st) => (
        <SpecSection
          key={st.key}
          stage={st.key}
          title={st.label}
          rows={specsFor(st.key)}
          available={applicable(st.key)}
          paramMap={paramMap}
          onAdd={addParams}
          onPatch={patchSpec}
          onRemove={removeSpec}
          emptyHint={
            st.key === "IQC" && !categoryId
              ? "Select a category to load its IQC template."
              : st.key === "IN_PROCESS"
                ? "Add the processes this item goes through."
                : "No parameters added yet."
          }
        >
          {st.key === "AQL" && (
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-4">
              <Field label="Inspection Level">
                <select className="input" value={form.aql_level} onChange={(e) => set("aql_level", e.target.value)}>
                  {INSPECTION_LEVELS.map((l) => <option key={l} value={l}>{l.startsWith("S") ? `Special ${l}` : `General ${l}`}</option>)}
                </select>
              </Field>
              {(["aql_critical", "aql_major", "aql_minor"] as const).map((k) => (
                <Field key={k} label={`AQL – ${k.replace("aql_", "").replace(/^./, (c) => c.toUpperCase())}`}>
                  <select className="input" value={form[k]} onChange={(e) => set(k, e.target.value)}>
                    <option value="">Not applicable</option>
                    {AQL_VALUES.map((v) => <option key={v} value={String(v)}>{v}</option>)}
                  </select>
                </Field>
              ))}
            </div>
          )}
        </SpecSection>
      ))}

      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Item"}</button>
      </div>
    </div>
  );
}

type SpecSectionProps = {
  stage: Stage;
  title: string;
  rows: SpecRow[];
  available: QcParameter[];
  paramMap: Map<number, QcParameter>;
  onAdd: (list: QcParameter[]) => void;
  onPatch: (pid: number, patch: Partial<SpecRow>) => void;
  onRemove: (pid: number) => void;
  emptyHint: string;
  children?: ReactNode;
};

function SpecSection({ stage, title, rows, available, paramMap, onAdd, onPatch, onRemove, emptyHint, children }: SpecSectionProps) {
  const [pick, setPick] = useState("");
  const used = new Set(rows.map((r) => r.parameter_id));
  const unused = available.filter((p) => !used.has(p.id));

  let byProcess: Map<string, QcParameter[]> | null = null;
  if (stage === "IN_PROCESS") {
    byProcess = new Map();
    for (const p of unused) {
      const k = p.process_name ?? "—";
      byProcess.set(k, [...(byProcess.get(k) ?? []), p]);
    }
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-slate-500">{rows.length} parameter(s)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-64" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Add a parameter…</option>
            {unused.map((p) => (
              <option key={p.id} value={p.id}>{p.process_name ? `${p.process_name} › ${p.name}` : p.name}</option>
            ))}
          </select>
          <button type="button" className="btn" disabled={!pick}
            onClick={() => { const p = paramMap.get(Number(pick)); if (p) onAdd([p]); setPick(""); }}>
            Add
          </button>
          {!byProcess && (
            <button type="button" className="btn" disabled={!unused.length} onClick={() => onAdd(unused)}>
              Load template ({unused.length})
            </button>
          )}
        </div>
      </div>

      {byProcess && byProcess.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Add process:</span>
          {[...byProcess].map(([proc, list]) => (
            <button key={proc} type="button" className="btn text-xs" onClick={() => onAdd(list)}>
              + {proc} ({list.length})
            </button>
          ))}
        </div>
      )}

      {children}

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{emptyHint}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Parameter</th><th>Unit</th><th>Min</th><th>Max</th><th>Target / Acceptance</th><th className="text-center">Mandatory</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = paramMap.get(r.parameter_id);
                if (!p) return null;
                const numeric = p.value_type === "NUMERIC";
                return (
                  <tr key={r.parameter_id}>
                    <td>
                      <div className="font-medium">{p.name}{!p.active && <span className="ml-1 text-xs text-amber-600">(inactive)</span>}</div>
                      {p.process_name && <div className="text-xs text-slate-500">{p.process_name}</div>}
                    </td>
                    <td className="text-slate-500">{p.unit ?? (p.value_type === "PASS_FAIL" ? "Pass/Fail" : "Text")}</td>
                    <td>
                      {numeric ? (
                        <input className="input w-24" type="number" step="any" value={r.min}
                          onChange={(e) => onPatch(r.parameter_id, { min: e.target.value })} />
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td>
                      {numeric ? (
                        <input className="input w-24" type="number" step="any" value={r.max}
                          onChange={(e) => onPatch(r.parameter_id, { max: e.target.value })} />
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td>
                      <input className="input min-w-48" value={r.target}
                        placeholder={numeric ? "Nominal (optional)" : "e.g. Matches approved sample"}
                        onChange={(e) => onPatch(r.parameter_id, { target: e.target.value })} />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={r.mandatory} onChange={(e) => onPatch(r.parameter_id, { mandatory: e.target.checked })} />
                    </td>
                    <td className="text-right">
                      <button type="button" className="btn-link-danger" onClick={() => onRemove(r.parameter_id)}>Remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}