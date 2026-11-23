import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { COMPANY } from "../config";
import { fmtDate, formatSpec } from "../lib/qc";
import { useIqcStore } from "../store/iqcStore";
import { useMrnStore } from "../store/mrnStore";
import { notifyError, useToast } from "../store/toastStore";
import { RESULT_LABEL, type IqcDetail, type IqcResult } from "../types";

const DISPOSITION: Record<IqcResult, string> = {
  ACCEPTED: "Release to stores",
  ACCEPTED_WITH_DEVIATION: "Use with deviation approval",
  REJECTED: "Return to supplier",
  ON_HOLD: "Hold – awaiting decision",
};

export function IqcViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const remove = useIqcStore((s) => s.remove);
  const fetchPending = useMrnStore((s) => s.fetchPending);
  const show = useToast((s) => s.show);
  const [data, setData] = useState<IqcDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<IqcDetail>(`/iqc/${id}`).then((d) => !cancelled && setData(d)).catch(notifyError);
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!data) return <p className="text-slate-500">Loading report…</p>;

  const d = (v: string | null) => (v ? fmtDate(v) : null);
  const qty = (v: number | null) => (v == null ? null : `${v} ${data.uom_code ?? ""}`);
  const rows: [string, ReactNode, string, ReactNode][] = [
    ["Inspection No", data.inspection_no, "Inspection Date", d(data.inspection_date)],
    ["MRN No", data.mrn_no, "MRN Date", d(data.mrn_date)],
    ["Supplier", data.vendor_name, "Invoice No / Date", data.invoice_no ? `${data.invoice_no}${data.invoice_date ? ` / ${fmtDate(data.invoice_date)}` : ""}` : null],
    ["Category", data.category_name, "Material", data.sub_category_name],
    ["Grade / Item", data.grade_name ? `${data.grade_name}${data.item_code ? ` (${data.item_code})` : ""}` : null, "Lot / Batch No", data.lot_no],
    ["Received Qty", qty(data.received_qty), "Packages", data.packages],
    ["Sample Size", data.sample_size, "Inspected By", data.inspected_by],
  ];
  const pass = data.readings.filter((r) => r.status === "PASS").length;
  const fail = data.readings.filter((r) => r.status === "FAIL").length;
  const checked = data.readings.filter((r) => r.status !== "NA").length;
  const resultColor =
    data.result === "REJECTED" ? "text-red-700" : data.result === "ACCEPTED" ? "text-emerald-700" : "text-amber-700";

  const del = async () => {
    if (!confirm(`Delete inspection ${data.inspection_no}? The MRN line will go back to Pending.`)) return;
    try {
      await remove(data.id);
      fetchPending().catch(() => {});
      show("Inspection deleted");
      navigate("/iqc");
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <div className="space-y-3">
      <div className="toolbar print:hidden">
        <Link to="/iqc" className="btn btn-sm">← Register</Link>
        {data.mrn_id && <Link to={`/mrn/${data.mrn_id}`} className="btn btn-sm">Open {data.mrn_no}</Link>}
        <div className="ml-auto flex gap-2">
          <button className="btn-primary" onClick={() => window.print()}>Print</button>
          <button className="btn text-red-600" onClick={del}>Delete</button>
        </div>
      </div>

      <div className="doc">
        {/* heading */}
        <div className="flex items-end justify-between border-b-2 border-black pb-2">
          <div>
            <div className="text-base font-bold uppercase">{COMPANY.name}</div>
            <div className="text-[11px]">{COMPANY.address}</div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-bold">INCOMING QUALITY INSPECTION REPORT</div>
            <div className="text-[11px]">Format No: {COMPANY.iqcFormatNo}</div>
          </div>
        </div>

        {/* receipt details */}
        <table className="doc-table mt-3">
          <tbody>
            {rows.map(([l1, v1, l2, v2]) => (
              <tr key={l1}>
                <th className="w-[17%]">{l1}</th>
                <td className="w-[33%]">{v1 ?? "—"}</td>
                <th className="w-[17%]">{l2}</th>
                <td>{v2 ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* checks */}
        <table className="doc-table mt-3">
          <thead>
            <tr>
              <th className="w-10 text-center">S.No</th>
              <th>Parameter</th>
              <th>Specification</th>
              <th>Observed Value(s)</th>
              <th className="w-16 text-center">Result</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {data.readings.map((r, i) => (
              <tr key={r.id}>
                <td className="text-center">{i + 1}</td>
                <td>{r.parameter_name}</td>
                <td>{formatSpec(r)}</td>
                <td>{r.observed ?? (r.value_type === "PASS_FAIL" ? (r.status === "PASS" ? "OK" : r.status === "FAIL" ? "Not OK" : "—") : "—")}</td>
                <td className={`text-center font-bold ${r.status === "FAIL" ? "text-red-700" : r.status === "PASS" ? "text-emerald-700" : ""}`}>
                  {r.status === "NA" ? "—" : r.status}
                </td>
                <td>{r.remarks ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* summary */}
        <table className="doc-table mt-3">
          <tbody>
            <tr>
              <th className="w-[17%]">Parameters Checked</th>
              <td className="w-[16%]">{checked} / {data.readings.length}</td>
              <th className="w-[17%]">Passed / Failed</th>
              <td className="w-[16%]">{pass} / {fail}</td>
              <th className="w-[14%]">Overall Result</th>
              <td className={`font-bold uppercase ${resultColor}`}>{RESULT_LABEL[data.result]}</td>
            </tr>
            <tr>
              <th>Accepted Qty</th>
              <td>{qty(data.accepted_qty) ?? "—"}</td>
              <th>Rejected Qty</th>
              <td>{qty(data.rejected_qty) ?? "—"}</td>
              <th>Disposition</th>
              <td>{DISPOSITION[data.result]}</td>
            </tr>
            <tr>
              <th>Remarks</th>
              <td colSpan={5} className="h-12">{data.remarks ?? ""}</td>
            </tr>
          </tbody>
        </table>

        {/* signatures */}
        <div className="mt-14 grid grid-cols-3 gap-8 text-center text-[11px]">
          {["Inspected By", "Checked By", "Approved By (QC Head)"].map((label) => (
            <div key={label}>
              <div className="h-5">{label === "Inspected By" ? (data.inspected_by ?? "") : ""}</div>
              <div className="border-t border-black pt-1 font-semibold">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 text-right text-[10px] text-slate-500">Printed on {new Date().toLocaleString("en-IN")}</div>
      </div>
    </div>
  );
}