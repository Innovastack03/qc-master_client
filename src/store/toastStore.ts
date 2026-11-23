import { create } from "zustand";

type ToastState = {
  message: string | null;
  kind: "success" | "error";
  show: (message: string, kind?: "success" | "error") => void;
};

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  kind: "success",
  show: (message, kind = "success") => {
    clearTimeout(timer);
    set({ message, kind });
    timer = setTimeout(() => set({ message: null }), kind === "error" ? 5000 : 2500);
  },
}));

export const notifyError = (e: unknown) =>
  useToast.getState().show(e instanceof Error ? e.message : String(e), "error");