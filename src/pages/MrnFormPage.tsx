import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { MrnStatusBadge, ResultBadge } from "../components/StatusBadge";
import { mrnStatus, todayISO } from "../lib/qc";
import { useItemStore } from "../store/itemStore";
import { useMasterStore } from "../store/masterStore";
import { useMrnStore } from "../store/mrnStore";
import { notifyError, useToast } from "../store/toastStore";
import type { MrnDetail, MrnLine, MrnPayload } from "../types";

type LineForm = {
  key: string;
  id: number | null;
  sub_category_id: string;
  item_id: string;
  uom_id: string;
  lot_no: string;
  packages: string;
  received_qty: string;
  remarks: string;
  inspection_id: number | null;
  inspection_no: string | null;
  inspection_result: MrnLine["inspection_result"];
};

type Header = {
  mrn_date: string; vendor_id: string; invoice_no: string; invoice_date: string;
  po_no: string; vehicle_no: string; received_by: string; remarks: string;
};

let keySeq = 0;
const newKey = () => `k${++keySeq}`;
const str = (v: string | number | null | undefined) => (v == null ? "" : String(v));
const txt = (v: string) => v.trim() || null;
const num = (v: string) => (v.trim() === "" ? null : Number(v));

const blankLine = (): LineForm => ({
  key: newKey(), id: null, sub_category_id: "", item_id: "", uom_id: "", lot_no: "", packages: "",
  received_qty: "", remarks: "", inspection_id: null, inspection_no: null, inspection_result: null,
});
const emptyHeader = (): Header => ({
  mrn_date: todayISO(), vendor_id: "", invoice_no: "", invoice_date: "", po_no: "", vehicle_no: "", received_by: "", remarks: "",
});

function toState(d: MrnDetail) {
  return {
    mrnNo: d.mrn_no,
    header: {
      mrn_date: d.mrn_date, vendor_id: str(d.vendor_id), invoice_no: d.invoice_no, invoice_date: str(d.invoice_date),
      po_no: str(d.po_no), vehicle_no: str(d.vehicle_no), received_by: str(d.received_by), remarks: str(d.remarks),
    } as Header,
    lines: d.lines.map(
      (l): LineForm => ({
        key: newKey(), id: l.id, sub_category_id: str(l.sub_category_id), item_id: str(l.item_id), uom_id: str(l.uom_id),
        lot_no: str(l.lot_no), packages: str(l.packages), received_qty: str(l.received_qty), remarks: str(l.remarks),
        inspection_id: l.inspection_id, inspection_no: l.inspection_no, inspection_result: l.inspection_result,
      })
    ),
  };
}

export function MrnFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const groups = useMasterStore((s) => s.groups);
  const categories = useMasterStore((s) => s.categories);
  const uoms = useMasterStore((s) => s.uoms);
  const vendors = useMasterStore((s) => s.vendors);
  const items = useItemStore((s) => s.items);
  const fetchItems = useItemStore((s) => s.fetchItems);
  const saveMrn = useMrnStore((s) => s.save);
  const removeMrn = useMrnStore((s) => s.remove);
  const show = useToast((s) => s.show);

  const [mrnNo, setMrnNo] = useState("");
  const [header, setHeader] = useState<Header>(emptyHeader);
  const [lines, setLines] = useState<LineForm[]>(() => [blankLine()]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems().catch(notifyError);
  }, [fetchItems]);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    api
      .get<MrnDetail>(`/mrn/${id}`)
      .then((d) => {
        if (cancelled) return;
        const st = toState(d);
        setMrnNo(st.mrnNo);
        setHeader(st.header);
        setLines(st.lines);
      })
      .catch(notifyError)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const setH = (key: keyof Header, value: string) => setHeader((h) => ({ ...h, [key]: value }));
  const patchLine = (key: string, patch: Partial<LineForm>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const onGrade = (key: string, v: string) => {
    const it = items.find((i) => String(i.id) === v);
    patchLine(key, { item_id: v, ...(it ? { uom_id: String(it.uom_id) } : {}) });
  };

  const inspectedCount = lines.filter((l) => l.inspection_id != null).length;
  const savedCount = lines.filter((l) => l.id != null).length;
  const materialGroups = groups
    .map((g) => ({ g, subs: categories.filter((c) => c.group_id === g.id) }))
    .filter((x) => x.subs.length);

  const save = async () => {
    if (!header.vendor_id) return show("Select the vendor / supplier", "error");
    if (!header.invoice_no.trim()) return show("Invoice / Bill No is required", "error");
    if (!lines.length) return show("Add at least one material line", "error");
    for (const [i, l] of lines.entries()) {
      if (!l.sub_category_id) return show(`Line ${i + 1}: select the material`, "error");
      if (!(Number(l.received_qty) > 0)) return show(`Line ${i + 1}: enter the received quantity`, "error");
    }

    const payload: MrnPayload = {
      mrn_date: header.mrn_date,
      vendor_id: Number(header.vendor_id),
      invoice_no: header.invoice_no.trim(),
      invoice_date: header.invoice_date || null,
      po_no: txt(header.po_no),
      vehicle_no: txt(header.vehicle_no),
      received_by: txt(header.received_by),
      remarks: txt(header.remarks),
      lines: lines.map((l) => ({
        id: l.id,
        sub_category_id: Number(l.sub_category_id),
        item_id: l.item_id ? Number(l.item_id) : null,
        uom_id: l.uom_id ? Number(l.uom_id) : null,
        lot_no: txt(l.lot_no),
        packages: num(l.packages),
        received_qty: Number(l.received_qty),
        remarks: txt(l.remarks),
      })),
    };

    setSaving(true);
    try {
      const saved = await saveMrn(payload, isNew ? undefined : Number(id));
      show(`${saved.mrn_no} saved`);
      if (isNew) {
        navigate(`/mrn/${saved.id}`, { replace: true });
      } else {
        const st = toState(saved);
        setMrnNo(st.mrnNo);
        setHeader(st.header);
        setLines(st.lines);
      }
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm(`Delete ${mrnNo}?`)) return;
    try {
      await removeMrn(Number(id));
      show("MRN deleted");
      navigate("/mrn");
    } catch (e) {
      notifyError(e);
    }
  };

  if (loading) return <p className="text-slate-500">Loading MRN…</p>;

  return (
    <div className="space-y-3">
      <div className="toolbar">
        <Link to="/mrn" className="btn btn-sm">← MRN List</Link>
        <div className="ml-2 leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Material Receipt Note</div>
          <div className="font-mono font-semibold">{isNew ? "New MRN" : mrnNo}</div>
        </div>
        {!isNew && savedCount > 0 && (
          <MrnStatusBadge status={mrnStatus({ line_count: savedCount, inspected_count: inspectedCount })} />
        )}
        <div className="ml-auto flex gap-2">
          {!isNew && inspectedCount === 0 && <button className="btn text-red-600" onClick={del}>Delete</button>}
          <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save MRN"}</button>
        </div>
      </div>

      {!vendors.length && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
          No vendors yet. <Link to="/vendors" className="btn-link">Add a vendor</Link> before creating an MRN.
        </div>
      )}

      <div className="panel">
        <div className="panel-head">Receipt Details</div>
        <div className="panel-body grid gap-3 md:grid-cols-4">
          <label><span className="label">MRN No</span><input className="input font-mono" readOnly value={isNew ? "Auto-generated" : mrnNo} /></label>
          <label><span className="label">MRN Date *</span><input type="date" className="input" value={header.mrn_date} onChange={(e) => setH("mrn_date", e.target.value)} /></label>
          <label className="md:col-span-2">
            <span className="label">Vendor / Supplier *</span>
            <select className="input" value={header.vendor_id} onChange={(e) => setH("vendor_id", e.target.value)}>
              <option value="">— Select vendor —</option>
              {vendors.filter((v) => v.active || String(v.id) === header.vendor_id).map((v) => (
                <option key={v.id} value={v.id}>{v.name} ({v.code})</option>
              ))}
            </select>
          </label>
          <label><span className="label">Invoice / Bill No *</span><input className="input" value={header.invoice_no} onChange={(e) => setH("invoice_no", e.target.value)} /></label>
          <label><span className="label">Invoice Date</span><input type="date" className="input" value={header.invoice_date} onChange={(e) => setH("invoice_date", e.target.value)} /></label>
          <label><span className="label">PO No</span><input className="input" value={header.po_no} onChange={(e) => setH("po_no", e.target.value)} /></label>
          <label><span className="label">Vehicle No</span><input className="input uppercase" value={header.vehicle_no} onChange={(e) => setH("vehicle_no", e.target.value)} /></label>
          <label><span className="label">Received By</span><input className="input" value={header.received_by} onChange={(e) => setH("received_by", e.target.value)} /></label>
          <label className="md:col-span-3"><span className="label">Remarks</span><input className="input" value={header.remarks} onChange={(e) => setH("remarks", e.target.value)} /></label>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Materials Received ({lines.length})</span>
          <button className="btn btn-sm normal-case tracking-normal" onClick={() => setLines((p) => [...p, blankLine()])}>+ Add Line</button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th className="min-w-48">Material *</th>
                <th className="min-w-44">Grade / Item</th>
                <th className="w-28">UOM</th>
                <th className="w-32">Lot / Batch</th>
                <th className="w-24">Packages</th>
                <th className="w-28">Received Qty *</th>
                <th className="min-w-36">Remarks</th>
                <th className="w-44">QC Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const locked = l.inspection_id != null;
                const grades = items.filter((it) => String(it.category_id) === l.sub_category_id);
                return (
                  <tr key={l.key}>
                    <td className="text-center text-slate-500">{i + 1}</td>
                    <td>
                      <select className="input" disabled={locked} value={l.sub_category_id}
                        onChange={(e) => patchLine(l.key, { sub_category_id: e.target.value, item_id: "" })}>
                        <option value="">— Select —</option>
                        {materialGroups.map(({ g, subs }) => (
                          <optgroup key={g.id} label={g.name}>
                            {subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select className="input" disabled={locked || !grades.length} value={l.item_id} onChange={(e) => onGrade(l.key, e.target.value)}>
                        <option value="">{grades.length ? "— None —" : "—"}</option>
                        {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="input" disabled={locked || !!l.item_id} value={l.uom_id} onChange={(e) => patchLine(l.key, { uom_id: e.target.value })}>
                        <option value="">—</option>
                        {uoms.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
                      </select>
                    </td>
                    <td><input className="input" disabled={locked} value={l.lot_no} onChange={(e) => patchLine(l.key, { lot_no: e.target.value })} /></td>
                    <td><input className="input text-right" type="number" min="0" step="any" disabled={locked} value={l.packages} onChange={(e) => patchLine(l.key, { packages: e.target.value })} /></td>
                    <td><input className="input text-right" type="number" min="0" step="any" disabled={locked} value={l.received_qty} onChange={(e) => patchLine(l.key, { received_qty: e.target.value })} /></td>
                    <td><input className="input" disabled={locked} value={l.remarks} onChange={(e) => patchLine(l.key, { remarks: e.target.value })} /></td>
                    <td>
                      {locked ? (
                        <Link to={`/iqc/${l.inspection_id}`} className="inline-flex items-center gap-1.5">
                          {l.inspection_result && <ResultBadge result={l.inspection_result} />}
                          <span className="font-mono text-[11px] text-blue-700">{l.inspection_no}</span>
                        </Link>
                      ) : l.id ? (
                        <Link to={`/iqc/new?line=${l.id}`} className="btn btn-sm">Inspect →</Link>
                      ) : (
                        <span className="text-xs text-slate-400">Save to inspect</span>
                      )}
                    </td>
                    <td className="text-center">
                      {!locked && (
                        <button className="btn-link-danger" title="Remove line" onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}>✕</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}