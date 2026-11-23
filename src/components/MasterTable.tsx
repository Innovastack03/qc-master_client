import { useState } from "react";
import { useMasterStore, type Resource } from "../store/masterStore";
import { notifyError, useToast } from "../store/toastStore";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "checkbox";
  options?: { value: number; label: string }[];
  required?: boolean;
  hideInTable?: boolean;
  placeholder?: string;
  /** shown but not editable (e.g. auto-generated codes) */
  readOnly?: boolean;
};

type Row = { id: number } & Record<string, unknown>;
type Values = Record<string, string | boolean>;

const blank = (fields: FieldDef[]): Values =>
  Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? true : ""]));

type Props = { title: string; resource: Resource; rows: Row[]; fields: FieldDef[] };

export function MasterTable({ title, resource, rows, fields }: Props) {
  const create = useMasterStore((s) => s.create);
  const update = useMasterStore((s) => s.update);
  const remove = useMasterStore((s) => s.remove);
  const show = useToast((s) => s.show);

  const [values, setValues] = useState<Values>(() => blank(fields));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const reset = () => {
    setValues(blank(fields));
    setEditingId(null);
  };

  const submit = async () => {
    const missing = fields.filter((f) => f.required && values[f.key] === "");
    if (missing.length) return show(`Required: ${missing.map((f) => f.label).join(", ")}`, "error");

    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.key];
      payload[f.key] =
        f.type === "checkbox"
          ? Boolean(v)
          : f.type === "number" || f.type === "select"
            ? v === "" ? null : Number(v)
            : String(v).trim();
    }
    try {
      if (editingId) await update(resource, editingId, payload);
      else await create(resource, payload);
      show(editingId ? "Updated" : "Added");
      reset();
    } catch (e) {
      notifyError(e);
    }
  };

  const startEdit = (row: Row) => {
    setEditingId(row.id);
    setValues(
      Object.fromEntries(
        fields.map((f) => [f.key, f.type === "checkbox" ? Boolean(row[f.key]) : row[f.key] == null ? "" : String(row[f.key])])
      )
    );
  };

  const onDelete = async (row: Row) => {
    if (!confirm("Delete this record?")) return;
    try {
      await remove(resource, row.id);
      show("Deleted");
    } catch (e) {
      notifyError(e);
    }
  };

  const display = (row: Row, f: FieldDef): string => {
    const v = row[f.key];
    if (f.type === "checkbox") return v ? "Yes" : "No";
    if (f.type === "select") return f.options?.find((o) => o.value === v)?.label ?? "";
    return v == null ? "" : String(v);
  };

  const term = search.trim().toLowerCase();
  const visible = term ? rows.filter((r) => fields.some((f) => display(r, f).toLowerCase().includes(term))) : rows;
  const cols = fields.filter((f) => !f.hideInTable);

  const input = (f: FieldDef) => {
    const v = values[f.key];
    const setV = (val: string | boolean) => setValues((p) => ({ ...p, [f.key]: val }));
    if (f.type === "checkbox") return <input type="checkbox" checked={Boolean(v)} onChange={(e) => setV(e.target.checked)} />;
    if (f.type === "select")
      return (
        <select className="input" value={String(v)} onChange={(e) => setV(e.target.value)}>
          <option value="">— Select —</option>
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    return (
      <input
        className="input"
        type={f.type === "number" ? "number" : "text"}
        step="any"
        placeholder={f.placeholder}
        value={String(v)}
        onChange={(e) => setV(e.target.value)}
      />
    );
  };

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <input className="input max-w-52" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3"
      >
        {fields.map((f) =>
          f.type === "checkbox" ? (
            <label key={f.key} className="flex items-center gap-2 pb-2 text-sm">
              {input(f)} {f.label}
            </label>
          ) : (
            <label key={f.key} className="flex min-w-36 flex-1 flex-col">
              <span className="label">
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </span>
              {input(f)}
            </label>
          )
        )}
        <button className="btn-primary" type="submit">{editingId ? "Update" : "Add"}</button>
        {editingId && <button type="button" className="btn" onClick={reset}>Cancel</button>}
      </form>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {cols.map((f) => <th key={f.key}>{f.label}</th>)}
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className={editingId === row.id ? "bg-indigo-50/50" : undefined}>
                {cols.map((f) => <td key={f.key}>{display(row, f)}</td>)}
                <td className="space-x-3 whitespace-nowrap text-right">
                  <button className="btn-link" onClick={() => startEdit(row)}>Edit</button>
                  <button className="btn-link-danger" onClick={() => onDelete(row)}>Delete</button>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr><td colSpan={cols.length + 1} className="py-6 text-center text-slate-400">No records</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}