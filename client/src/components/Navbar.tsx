import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? "text-accent-500 bg-[var(--bg-sunken)]"
      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-sunken)]"
  }`;

export function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = isAuthenticated
    ? [
        { to: "/swipe", label: "Swipe" },
        { to: "/watchlist", label: "Watchlist" },
        { to: "/history", label: "History" },
        { to: "/profile", label: "Profile" },
      ]
    : [];

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-elevated)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-accent-400 to-accent-700" />
          What Should I Watch
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
            className="ml-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="ml-1 rounded-lg bg-[var(--bg-sunken)] px-3 py-2 text-sm font-medium hover:opacity-80"
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
                className="ml-1 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-600"
              >
                Get started
              </Link>
            </>
          )}
        </nav>

        <button
          className="rounded-lg border border-[var(--border)] p-2 md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="block h-0.5 w-5 bg-[var(--text)]" />
          <span className="mt-1 block h-0.5 w-5 bg-[var(--text)]" />
          <span className="mt-1 block h-0.5 w-5 bg-[var(--text)]" />
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-[var(--border)] px-4 py-3 md:hidden">
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
            className="rounded-lg px-3 py-2 text-left text-sm text-[var(--text-muted)]"
          >
            {theme === "dark" ? "Switch to light" : "Switch to dark"}
          </button>
          {isAuthenticated ? (
            <button
              onClick={() => {
                handleLogout();
                setOpen(false);
              }}
              className="rounded-lg bg-[var(--bg-sunken)] px-3 py-2 text-left text-sm font-medium"
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
                className="rounded-lg bg-accent-500 px-3 py-2 text-center text-sm font-semibold text-white"
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
