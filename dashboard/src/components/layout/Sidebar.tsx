import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  Table2,
  Database,
  Shield,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/states', label: 'State Analysis', icon: Map },
  { to: '/explorer', label: 'Work Explorer', icon: Table2 },
];

const systemItems = [
  { to: '/system', label: 'System / Dataset', icon: Database },
];

export function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-slate-900 text-slate-100 flex flex-col z-30 border-r border-slate-800">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-indigo-400" strokeWidth={2.5} />
          <span className="text-base font-bold tracking-widest text-white uppercase">
            Sentinel
          </span>
        </div>
        <p className="text-[10px] text-slate-500 tracking-wider uppercase font-medium pl-7">
          MPLADS Intelligence
        </p>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
              ${isActive
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </>
            )}
          </NavLink>
        ))}

        <div className="pt-4 pb-1">
          <span className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            System
          </span>
        </div>

        {systemItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
              ${isActive
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          Sentinel identifies risk signals for human review. It does not determine guilt or certify fraud.
        </p>
        <p className="text-[10px] text-slate-700 mt-1.5">
          SIH 2026 Prototype
        </p>
      </div>
    </aside>
  );
}
