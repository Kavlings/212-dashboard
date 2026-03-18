import { LayoutDashboard, Upload, List, TrendingUp } from "lucide-react";

export type View = "overview" | "transactions" | "cashflow";

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
  onImport: () => void;
}

const navItems: { view: View; label: string; icon: React.ElementType }[] = [
  { view: "overview", label: "Overview", icon: LayoutDashboard },
  { view: "transactions", label: "Transactions", icon: List },
  { view: "cashflow", label: "Cash Flow", icon: TrendingUp },
];

function Sidebar({ activeView, onNavigate, onImport }: SidebarProps) {
  return (
    <aside className="dash-sidebar">
      <div className="sidebar-brand">
        <span className="navbar-brand-dot" />
        212 Dashboard
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            className={`sidebar-nav-item${activeView === view ? " active" : ""}`}
            onClick={() => onNavigate(view)}
          >
            <Icon size={16} strokeWidth={2} />
            {label}
          </button>
        ))}
      </nav>

      <button className="sidebar-import-btn" onClick={onImport}>
        <Upload size={14} strokeWidth={2} />
        Import CSV
      </button>
    </aside>
  );
}

export default Sidebar;
