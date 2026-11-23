import { useState } from "react";
import { useMasterStore } from "../store/masterStore";
import { notifyError, useToast } from "../store/toastStore";
import { STAGES, type QcParameter, type Stage, type ValueType } from "../types";

type ParamForm = {
  id?: number;
  name: string;
  value_type: ValueType;
  unit: string;
  default_min: string;
  default_max: string;
  test_method: string;
  scope: string;
  active: boolean;
};

const TYPE_LABEL: Record<ValueType, string> = {
  NUMERIC: "Numeric (min / max)",
  TEXT: "Text / Observation",
  PASS_FAIL: "Pass / Fail",
};

const STAGE_HINT: Record<Stage, string> = {
  IQC: "Incoming checks on raw material & consumables, grouped by category (Paper, Board, BOPP Film, Glue…).",
  IN_PROCESS: "Checks during production, grouped by process (Title Offset Printing, Lamination, Online Book Making, Packing).",
  AQL: "Defect classes / attributes for acceptance sampling. Leave category blank to apply to all items.",
  PDI: "Final checks before dispatch. Leave category blank to apply to all items.",
};

const s = (v: number | null) => (v == null ? "" : String(v));

export function QcParametersPage() {
  const params = useMasterStore((st) => st.qcParameters);
  const categories = useMasterStore((st) => st.categories);
  const processes = useMasterStore((st) => st.processes);
  const create = useMasterStore((st) => st.create);
  const update = useMasterStore((st) => st.update);
  const remove = useMasterStore((st) => st.remove);
  const bulkAddParams = useMasterStore((st) => st.bulkAddParams);
  const show = useToast((st) => st.show);

  const [stage, setStage] = useState<Stage>("IQC");
  const [scope, setScope] = useState("");
  const [form, setForm] = useState<ParamForm | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const isProcess = stage === "IN_PROCESS";
  const scopeLabel = isProcess ? "Process" : "Category";
  const scopeRequired = stage === "IQC" || isProcess;
  const scopeOptions = isProcess
    ? processes.map((p) => ({ id: p.id, name: p.name }))
    : categories.map((c) => ({ id: c.id, name: c.name }));
  const scopeOf = (p: QcParameter) => (isProcess ? p.process_id : p.category_id);
  const rows = params.filter((p) => p.stage === stage && (!scope || String(scopeOf(p)) === scope));

  const changeStage = (st: Stage) => {
    setStage(st);
    setScope("");
    setForm(null);
    setBulkOpen(false);
  };

  const blank = (): ParamForm => ({
    name: "", value_type: "NUMERIC", unit: "", default_min: "", default_max: "", test_method: "", scope, active: true,
  });
  const toForm = (p: QcParameter): ParamForm => ({
    id: p.id, name: p.name, value_type: p.value_type, unit: p.unit ?? "",
    default_min: s(p.default_min), default_max: s(p.default_max), test_method: p.test_method ?? "",
    scope: s(scopeOf(p)), active: !!p.active,
  });
  const patch = (x: Partial<ParamForm>) => setForm((f) => (f ? { ...f, ...x } : f));

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) return show("Parameter name is required", "error");
    if (scopeRequired && !form.scope) return show(`${scopeLabel} is required`, "error");
    const numeric = form.value_type === "NUMERIC";
    const scopeId = form.scope ? Number(form.scope) : null;
    const payload = {
      name: form.name.trim(),
      stage,
      value_type: form.value_type,
      unit: numeric ? form.unit.trim() || null : null,
      default_min: numeric && form.default_min !== "" ? Number(form.default_min) : null,
      default_max: numeric && form.default_max !== "" ? Number(form.default_max) : null,
      test_method: form.test_method.trim() || null,
      category_id: isProcess ? null : scopeId,
      process_id: isProcess ? scopeId : null,
      active: form.active,
    };
    try {
      if (form.id) await update("qcParameters", form.id, payload);
      else await create("qcParameters", payload);
      show(form.id ? "Parameter updated" : "Parameter added");
      // keep the form open for fast entry of the next parameter
      setForm(form.id ? null : { ...blank(), scope: form.scope, value_type: form.value_type });
    } catch (e) {
      notifyError(e);
    }
  };

  const onDelete = async (p: QcParameter) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await remove("qcParameters", p.id);
      show("Deleted");
    } catch (e) {
      notifyError(e);
    }
  };

  const toggleActive = async (p: QcParameter) => {
    try {
      await update("qcParameters", p.id, { active: !p.active });
    } catch (e) {
      notifyError(e);
    }
  };

  const runBulk = async () => {
    if (scopeRequired && !scope) return show(`Select a ${scopeLabel.toLowerCase()} in the filter first`, "error");
    try {
      const r = await bulkAddParams({
        stage,
        category_id: !isProcess && scope ? Number(scope) : null,
        process_id: isProcess && scope ? Number(scope) : null,
        lines: bulkText,
      });
      show(`Added ${r.created} parameter(s)${r.skipped ? `, skipped ${r.skipped} duplicate(s)` : ""}`);
      setBulkText("");
      setBulkOpen(false);
    } catch (e) {
      notifyError(e);
    }
  };

  const scopeName = scope ? scopeOptions.find((o) => String(o.id) === scope)?.name : null;

  return (
    <div className="space-y-5">
      <h1 className="page-title">QC Parameters</h1>

      <div className="flex flex-wrap gap-2">
        {STAGES.map((st) => (
          <button
            key={st.key}
            onClick={() => changeStage(st.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              stage === st.key ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {st.label} <span className="opacity-70">({params.filter((p) => p.stage === st.key).length})</span>
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-500">{STAGE_HINT[stage]}</p>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select className="input w-56" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">All {isProcess ? "processes" : "categories"}</option>
            {scopeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <div className="ml-auto flex gap-2">
            <button className="btn" onClick={() => { setBulkOpen((v) => !v); setForm(null); }}>Bulk Add</button>
            <button className="btn-primary" onClick={() => { setForm(blank()); setBulkOpen(false); }}>+ New Parameter</button>
          </div>
        </div>

        {bulkOpen && (
          <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
            <p className="text-sm">
              Adding to <b>{STAGES.find((x) => x.key === stage)!.short}</b>
              {scopeName ? <> › <b>{scopeName}</b></> : scopeRequired ? <span className="text-red-600"> — pick a {scopeLabel.toLowerCase()} in the filter above</span> : " (all items)"}
            </p>
            <p className="text-xs text-slate-500">
              One parameter per line: <code>Name | Unit | Min | Max | Test method</code>. Only the name is required.
              No unit and no limits = Pass/Fail. Unit <code>text</code> = text observation. Duplicates are skipped.
            </p>
            <textarea
              className="input h-40 font-mono"
              placeholder={"GSM | g/m² | 68 | 72 | ISO 536\nMoisture | % | 4 | 7\nShade Match"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="btn-primary" disabled={!bulkText.trim()} onClick={runBulk}>Add parameters</button>
              <button className="btn" onClick={() => setBulkOpen(false)}>Cancel</button>
            </div>
          </div>
        )}

        {form && (
          <form
            onSubmit={(e) => { e.preventDefault(); void save(); }}
            className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-4"
          >
            <label className="md:col-span-2">
              <span className="label">Parameter Name *</span>
              <input className="input" autoFocus value={form.name} onChange={(e) => patch({ name: e.target.value })} />
            </label>
            <label>
              <span className="label">{scopeLabel}{scopeRequired && " *"}</span>
              <select className="input" value={form.scope} onChange={(e) => patch({ scope: e.target.value })}>
                <option value="">{scopeRequired ? "— Select —" : "All items"}</option>
                {scopeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Value Type</span>
              <select className="input" value={form.value_type} onChange={(e) => patch({ value_type: e.target.value as ValueType })}>
                {(Object.keys(TYPE_LABEL) as ValueType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            {form.value_type === "NUMERIC" && (
              <>
                <label><span className="label">Unit</span><input className="input" placeholder="g/m², %, mm…" value={form.unit} onChange={(e) => patch({ unit: e.target.value })} /></label>
                <label><span className="label">Default Min</span><input className="input" type="number" step="any" value={form.default_min} onChange={(e) => patch({ default_min: e.target.value })} /></label>
                <label><span className="label">Default Max</span><input className="input" type="number" step="any" value={form.default_max} onChange={(e) => patch({ default_max: e.target.value })} /></label>
              </>
            )}
            <label className={form.value_type === "NUMERIC" ? "" : "md:col-span-3"}>
              <span className="label">Test Method</span>
              <input className="input" placeholder="e.g. ISO 536 / Visual" value={form.test_method} onChange={(e) => patch({ test_method: e.target.value })} />
            </label>
            <div className="flex items-center gap-4 md:col-span-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => patch({ active: e.target.checked })} /> Active
              </label>
              <div className="ml-auto flex gap-2">
                <button type="button" className="btn" onClick={() => setForm(null)}>Close</button>
                <button type="submit" className="btn-primary">{form.id ? "Update" : "Save & add next"}</button>
              </div>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Parameter</th><th>{scopeLabel}</th><th>Type</th><th>Unit</th><th>Default Range</th><th>Test Method</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                  <td className="font-medium">{p.name}</td>
                  <td>{(isProcess ? p.process_name : p.category_name) ?? <span className="text-slate-400">All</span>}</td>
                  <td>{TYPE_LABEL[p.value_type]}</td>
                  <td>{p.unit ?? "—"}</td>
                  <td>{p.default_min == null && p.default_max == null ? "—" : `${p.default_min ?? "…"} – ${p.default_max ?? "…"}`}</td>
                  <td>{p.test_method ?? "—"}</td>
                  <td>
                    <button className="btn-link" onClick={() => toggleActive(p)}>{p.active ? "Active" : "Inactive"}</button>
                  </td>
                  <td className="space-x-3 whitespace-nowrap text-right">
                    <button className="btn-link" onClick={() => { setForm(toForm(p)); setBulkOpen(false); }}>Edit</button>
                    <button className="btn-link-danger" onClick={() => onDelete(p)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={8} className="py-6 text-center text-slate-400">No parameters yet — use “New Parameter” or “Bulk Add”.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}