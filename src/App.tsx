import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Toast } from "./components/Toast";
import { APP_NAME } from "./config";
import { CategoriesPage } from "./pages/CategoriesPage";
import { IqcNewPage } from "./pages/IqcNewPage";
import { IqcRegisterPage } from "./pages/IqcRegisterPage";
import { IqcViewPage } from "./pages/IqcViewPage";
import { ItemFormPage } from "./pages/ItemFormPage";
import { ItemsPage } from "./pages/ItemsPage";
import { MastersPage } from "./pages/MastersPage";
import { MrnFormPage } from "./pages/MrnFormPage";
import { MrnListPage } from "./pages/MrnListPage";
import { QcParametersPage } from "./pages/QcParametersPage";
import { VendorsPage } from "./pages/VendorsPage";
import { useMasterStore } from "./store/masterStore";

export default function App() {
  const loadAll = useMasterStore((s) => s.loadAll);
  const loaded = useMasterStore((s) => s.loaded);
  const loadError = useMasterStore((s) => s.loadError);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="flex h-screen flex-col print:block print:h-auto">
      {/* title bar */}
      <header className="flex h-10 shrink-0 items-center justify-between bg-slate-800 px-4 text-white print:hidden">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-sky-400" />
          <span className="font-semibold">{APP_NAME}</span>
          <span className="text-xs text-slate-400">· Quality Control System</span>
        </div>
        <span className="text-xs text-slate-300">{today}</span>
      </header>

      <div className="flex min-h-0 flex-1 print:block">
        <Sidebar />

        <main className="min-w-0 flex-1 overflow-y-auto p-4 print:overflow-visible print:p-0">
          {loadError ? (
            <div className="card text-red-600">
              Cannot reach the server ({loadError}).
              <button className="btn ml-3" onClick={() => void loadAll()}>Retry</button>
            </div>
          ) : !loaded ? (
            <p className="text-slate-500">Loading… (the first load can take up to a minute while the server wakes up)</p>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/iqc" replace />} />
              <Route path="/mrn" element={<MrnListPage />} />
              <Route path="/mrn/:id" element={<MrnFormPage />} />
              <Route path="/iqc" element={<IqcRegisterPage />} />
              <Route path="/iqc/new" element={<IqcNewPage />} />
              <Route path="/iqc/:id" element={<IqcViewPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/items" element={<ItemsPage />} />
              <Route path="/items/:id" element={<ItemFormPage />} />
              <Route path="/qc-parameters" element={<QcParametersPage />} />
              <Route path="/masters" element={<MastersPage />} />
              <Route path="/vendors" element={<VendorsPage />} />
              <Route path="*" element={<Navigate to="/iqc" replace />} />
            </Routes>
          )}
        </main>
      </div>

      {/* status bar */}
      <footer className="flex h-6 shrink-0 items-center justify-between border-t border-slate-300 bg-slate-200 px-3 text-[11px] text-slate-600 print:hidden">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${loadError ? "bg-red-500" : "bg-emerald-500"}`} />
          {loadError ? "Disconnected" : "Connected"}
        </span>
        <span>{APP_NAME}</span>
      </footer>
      <Toast />
    </div>
  );
}