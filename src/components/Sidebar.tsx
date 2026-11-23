import { NavLink } from "react-router-dom";
import {
  Boxes, ClipboardCheck, FolderTree, PackagePlus, Ruler, SlidersHorizontal, Truck, type LucideIcon,
} from "lucide-react";

type NavItem = { to: string; label: string; icon: LucideIcon };
type NavSection = { section: string; links: NavItem[] };

/** Add, remove or reorder menu items here */
const NAV: NavSection[] = [
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

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-300 bg-slate-50 py-3 print:hidden">
      <nav>
        {NAV.map((group) => (
          <div key={group.section} className="mb-4">
            <div className="mb-1 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.section}</div>
            {group.links.map(({ to, label, icon: Icon }) => (
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
      </nav>
    </aside>
  );
}