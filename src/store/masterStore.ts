import { create } from "zustand";
import { api } from "../api";
import type { Category, Group, Process, QcParameter, Stage, Uom, Vendor } from "../types";

export type Resource = "groups" | "categories" | "uoms" | "processes" | "vendors" | "qcParameters";

const ENDPOINT: Record<Resource, string> = {
  groups: "/groups",
  categories: "/categories",
  uoms: "/uoms",
  processes: "/processes",
  vendors: "/vendors",
  qcParameters: "/qc-parameters",
};

type MasterState = {
  groups: Group[];
  categories: Category[];
  uoms: Uom[];
  processes: Process[];
  vendors: Vendor[];
  qcParameters: QcParameter[];
  loaded: boolean;
  loadError: string | null;
  loadAll: () => Promise<void>;
  reload: (r: Resource) => Promise<void>;
  create: (r: Resource, data: Record<string, unknown>) => Promise<void>;
  update: (r: Resource, id: number, data: Record<string, unknown>) => Promise<void>;
  remove: (r: Resource, id: number) => Promise<void>;
  bulkAddParams: (p: {
    stage: Stage;
    category_id: number | null;
    process_id: number | null;
    lines: string;
  }) => Promise<{ created: number; skipped: number }>;
};

export const useMasterStore = create<MasterState>((set, get) => {
  // category / process names are shown on QC parameters, so refresh those too
  const afterChange = async (r: Resource) => {
    await get().reload(r);
    if (r === "categories" || r === "processes") await get().reload("qcParameters");
  };

  return {
    groups: [],
    categories: [],
    uoms: [],
    processes: [],
    vendors: [],
    qcParameters: [],
    loaded: false,
    loadError: null,

    reload: async (r) => {
      const data = await api.get<unknown[]>(ENDPOINT[r]);
      set({ [r]: data } as unknown as Partial<MasterState>);
    },
    loadAll: async () => {
      try {
        await Promise.all((Object.keys(ENDPOINT) as Resource[]).map((r) => get().reload(r)));
        set({ loaded: true, loadError: null });
      } catch (e) {
        set({ loadError: e instanceof Error ? e.message : String(e) });
      }
    },
    create: async (r, data) => {
      await api.post(ENDPOINT[r], data);
      await afterChange(r);
    },
    update: async (r, id, data) => {
      await api.put(`${ENDPOINT[r]}/${id}`, data);
      await afterChange(r);
    },
    remove: async (r, id) => {
      await api.del(`${ENDPOINT[r]}/${id}`);
      await afterChange(r);
    },
    bulkAddParams: async (p) => {
      const res = await api.post<{ created: number; skipped: number }>("/qc-parameters/bulk", p);
      await get().reload("qcParameters");
      return res;
    },
  };
});