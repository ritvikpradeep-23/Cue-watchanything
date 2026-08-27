import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const adminLinks = [
  { to: "/admin/dashboard", label: "Admin" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/reports", label: "Reports" },
];

const sidebarLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[var(--ink)] text-[var(--bg-elevated)]"
      : "text-[var(--text-muted)] hover:bg-[var(--border)]/8 hover:text-[var(--text)]"
  }`;

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
      <aside className="w-44 shrink-0">
        <p className="mb-2 px-3 text-xs font-normal uppercase tracking-wide text-[var(--text-muted)]">
          Admin
        </p>
        <nav className="flex flex-col gap-1">
          {adminLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={sidebarLinkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
