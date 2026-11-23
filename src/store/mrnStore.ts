import { create } from "zustand";
import { api } from "../api";
import type { MrnDetail, MrnPayload, MrnRecord, PendingLine } from "../types";

type MrnState = {
  list: MrnRecord[];
  pending: PendingLine[];
  loading: boolean;
  fetchList: () => Promise<void>;
  fetchPending: () => Promise<void>;
  save: (payload: MrnPayload, id?: number) => Promise<MrnDetail>;
  remove: (id: number) => Promise<void>;
};

export const useMrnStore = create<MrnState>((set, get) => ({
  list: [],
  pending: [],
  loading: false,
  fetchList: async () => {
    set({ loading: true });
    try {
      set({ list: await api.get<MrnRecord[]>("/mrn") });
    } finally {
      set({ loading: false });
    }
  },
  fetchPending: async () => {
    set({ pending: await api.get<PendingLine[]>("/mrn/pending-lines") });
  },
  save: async (payload, id) => {
    const saved = id
      ? await api.put<MrnDetail>(`/mrn/${id}`, payload)
      : await api.post<MrnDetail>("/mrn", payload);
    await Promise.all([get().fetchList(), get().fetchPending()]);
    return saved;
  },
  remove: async (id) => {
    await api.del(`/mrn/${id}`);
    set({ list: get().list.filter((m) => m.id !== id) });
    await get().fetchPending();
  },
}));