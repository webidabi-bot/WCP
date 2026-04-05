import React from "react";
import { NavLink, Outlet } from "react-router-dom";

const navLinks = [
  { to: "/", label: "Dashboard", exact: true },
  { to: "/agents", label: "Agents" },
  { to: "/tools", label: "Tools" },
  { to: "/records", label: "Records" },
  { to: "/inference", label: "Inference" },
  { to: "/voice", label: "Voice" },
];

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
  },
  sidebar: {
    width: 220,
    background: "#1e293b",
    display: "flex",
    flexDirection: "column",
    padding: "24px 0",
    flexShrink: 0,
  },
  brand: {
    padding: "0 20px 24px",
    borderBottom: "1px solid #334155",
    marginBottom: 16,
  },
  brandName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#38bdf8",
    letterSpacing: "0.05em",
    margin: 0,
  },
  brandSub: {
    fontSize: 11,
    color: "#94a3b8",
    margin: "4px 0 0",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  nav: {
    flex: 1,
    padding: "0 8px",
  },
  navLink: {
    display: "block",
    padding: "8px 12px",
    borderRadius: 6,
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 2,
    transition: "background 0.15s, color 0.15s",
  },
  navLinkActive: {
    background: "#0f172a",
    color: "#f1f5f9",
  },
  main: {
    flex: 1,
    overflow: "auto",
    padding: 32,
    background: "#0f172a",
  },
};

export const Layout: React.FC = () => (
  <div style={styles.shell}>
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <p style={styles.brandName}>AI-Stack</p>
        <p style={styles.brandSub}>AIOS Operator Portal</p>
      </div>
      <nav style={styles.nav}>
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.exact}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
    <main style={styles.main}>
      <Outlet />
    </main>
  </div>
);
