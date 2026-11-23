import { create } from "zustand";
import { api } from "../api";
import type { IqcDetail, IqcPayload, IqcRecord } from "../types";

type IqcState = {
  list: IqcRecord[];
  loading: boolean;
  fetchList: () => Promise<void>;
  create: (payload: IqcPayload) => Promise<IqcDetail>;
  remove: (id: number) => Promise<void>;
};

export const useIqcStore = create<IqcState>((set, get) => ({
  list: [],
  loading: false,
  fetchList: async () => {
    set({ loading: true });
    try {
      set({ list: await api.get<IqcRecord[]>("/iqc") });
    } finally {
      set({ loading: false });
    }
  },
  create: async (payload) => {
    const saved = await api.post<IqcDetail>("/iqc", payload);
    set({ list: [saved, ...get().list] });
    return saved;
  },
  remove: async (id) => {
    await api.del(`/iqc/${id}`);
    set({ list: get().list.filter((r) => r.id !== id) });
  },
}));