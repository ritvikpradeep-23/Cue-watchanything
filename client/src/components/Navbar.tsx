import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium tracking-wide transition-opacity ${
    isActive ? "opacity-100 underline underline-offset-4 decoration-2" : "opacity-70 hover:opacity-100"
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-opacity ${
    isActive ? "opacity-100 underline underline-offset-4 decoration-2" : "opacity-70 hover:opacity-100"
  }`;

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

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

  const isAdmin = user?.role === "ADMIN";

  const links = isAuthenticated
    ? [
        { to: "/swipe", label: "Swipe" },
        { to: "/watchlist", label: "Watchlist" },
        { to: "/history", label: "History" },
        { to: "/actors", label: "Actors" },
        { to: "/directors", label: "Directors" },
        { to: "/twins", label: "Twins" },
        { to: "/chat", label: "Chat" },
        { to: "/friends", label: "Friends" },
        { to: "/profile", label: "Profile" },
        ...(user?.role === "ADMIN" ? [{ to: "/admin/dashboard", label: "Admin" }] : []),
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
          <img src="/favicon.svg" alt="Cue" className="h-8 w-8 rounded-lg" />
          <span>Cue</span>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={navLinkClass}>
              {l.label}
            </NavLink>
          ))}

          <div className="ml-3 flex items-center gap-3 border-l border-current/15 pl-3">
            {isAdmin && (
              <Link
                to="/admin/add-title"
                aria-label="Add title"
                title="Add title"
                className="opacity-70 transition-opacity hover:opacity-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
              >
                <PlusIcon />
              </Link>
            )}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title="Toggle theme"
              className="opacity-70 transition-opacity hover:opacity-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
                className="opacity-70 transition-opacity hover:opacity-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
              >
                <LogoutIcon />
              </button>
            ) : (
              <>
                <NavLink to="/login" className={navLinkClass}>
                  Log in
                </NavLink>
                <Link
                  to="/signup"
                  className="surface-interactive bg-accent-500 px-4 py-1.5 text-xs font-medium text-[var(--on-accent)]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
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
        <nav className="flex flex-col gap-3 border-t border-[var(--border)]/10 bg-[var(--bg-elevated)] px-4 py-3 text-[var(--text)] md:hidden">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={mobileNavLinkClass} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}

          {isAdmin && (
            <Link
              to="/admin/add-title"
              className="flex items-center gap-2 text-sm font-medium opacity-70 hover:opacity-100"
              onClick={() => setOpen(false)}
            >
              <PlusIcon />
              Add title
            </Link>
          )}

          <button
            onClick={() => {
              toggleTheme();
              setOpen(false);
            }}
            className="flex items-center gap-2 text-left text-sm font-medium opacity-70 hover:opacity-100"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            {theme === "dark" ? "Switch to light" : "Switch to dark"}
          </button>

          {isAuthenticated ? (
            <button
              onClick={() => {
                handleLogout();
                setOpen(false);
              }}
              className="flex items-center gap-2 text-left text-sm font-medium opacity-70 hover:opacity-100"
            >
              <LogoutIcon />
              Log out
            </button>
          ) : (
            <>
              <NavLink to="/login" className={mobileNavLinkClass} onClick={() => setOpen(false)}>
                Log in
              </NavLink>
              <Link
                to="/signup"
                onClick={() => setOpen(false)}
                className="surface-interactive bg-accent-500 px-3 py-2 text-center text-sm font-medium text-[var(--on-accent)]"
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
