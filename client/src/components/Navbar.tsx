import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-full text-sm font-bold tracking-wide transition-colors border-2 ${
    isActive
      ? "text-[var(--bg-elevated)] bg-[var(--ink)] border-[var(--ink)]"
      : "border-transparent hover:border-current"
  }`;

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // The dashboard/landing home page renders a full-bleed hero right under the navbar — let the
  // navbar sit transparent over it (Netflix/Disney+ Hotstar pattern) until the user scrolls
  // past it, then solidify. Every other route just gets the normal solid navbar.
  const isHome = location.pathname === "/";
  const transparent = isHome && !scrolled;

  useEffect(() => {
    if (!isHome) return;
    function onScroll() {
      setScrolled(window.scrollY > 48);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const links = isAuthenticated
    ? [
        { to: "/swipe", label: "Swipe" },
        { to: "/watchlist", label: "Watchlist" },
        { to: "/history", label: "History" },
        { to: "/profile", label: "Profile" },
        ...(user?.role === "ADMIN"
          ? [
              { to: "/admin/dashboard", label: "Admin" },
              { to: "/admin/add-title", label: "Add title" },
            ]
          : []),
      ]
    : [];

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header
      className={`sticky top-0 z-40 h-16 transition-colors duration-300 ${
        transparent
          ? "border-b border-transparent bg-transparent text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]"
          : "border-b border-[var(--border)]/10 bg-[var(--bg-elevated)] text-[var(--text)]"
      }`}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="surface flex h-8 w-8 items-center justify-center bg-accent-500 text-sm font-semibold text-[var(--on-accent)]">
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
            className="surface-interactive ml-2 bg-[var(--bg-elevated)]/80 px-3 py-1.5 text-xs font-bold text-[var(--text)] backdrop-blur-sm"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="surface-interactive ml-1 bg-[var(--bg-elevated)]/80 px-3 py-1.5 text-xs font-bold backdrop-blur-sm"
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
                className="surface-interactive ml-1 bg-accent-500 px-4 py-1.5 text-xs font-semibold text-[var(--on-accent)]"
              >
                Get started
              </Link>
            </>
          )}
        </nav>

        <button
          className="surface-interactive p-2 md:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
          <span className="mt-1 block h-0.5 w-5 bg-current" />
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-2 border-t border-[var(--border)]/10 bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text)] md:hidden">
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
            className="surface-interactive bg-[var(--bg-elevated)] px-3 py-2 text-left text-sm font-bold"
          >
            {theme === "dark" ? "Switch to light" : "Switch to dark"}
          </button>
          {isAuthenticated ? (
            <button
              onClick={() => {
                handleLogout();
                setOpen(false);
              }}
              className="surface-interactive bg-[var(--bg-elevated)] px-3 py-2 text-left text-sm font-bold"
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
                className="surface-interactive bg-accent-500 px-3 py-2 text-center text-sm font-semibold text-[var(--on-accent)]"
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
