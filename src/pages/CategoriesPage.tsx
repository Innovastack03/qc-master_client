import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useItemStore } from "../store/itemStore";
import { useMasterStore } from "../store/masterStore";
import { notifyError, useToast } from "../store/toastStore";

type ListRow = { id: number; name: string; meta: string };

type EditableListProps = {
  title: string;
  rows: ListRow[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  addPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
};

function EditableList({ title, rows, selectedId, onSelect, onAdd, onRename, onDelete, addPlaceholder, emptyText, disabled }: EditableListProps) {
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await onAdd(name);
      setNewName("");
    } catch (e) {
      notifyError(e);
    }
  };
  const rename = async () => {
    const name = editName.trim();
    if (!name || editId == null) return;
    try {
      await onRename(editId, name);
      setEditId(null);
    } catch (e) {
      notifyError(e);
    }
  };
  const remove = async (row: ListRow) => {
    if (!confirm(`Delete "${row.name}"?`)) return;
    try {
      await onDelete(row.id);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <section className="card flex flex-col">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <ul className="flex-1 divide-y divide-slate-100">
        {rows.map((r) => (
          <li
            key={r.id}
            onClick={() => onSelect?.(r.id)}
            className={`flex items-center gap-3 rounded-md px-3 py-2 ${onSelect ? "cursor-pointer" : ""} ${
              selectedId === r.id ? "bg-indigo-50" : "hover:bg-slate-50"
            }`}
          >
            {editId === r.id ? (
              <>
                <input
                  className="input"
                  autoFocus
                  value={editName}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void rename();
                    if (e.key === "Escape") setEditId(null);
                  }}
                />
                <button className="btn-link" onClick={(e) => { e.stopPropagation(); void rename(); }}>Save</button>
                <button className="btn-link" onClick={(e) => { e.stopPropagation(); setEditId(null); }}>Cancel</button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className={`text-sm ${selectedId === r.id ? "font-semibold text-indigo-700" : "font-medium"}`}>{r.name}</div>
                  <div className="text-xs text-slate-500">{r.meta}</div>
                </div>
                <button className="btn-link" onClick={(e) => { e.stopPropagation(); setEditId(r.id); setEditName(r.name); }}>Rename</button>
                <button className="btn-link-danger" onClick={(e) => { e.stopPropagation(); void remove(r); }}>Delete</button>
              </>
            )}
          </li>
        ))}
        {!rows.length && <li className="py-6 text-center text-sm text-slate-400">{emptyText}</li>}
      </ul>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
        <input className="input" disabled={disabled} placeholder={addPlaceholder} value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn-primary whitespace-nowrap" type="submit" disabled={disabled || !newName.trim()}>+ Add</button>
      </form>
    </section>
  );
}

export function CategoriesPage() {
  const groups = useMasterStore((s) => s.groups);
  const categories = useMasterStore((s) => s.categories);
  const qcParameters = useMasterStore((s) => s.qcParameters);
  const create = useMasterStore((s) => s.create);
  const update = useMasterStore((s) => s.update);
  const remove = useMasterStore((s) => s.remove);
  const items = useItemStore((s) => s.items);
  const fetchItems = useItemStore((s) => s.fetchItems);
  const show = useToast((s) => s.show);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    fetchItems().catch(notifyError);
  }, [fetchItems]);

  const activeId = groups.some((g) => g.id === selected) ? selected : (groups[0]?.id ?? null);
  const active = groups.find((g) => g.id === activeId);

  const categoryRows: ListRow[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    meta: `${categories.filter((c) => c.group_id === g.id).length} sub-categories · ${items.filter((i) => i.group_id === g.id).length} materials`,
  }));

  const subRows: ListRow[] = categories
    .filter((c) => c.group_id === activeId)
    .map((c) => ({
      id: c.id,
      name: c.name,
      meta: `${items.filter((i) => i.category_id === c.id).length} materials · ${
        qcParameters.filter((p) => p.stage === "IQC" && p.category_id === c.id).length
      } IQC parameters`,
    }));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="page-title">Categories & Sub-categories</h1>
          <p className="text-sm text-slate-500">
            Category (e.g. Raw Material) → Sub-category (e.g. Paper) → Materials. IQC parameters are defined per sub-category.
          </p>
        </div>
        <Link to="/items/new" className="btn-primary">+ Add Material</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <EditableList
          title="Categories"
          rows={categoryRows}
          selectedId={activeId}
          onSelect={setSelected}
          addPlaceholder="New category, e.g. Packaging Material"
          emptyText="No categories yet"
          onAdd={async (name) => { await create("groups", { name }); show("Category added"); }}
          onRename={async (id, name) => { await update("groups", id, { name }); show("Renamed"); }}
          onDelete={async (id) => { await remove("groups", id); show("Category deleted"); }}
        />
        <EditableList
          title={active ? `Sub-categories of “${active.name}”` : "Sub-categories"}
          rows={subRows}
          disabled={!activeId}
          addPlaceholder={active ? `New sub-category under ${active.name}` : "Select a category first"}
          emptyText="No sub-categories yet — add one below"
          onAdd={async (name) => { await create("categories", { group_id: activeId, name }); show("Sub-category added"); }}
          onRename={async (id, name) => { await update("categories", id, { name }); show("Renamed"); }}
          onDelete={async (id) => { await remove("categories", id); show("Sub-category deleted"); }}
        />
      </div>
    </div>
  );
}