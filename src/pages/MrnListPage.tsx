import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MrnStatusBadge } from "../components/StatusBadge";
import { fmtDate, mrnStatus } from "../lib/qc";
import { useMrnStore } from "../store/mrnStore";
import { notifyError } from "../store/toastStore";

export function MrnListPage() {
  const list = useMrnStore((s) => s.list);
  const loading = useMrnStore((s) => s.loading);
  const fetchList = useMrnStore((s) => s.fetchList);
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    fetchList().catch(notifyError);
  }, [fetchList]);

  const t = q.trim().toLowerCase();
  const rows = list.filter(
    (m) =>
      (!status || mrnStatus(m) === status) &&
      (!from || m.mrn_date >= from) &&
      (!to || m.mrn_date <= to) &&
      (!t || [m.mrn_no, m.vendor_name, m.invoice_no, m.po_no, m.vehicle_no].some((v) => v?.toLowerCase().includes(t)))
  );

  return (
    <div className="space-y-3">
      <div className="toolbar">
        <h1 className="page-title mr-3">Material Receipt Notes</h1>
        <input className="input w-64" placeholder="Search MRN, vendor, invoice, PO…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option>Pending QC</option>
          <option>Partially Inspected</option>
          <option>QC Completed</option>
        </select>
        <input type="date" className="input w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-slate-500">to</span>
        <input type="date" className="input w-36" value={to} onChange={(e) => setTo(e.target.value)} />
        <Link to="/mrn/new" className="btn-primary ml-auto">+ New MRN</Link>
      </div>

      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>MRN No</th><th>MRN Date</th><th>Vendor</th><th>Invoice / Bill No</th><th>Invoice Date</th>
              <th>PO No</th><th className="text-center">Lines</th><th>QC Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="cursor-pointer" onDoubleClick={() => navigate(`/mrn/${m.id}`)} onClick={() => navigate(`/mrn/${m.id}`)}>
                <td className="font-mono text-xs font-semibold text-blue-700">{m.mrn_no}</td>
                <td>{fmtDate(m.mrn_date)}</td>
                <td>{m.vendor_name}</td>
                <td>{m.invoice_no}</td>
                <td>{m.invoice_date ? fmtDate(m.invoice_date) : "—"}</td>
                <td>{m.po_no ?? "—"}</td>
                <td className="text-center">{m.inspected_count}/{m.line_count}</td>
                <td><MrnStatusBadge status={mrnStatus(m)} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{loading ? "Loading…" : "No MRNs found"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}