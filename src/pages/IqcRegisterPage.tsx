import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ResultBadge } from "../components/StatusBadge";
import { fmtDate } from "../lib/qc";
import { useIqcStore } from "../store/iqcStore";
import { useMrnStore } from "../store/mrnStore";
import { notifyError } from "../store/toastStore";
import { RESULT_LABEL, type IqcResult } from "../types";

export function IqcRegisterPage() {
  const list = useIqcStore((s) => s.list);
  const loading = useIqcStore((s) => s.loading);
  const fetchList = useIqcStore((s) => s.fetchList);
  const pending = useMrnStore((s) => s.pending);
  const fetchPending = useMrnStore((s) => s.fetchPending);
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [result, setResult] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    fetchList().catch(notifyError);
    fetchPending().catch(notifyError);
  }, [fetchList, fetchPending]);

  const t = q.trim().toLowerCase();
  const rows = list.filter(
    (r) =>
      (!result || r.result === result) &&
      (!from || r.inspection_date >= from) &&
      (!to || r.inspection_date <= to) &&
      (!t ||
        [r.inspection_no, r.mrn_no, r.item_name, r.sub_category_name, r.vendor_name, r.invoice_no, r.lot_no].some((v) =>
          v?.toLowerCase().includes(t)
        ))
  );

  return (
    <div className="space-y-3">
      <div className="toolbar">
        <h1 className="page-title">Incoming Quality Check</h1>
        <Link to="/iqc/new" className="btn-primary ml-auto">+ New Inspection</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="panel px-3 py-2">
          <div className="text-[11px] text-slate-500">Pending QC</div>
          <div className="text-xl font-semibold text-amber-600">{pending.length}</div>
        </div>
        {(Object.keys(RESULT_LABEL) as IqcResult[]).map((k) => (
          <button key={k} onClick={() => setResult(result === k ? "" : k)}
            className={`panel px-3 py-2 text-left hover:bg-slate-50 ${result === k ? "ring-2 ring-blue-500" : ""}`}>
            <div className="text-[11px] text-slate-500">{RESULT_LABEL[k]}</div>
            <div className="text-xl font-semibold">{list.filter((r) => r.result === k).length}</div>
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">Pending Inspection — MRN lines awaiting QC ({pending.length})</div>
        {pending.length ? (
          <div className="max-h-72 overflow-auto">
            <table className="data-table">
              <thead>
                <tr><th>MRN No</th><th>MRN Date</th><th>Vendor</th><th className="w-12 text-center">Line</th><th>Material</th><th>Lot / Batch</th><th className="text-right">Qty</th><th className="w-28" /></tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.mrn_no}</td>
                    <td>{fmtDate(p.mrn_date)}</td>
                    <td>{p.vendor_name}</td>
                    <td className="text-center">{p.line_no}</td>
                    <td>
                      <span className="font-medium">{p.material_name}</span>
                      {p.material_name !== p.sub_category_name && <span className="text-xs text-slate-500"> · {p.sub_category_name}</span>}
                    </td>
                    <td>{p.lot_no ?? "—"}</td>
                    <td className="text-right">{p.received_qty} {p.uom_code ?? ""}</td>
                    <td className="text-center"><Link to={`/iqc/new?line=${p.id}`} className="btn-primary btn-sm">Inspect →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-3 py-4 text-center text-slate-400">No MRN lines are waiting for inspection.</p>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">Inspection Register</div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-2">
          <input className="input w-72" placeholder="Search IQC no, MRN, material, vendor, lot…" value={q} onChange={(e) => setQ(e.target.value)} />
          <input type="date" className="input w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-slate-500">to</span>
          <input type="date" className="input w-36" value={to} onChange={(e) => setTo(e.target.value)} />
          {result && <button className="btn btn-sm" onClick={() => setResult("")}>Clear filter: {RESULT_LABEL[result as IqcResult]}</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Inspection No</th><th>Date</th><th>MRN No</th><th>Material</th><th>Vendor</th><th>Lot</th>
                <th className="text-right">Received</th><th className="text-right">Accepted</th><th className="text-right">Rejected</th>
                <th className="text-center">Fails</th><th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => navigate(`/iqc/${r.id}`)}>
                  <td className="font-mono text-xs font-semibold text-blue-700">{r.inspection_no}</td>
                  <td>{fmtDate(r.inspection_date)}</td>
                  <td className="font-mono text-xs">{r.mrn_no ?? "—"}</td>
                  <td>
                    <div className="font-medium">{r.item_name}</div>
                    <div className="text-[11px] text-slate-500">{r.category_name} › {r.sub_category_name}</div>
                  </td>
                  <td>{r.vendor_name ?? "—"}</td>
                  <td>{r.lot_no ?? "—"}</td>
                  <td className="text-right">{r.received_qty ?? "—"} <span className="text-[11px] text-slate-400">{r.uom_code ?? ""}</span></td>
                  <td className="text-right">{r.accepted_qty ?? "—"}</td>
                  <td className="text-right">{r.rejected_qty ?? "—"}</td>
                  <td className="text-center">{r.fail_count ? <span className="font-semibold text-red-600">{r.fail_count}</span> : "0"}</td>
                  <td><ResultBadge result={r.result} /></td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={11} className="py-8 text-center text-slate-400">{loading ? "Loading…" : "No inspections yet"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}