import { create } from "zustand";
import { api } from "../api";
import type { ItemDetail, ItemPayload, ItemRecord } from "../types";

type ItemState = {
  items: ItemRecord[];
  loading: boolean;
  fetchItems: () => Promise<void>;
  saveItem: (payload: ItemPayload, id?: number) => Promise<ItemDetail>;
  deleteItem: (id: number) => Promise<void>;
};

export const useItemStore = create<ItemState>((set, get) => ({
  items: [],
  loading: false,
  fetchItems: async () => {
    set({ loading: true });
    try {
      set({ items: await api.get<ItemRecord[]>("/items") });
    } finally {
      set({ loading: false });
    }
  },
  saveItem: async (payload, id) => {
    const saved = id
      ? await api.put<ItemDetail>(`/items/${id}`, payload)
      : await api.post<ItemDetail>("/items", payload);
    await get().fetchItems();
    return saved;
  },
  deleteItem: async (id) => {
    await api.del(`/items/${id}`);
    set({ items: get().items.filter((i) => i.id !== id) });
  },
}));