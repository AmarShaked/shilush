"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "היום", icon: "📖" },
  { href: "/calendar", label: "לוח שנה", icon: "🗓" },
  { href: "/streak", label: "רצף", icon: "🔥" },
  { href: "/settings", label: "הגדרות", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav">
      {ITEMS.map((it) => {
        const active =
          it.href === "/" ? pathname === "/" || pathname.startsWith("/reader") : pathname === it.href;
        return (
          <Link key={it.href} href={it.href} className={`nav-item${active ? " active" : ""}`}>
            <span className="nav-icon">{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
