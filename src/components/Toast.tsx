import { useToast } from "../store/toastStore";

export function Toast() {
  const message = useToast((s) => s.message);
  const kind = useToast((s) => s.kind);
  if (!message) return null;
  return (
    <div
      className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
        kind === "error" ? "bg-red-600" : "bg-emerald-600"
      }`}
    >
      {message}
    </div>
  );
}