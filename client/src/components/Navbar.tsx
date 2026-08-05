import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide transition-colors border-2 ${
    isActive
      ? "text-[var(--bg-elevated)] bg-[var(--ink)] border-[var(--ink)]"
      : "text-[var(--text)] border-transparent hover:border-[var(--ink)]"
  }`;

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = isAuthenticated
    ? [
        { to: "/swipe", label: "Swipe" },
        { to: "/watchlist", label: "Watchlist" },
        { to: "/history", label: "History" },
        { to: "/profile", label: "Profile" },
        ...(user?.role === "ADMIN" ? [{ to: "/admin/add-title", label: "Add title" }] : []),
      ]
    : [];

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-[var(--ink)] bg-[var(--bg-elevated)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5 text-lg font-black uppercase tracking-tight">
          <span className="pop-panel flex h-8 w-8 items-center justify-center bg-accent-500 text-sm font-black text-[var(--ink)]">
            ?
          </span>
          <span className="hidden sm:inline">What Should I Watch</span>
          <span className="sm:hidden">WSIW</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navLinkClass}>
              {l.label}
            </NavLink>
          ))}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="pop-pressable ml-2 bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-bold uppercase text-[var(--text)]"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="pop-pressable ml-1 bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-bold uppercase text-[var(--text)]"
            >
              Log out
            </button>
          ) : (
            <>
              <NavLink to="/login" className={navLinkClass}>
                Log in
              </NavLink>
              <Link
                to="/signup"
                className="pop-pressable ml-1 bg-accent-500 px-4 py-1.5 text-xs font-black uppercase text-[var(--ink)]"
              >
                Get started
              </Link>
            </>
          )}
        </nav>

        <button
          className="pop-pressable p-2 md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="block h-0.5 w-5 bg-[var(--text)]" />
          <span className="mt-1 block h-0.5 w-5 bg-[var(--text)]" />
          <span className="mt-1 block h-0.5 w-5 bg-[var(--text)]" />
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-2 border-t-[3px] border-[var(--ink)] px-4 py-3 md:hidden">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navLinkClass} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          <button
            onClick={() => {
              toggleTheme();
              setOpen(false);
            }}
            className="pop-pressable bg-[var(--bg-elevated)] px-3 py-2 text-left text-sm font-bold uppercase"
          >
            {theme === "dark" ? "Switch to light" : "Switch to dark"}
          </button>
          {isAuthenticated ? (
            <button
              onClick={() => {
                handleLogout();
                setOpen(false);
              }}
              className="pop-pressable bg-[var(--bg-elevated)] px-3 py-2 text-left text-sm font-bold uppercase"
            >
              Log out
            </button>
          ) : (
            <>
              <NavLink to="/login" className={navLinkClass} onClick={() => setOpen(false)}>
                Log in
              </NavLink>
              <Link
                to="/signup"
                onClick={() => setOpen(false)}
                className="pop-pressable bg-accent-500 px-3 py-2 text-center text-sm font-black uppercase text-[var(--ink)]"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
