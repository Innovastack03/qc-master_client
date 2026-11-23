import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useItemStore } from "../store/itemStore";
import { useMasterStore } from "../store/masterStore";
import { notifyError, useToast } from "../store/toastStore";
import { STAGES } from "../types";

export function ItemsPage() {
  const items = useItemStore((s) => s.items);
  const loading = useItemStore((s) => s.loading);
  const fetchItems = useItemStore((s) => s.fetchItems);
  const deleteItem = useItemStore((s) => s.deleteItem);
  const groups = useMasterStore((s) => s.groups);
  const categories = useMasterStore((s) => s.categories);
  const show = useToast((s) => s.show);
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [groupId, setGroupId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    fetchItems().catch(notifyError);
  }, [fetchItems]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!groupId || String(i.group_id) === groupId) &&
        (!categoryId || String(i.category_id) === categoryId) &&
        (!t || [i.code, i.name, i.description, i.hsn_code].some((v) => v?.toLowerCase().includes(t)))
    );
  }, [items, q, groupId, categoryId]);

  const onDelete = async (id: number, name: string) => {
    if (!confirm(`Delete item "${name}"?`)) return;
    try {
      await deleteItem(id);
      show("Item deleted");
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Item Master</h1>
        <Link to="/items/new" className="btn-primary">+ New Item</Link>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap gap-3">
          <input className="input max-w-xs" placeholder="Search code, name, HSN…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-48" value={groupId} onChange={(e) => { setGroupId(e.target.value); setCategoryId(""); }}>
            <option value="">All groups</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input w-48" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {categories
              .filter((c) => !groupId || String(c.group_id) === groupId)
              .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th><th>Item Name</th><th>Group</th><th>Category</th><th>UOM</th><th>Pack Units</th><th>HSN</th><th>QC Stages</th><th>Specs</th><th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/items/${i.id}`)}>
                  <td className="font-mono text-xs">{i.code}</td>
                  <td>
                    <div className="font-medium">{i.name}</div>
                    {i.description && <div className="max-w-xs truncate text-xs text-slate-500">{i.description}</div>}
                  </td>
                  <td>{i.group_name}</td>
                  <td>{i.category_name}</td>
                  <td>{i.uom_code}</td>
                  <td>{i.pack_units ?? "—"}</td>
                  <td>{i.hsn_code}</td>
                  <td className="space-x-1">
                    {STAGES.filter((st) => i[st.flag]).map((st) => <span key={st.key} className="badge">{st.short}</span>)}
                  </td>
                  <td>{i.spec_count ?? 0}</td>
                  <td className="text-right">
                    <button
                      className="btn-link-danger"
                      onClick={(e) => { e.stopPropagation(); void onDelete(i.id, i.name); }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={10} className="py-8 text-center text-slate-400">{loading ? "Loading…" : "No items found"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}