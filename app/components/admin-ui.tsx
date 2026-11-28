import { NavLink } from "react-router";

const TABS = [
  ["/admin/review", "อนุมัติ 18+"],
  ["/admin/novels", "เรื่อง"],
  ["/admin/comments", "คอมเมนต์"],
  ["/admin/users", "ผู้ใช้"],
] as const;

export function AdminTabs() {
  return (
    <nav className="tabs" aria-label="เมนูแอดมิน">
      {TABS.map(([to, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => `tab ${isActive ? "tab-active" : ""}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
