import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  Boxes, ClipboardCheck, FolderTree, PackagePlus, Ruler, ShieldCheck, SlidersHorizontal, Truck, type LucideIcon,
} from "lucide-react";
import { Toast } from "./components/Toast";
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

const NAV: { section: string; links: { to: string; label: string; icon: LucideIcon }[] }[] = [
  { section: "Inward", links: [{ to: "/mrn", label: "Material Receipt (MRN)", icon: PackagePlus }] },
  { section: "Quality", links: [{ to: "/iqc", label: "Incoming Quality Check", icon: ClipboardCheck }] },
  {
    section: "Admin",
    links: [
      { to: "/categories", label: "Categories", icon: FolderTree },
      { to: "/items", label: "Material Grades", icon: Boxes },
      { to: "/qc-parameters", label: "QC Parameters", icon: SlidersHorizontal },
      { to: "/masters", label: "UOM & Processes", icon: Ruler },
      { to: "/vendors", label: "Vendors", icon: Truck },
    ],
  },
];

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
          <span className="font-semibold">QC Master</span>
          <span className="text-xs text-slate-400">· Quality Control System</span>
        </div>
        <span className="text-xs text-slate-300">{today}</span>
      </header>

      <div className="flex min-h-0 flex-1 print:block">
        {/* sidebar */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-300 bg-slate-50 py-3 print:hidden">
          {NAV.map((g) => (
            <div key={g.section} className="mb-4">
              <div className="mb-1 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g.section}</div>
              {g.links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 border-l-[3px] px-4 py-1.5 text-[13px] ${
                      isActive
                        ? "border-blue-600 bg-white font-semibold text-blue-700"
                        : "border-transparent text-slate-700 hover:bg-white"
                    }`
                  }
                >
                  <Icon size={16} strokeWidth={1.8} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </aside>

        {/* workspace */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4 print:overflow-visible print:p-0">
          {loadError ? (
            <div className="card text-red-600">
              Cannot reach the server ({loadError}). Is it running on port 4000?
              <button className="btn ml-3" onClick={() => void loadAll()}>Retry</button>
            </div>
          ) : !loaded ? (
            <p className="text-slate-500">Loading…</p>
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
        <span>QC Master v1.0</span>
      </footer>
      <Toast />
    </div>
  );
}