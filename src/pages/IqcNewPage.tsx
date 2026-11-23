import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { ResultBadge, StatusBadge } from "../components/StatusBadge";
import { fmtDate, formatSpec, numericStatus, parseNumbers, todayISO } from "../lib/qc";
import { useIqcStore } from "../store/iqcStore";
import { useMrnStore } from "../store/mrnStore";
import { notifyError, useToast } from "../store/toastStore";
import { RESULT_LABEL, type Checklist, type IqcPayload, type IqcResult, type MrnDetail, type ReadingStatus } from "../types";

type Entry = { observed: string; status: ReadingStatus; remarks: string };

const emptyForm = () => ({ inspection_date: todayISO(), sample_size: "", accepted_qty: "", rejected_qty: "", inspected_by: "", remarks: "" });
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const txt = (s: string) => s.trim() || null;

/** read-only field that looks like a disabled input */
function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      <div className="flex h-8 items-center truncate rounded-sm border border-slate-200 bg-slate-50 px-2">{children ?? "—"}</div>
    </div>
  );
}

function PassFail({ value, onChange }: { value: ReadingStatus; onChange: (s: ReadingStatus) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-slate-300 text-xs font-semibold">
      {(["PASS", "FAIL"] as const).map((s) => (
        <button key={s} type="button" onClick={() => onChange(value === s ? "NA" : s)}
          className={`px-3 py-1.5 ${value === s ? (s === "PASS" ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "bg-white hover:bg-slate-50"}`}>
          {s === "PASS" ? "Pass" : "Fail"}
        </button>
      ))}
    </div>
  );
}

export function IqcNewPage() {
  const [searchParams] = useSearchParams();
  const lineParam = searchParams.get("line");
  const navigate = useNavigate();
  const pending = useMrnStore((s) => s.pending);
  const fetchPending = useMrnStore((s) => s.fetchPending);
  const createInspection = useIqcStore((s) => s.create);
  const show = useToast((s) => s.show);

  const [mrnInput, setMrnInput] = useState("");
  const [mrn, setMrn] = useState<MrnDetail | null>(null);
  const [lineId, setLineId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [entries, setEntries] = useState<Record<number, Entry>>({});
  const [resultOverride, setResultOverride] = useState<IqcResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPending().catch(notifyError);
  }, [fetchPending]);

  // opened from "Inspect →" (…/iqc/new?line=12)
  useEffect(() => {
    if (!lineParam) return;
    let cancelled = false;
    api
      .get<MrnDetail>(`/mrn/by-line/${lineParam}`)
      .then((d) => {
        if (cancelled) return;
        setMrn(d);
        setMrnInput(d.mrn_no);
        setLineId(Number(lineParam));
      })
      .catch(notifyError);
    return () => {
      cancelled = true;
    };
  }, [lineParam]);

  const line = mrn?.lines.find((l) => l.id === lineId) ?? null;

  // load the checklist for the selected line
  useEffect(() => {
    if (!line || line.inspection_id) {
      setChecklist(null);
      setEntries({});
      return;
    }
    let cancelled = false;
    setLoadingList(true);
    const qs = `subCategoryId=${line.sub_category_id}${line.item_id ? `&itemId=${line.item_id}` : ""}`;
    api
      .get<Checklist>(`/iqc/checklist?${qs}`)
      .then((cl) => {
        if (cancelled) return;
        setChecklist(cl);
        setEntries(Object.fromEntries(cl.parameters.map((p) => [p.parameter_id, { observed: "", status: "NA", remarks: "" }])));
        setResultOverride(null);
        setForm((f) => ({ ...f, accepted_qty: "", rejected_qty: "" }));
      })
      .catch(notifyError)
      .finally(() => !cancelled && setLoadingList(false));
    return () => {
      cancelled = true;
    };
  }, [line]);

  const pendingMrns = useMemo(() => {
    const m = new Map<string, { mrn_no: string; vendor_name: string; count: number }>();
    for (const p of pending) {
      const e = m.get(p.mrn_no);
      if (e) e.count++;
      else m.set(p.mrn_no, { mrn_no: p.mrn_no, vendor_name: p.vendor_name, count: 1 });
    }
    return [...m.values()];
  }, [pending]);

  const loadMrn = async (no: string) => {
    const v = no.trim();
    if (!v) return;
    try {
      const d = await api.get<MrnDetail>(`/mrn/lookup?no=${encodeURIComponent(v)}`);
      setMrn(d);
      setMrnInput(d.mrn_no);
      const first = d.lines.find((l) => !l.inspection_id);
      setLineId(first?.id ?? null);
      if (!first) show(`All lines of ${d.mrn_no} are already inspected`, "error");
    } catch (e) {
      setMrn(null);
      setLineId(null);
      notifyError(e);
    }
  };

  const setF = (key: keyof ReturnType<typeof emptyForm>, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const patchEntry = (pid: number, patch: Partial<Entry>) =>
    setEntries((prev) => ({ ...prev, [pid]: { ...prev[pid], ...patch } }));

  const params = checklist?.parameters ?? [];
  const statusOf = (pid: number): ReadingStatus | "INVALID" => {
    const p = params.find((x) => x.parameter_id === pid);
    const e = entries[pid];
    if (!p || !e) return "NA";
    return p.value_type === "NUMERIC" ? numericStatus(e.observed, p.min_value, p.max_value) : e.status;
  };
  const statuses = params.map((p) => statusOf(p.parameter_id));
  const passCount = statuses.filter((s) => s === "PASS").length;
  const failCount = statuses.filter((s) => s === "FAIL").length;
  const invalid = params.filter((_, i) => statuses[i] === "INVALID");
  const pendingParams = params.filter((p, i) => p.mandatory && statuses[i] === "NA");
  const suggested: IqcResult = failCount ? "REJECTED" : "ACCEPTED";
  const result = resultOverride ?? suggested;

  const save = async () => {
    if (!line) return show("Load an MRN and select a line to inspect", "error");
    if (!params.length) return show("This material has no IQC parameters defined", "error");
    if (invalid.length) return show(`Enter numbers only for: ${invalid.map((p) => p.name).join(", ")}`, "error");
    if (pendingParams.length) return show(`Not checked yet: ${pendingParams.map((p) => p.name).join(", ")}`, "error");
    if (failCount && result === "ACCEPTED") return show("Some parameters failed — choose Rejected, Accepted with Deviation or On Hold", "error");

    const payload: IqcPayload = {
      mrn_line_id: line.id,
      inspection_date: form.inspection_date,
      sample_size: num(form.sample_size),
      accepted_qty: num(form.accepted_qty),
      rejected_qty: num(form.rejected_qty),
      result,
      inspected_by: txt(form.inspected_by),
      remarks: txt(form.remarks),
      readings: params.map((p) => ({
        parameter_id: p.parameter_id,
        observed: txt(entries[p.parameter_id]?.observed ?? ""),
        status: statusOf(p.parameter_id) as ReadingStatus,
        remarks: txt(entries[p.parameter_id]?.remarks ?? ""),
      })),
    };

    setSaving(true);
    try {
      const saved = await createInspection(payload);
      show(`Saved ${saved.inspection_no}`);
      fetchPending().catch(() => {});
      navigate(`/iqc/${saved.id}`);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="toolbar">
        <Link to="/iqc" className="btn btn-sm">← Register</Link>
        <h1 className="page-title ml-2">New Incoming Inspection</h1>
        <div className="ml-auto">
          <button className="btn-primary" disabled={saving || !line || !params.length} onClick={save}>
            {saving ? "Saving…" : "Save Inspection"}
          </button>
        </div>
      </div>

      {/* 1 — MRN */}
      <div className="panel">
        <div className="panel-head">1 · Material Receipt Note</div>
        <div className="panel-body space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="w-64">
              <span className="label">MRN No</span>
              <input
                list="pending-mrns"
                className="input font-mono"
                placeholder="Type or pick MRN no."
                value={mrnInput}
                onChange={(e) => {
                  setMrnInput(e.target.value);
                  if (pendingMrns.some((p) => p.mrn_no === e.target.value)) void loadMrn(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadMrn(mrnInput);
                }}
              />
            </label>
            <datalist id="pending-mrns">
              {pendingMrns.map((p) => (
                <option key={p.mrn_no} value={p.mrn_no}>{`${p.vendor_name} · ${p.count} pending`}</option>
              ))}
            </datalist>
            <button className="btn" onClick={() => void loadMrn(mrnInput)}>Load</button>
            <span className="pb-2 text-xs text-slate-500">
              {pendingMrns.length ? `${pendingMrns.length} MRN(s) awaiting QC` : "No MRNs awaiting QC"}
            </span>
          </div>

          {mrn && (
            <>
              <div className="grid gap-3 md:grid-cols-6">
                <Field label="MRN Date">{fmtDate(mrn.mrn_date)}</Field>
                <Field label="Vendor / Supplier" className="md:col-span-2">{mrn.vendor_name}</Field>
                <Field label="Invoice / Bill No">{mrn.invoice_no}</Field>
                <Field label="Invoice Date">{mrn.invoice_date ? fmtDate(mrn.invoice_date) : null}</Field>
                <Field label="PO No">{mrn.po_no}</Field>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th className="w-10" /><th className="w-10">#</th><th>Material</th><th>Grade / Item</th><th>Lot / Batch</th><th className="text-right">Received Qty</th><th>QC Status</th></tr>
                  </thead>
                  <tbody>
                    {mrn.lines.map((l) => {
                      const done = l.inspection_id != null;
                      const selected = l.id === lineId;
                      return (
                        <tr key={l.id} onClick={() => !done && setLineId(l.id)}
                          className={`${done ? "text-slate-400" : "cursor-pointer"} ${selected ? "bg-blue-100" : ""}`}>
                          <td className="text-center">
                            <input type="radio" name="mrn-line" disabled={done} checked={selected} onChange={() => setLineId(l.id)} />
                          </td>
                          <td>{l.line_no}</td>
                          <td>
                            <div className="font-medium">{l.sub_category_name}</div>
                            <div className="text-[11px] text-slate-500">{l.category_name}</div>
                          </td>
                          <td>{l.item_name ?? "—"}</td>
                          <td>{l.lot_no ?? "—"}</td>
                          <td className="text-right">{l.received_qty} {l.uom_code ?? ""}</td>
                          <td>
                            {done ? (
                              <Link to={`/iqc/${l.inspection_id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5">
                                {l.inspection_result && <ResultBadge result={l.inspection_result} />}
                                <span className="font-mono text-[11px]">{l.inspection_no}</span>
                              </Link>
                            ) : (
                              <span className="text-[11px] font-semibold text-amber-600">Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {line && !line.inspection_id && (
        <>
          {/* 2 — auto-filled details */}
          <div className="panel">
            <div className="panel-head">2 · Inspection Details — Line {line.line_no}</div>
            <div className="panel-body grid gap-3 md:grid-cols-6">
              <Field label="Category">{line.category_name}</Field>
              <Field label="Material">{line.sub_category_name}</Field>
              <Field label="Grade / Item">{line.item_name ? `${line.item_name}${line.item_code ? ` (${line.item_code})` : ""}` : null}</Field>
              <Field label="Lot / Batch">{line.lot_no}</Field>
              <Field label="Received Qty">{`${line.received_qty} ${line.uom_code ?? ""}`}</Field>
              <Field label="Packages">{line.packages}</Field>
              <label>
                <span className="label">Inspection Date *</span>
                <input type="date" className="input" value={form.inspection_date} onChange={(e) => setF("inspection_date", e.target.value)} />
              </label>
              <label>
                <span className="label">Sample Size</span>
                <input type="number" min="0" step="any" className="input" value={form.sample_size} onChange={(e) => setF("sample_size", e.target.value)} />
              </label>
              <label className="md:col-span-2">
                <span className="label">Inspected By</span>
                <input className="input" value={form.inspected_by} onChange={(e) => setF("inspected_by", e.target.value)} />
              </label>
            </div>
          </div>

          {/* 3 — checks */}
          <div className="panel">
            <div className="panel-head">
              <span>3 · Quality Checks</span>
              {checklist && (
                <span className="normal-case tracking-normal">
                  {checklist.source === "item" ? "Grade specs" : `${line.sub_category_name} parameters`} ·{" "}
                  <span className="text-emerald-700">{passCount} pass</span> · <span className="text-red-600">{failCount} fail</span> ·{" "}
                  {params.length - passCount - failCount} pending
                </span>
              )}
            </div>
            {loadingList ? (
              <p className="p-3 text-slate-500">Loading checklist…</p>
            ) : !params.length ? (
              <p className="m-3 rounded-sm border border-amber-300 bg-amber-50 p-3 text-amber-800">
                No IQC parameters are defined for {line.sub_category_name}. <Link to="/qc-parameters" className="btn-link">Add them in QC Parameters</Link>.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr><th className="w-10 text-center">#</th><th>Parameter</th><th>Specification</th><th>Observed</th><th className="w-24">Status</th><th>Remarks</th></tr>
                  </thead>
                  <tbody>
                    {params.map((p, idx) => {
                      const e = entries[p.parameter_id] ?? { observed: "", status: "NA" as ReadingStatus, remarks: "" };
                      const st = statuses[idx];
                      const nums = p.value_type === "NUMERIC" ? parseNumbers(e.observed) : null;
                      return (
                        <tr key={p.parameter_id} className={st === "FAIL" ? "bg-red-50" : st === "INVALID" ? "bg-amber-50" : ""}>
                          <td className="text-center text-slate-500">{idx + 1}</td>
                          <td>
                            <div className="font-medium">{p.name}{p.mandatory ? <span className="text-red-500"> *</span> : null}</div>
                            {p.test_method && <div className="text-[11px] text-slate-500">{p.test_method}</div>}
                          </td>
                          <td className="whitespace-nowrap">{formatSpec(p)}</td>
                          <td>
                            {p.value_type === "NUMERIC" ? (
                              <div>
                                <input className="input w-56" placeholder="e.g. 70.2, 69.8, 70.5" value={e.observed}
                                  onChange={(ev) => patchEntry(p.parameter_id, { observed: ev.target.value })} />
                                {nums && nums.length > 1 && (
                                  <div className="mt-0.5 text-[11px] text-slate-500">
                                    n={nums.length} · min {Math.min(...nums)} · avg {+(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(3)} · max {Math.max(...nums)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {p.value_type === "TEXT" && (
                                  <input className="input w-48" placeholder="Observation" value={e.observed}
                                    onChange={(ev) => patchEntry(p.parameter_id, { observed: ev.target.value })} />
                                )}
                                <PassFail value={e.status} onChange={(s) => patchEntry(p.parameter_id, { status: s })} />
                              </div>
                            )}
                          </td>
                          <td><StatusBadge status={st} /></td>
                          <td>
                            <input className="input min-w-40" value={e.remarks} onChange={(ev) => patchEntry(p.parameter_id, { remarks: ev.target.value })} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4 — result */}
          <div className="panel">
            <div className="panel-head">4 · Result</div>
            <div className="panel-body grid gap-3 md:grid-cols-4">
              <label>
                <span className="label">Overall Result (suggested: {RESULT_LABEL[suggested]})</span>
                <select className="input" value={result} onChange={(e) => setResultOverride(e.target.value as IqcResult)}>
                  {(Object.keys(RESULT_LABEL) as IqcResult[]).map((k) => (
                    <option key={k} value={k} disabled={k === "ACCEPTED" && failCount > 0}>{RESULT_LABEL[k]}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Accepted Qty ({line.uom_code ?? "qty"})</span>
                <input type="number" min="0" step="any" className="input" placeholder="auto" value={form.accepted_qty} onChange={(e) => setF("accepted_qty", e.target.value)} />
              </label>
              <label>
                <span className="label">Rejected Qty ({line.uom_code ?? "qty"})</span>
                <input type="number" min="0" step="any" className="input" placeholder="auto" value={form.rejected_qty} onChange={(e) => setF("rejected_qty", e.target.value)} />
              </label>
              <div className="flex items-end">
                <button className="btn-primary w-full" disabled={saving || !params.length} onClick={save}>{saving ? "Saving…" : "Save Inspection"}</button>
              </div>
              <label className="md:col-span-4">
                <span className="label">Remarks</span>
                <textarea className="input h-16" value={form.remarks} onChange={(e) => setF("remarks", e.target.value)} />
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}