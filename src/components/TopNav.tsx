import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  HardHat,
  BarChart3,
  FileText,
  BookOpen,
  DollarSign,
  Stethoscope,
  Wallet,
  Receipt,
  ArrowLeftRight,
  Truck,
  Package,
  ShoppingCart,
  Settings,
  Users,
  Database,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
type NavGroup = { label: string; icon: typeof LayoutDashboard; items: NavItem[] };

const primary: NavItem[] = [
  { title: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard },
  { title: "الحالات", url: "/cases", icon: ClipboardList },
  { title: "طلبات الأطباء", url: "/pending-cases", icon: ClipboardList },
];

const groups: NavGroup[] = [
  {
    label: "الإنتاج",
    icon: HardHat,
    items: [
      { title: "الفنيون", url: "/technicians", icon: HardHat },
      { title: "تقرير الإنتاج", url: "/technician-reports", icon: BarChart3 },
    ],
  },
  {
    label: "المالية",
    icon: DollarSign,
    items: [
      { title: "الأطباء", url: "/doctors", icon: Stethoscope },
      { title: "الأسعار", url: "/pricing", icon: DollarSign },
      { title: "الفواتير", url: "/invoices", icon: FileText },
      { title: "كشف الحساب", url: "/statements", icon: BookOpen },
      { title: "الخزن", url: "/cash-accounts", icon: Wallet },
      { title: "المصروفات", url: "/expenses", icon: Receipt },
      { title: "سندات قبض/صرف", url: "/vouchers", icon: ArrowLeftRight },
    ],
  },
  {
    label: "المخازن",
    icon: Package,
    items: [
      { title: "الموردون", url: "/suppliers", icon: Truck },
      { title: "المخزون", url: "/inventory", icon: Package },
      { title: "فواتير المشتريات", url: "/purchases", icon: ShoppingCart },
    ],
  },
  {
    label: "النظام",
    icon: Settings,
    items: [
      { title: "المستخدمون", url: "/users", icon: Users, adminOnly: true },
      { title: "النسخ الاحتياطي", url: "/backup", icon: Database, adminOnly: true },
      { title: "الإعدادات", url: "/settings", icon: Settings, adminOnly: true },
    ],
  },
];

export function TopNav() {
  const location = useLocation();
  const { hasRole } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (url: string) => location.pathname.startsWith(url);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
        {primary.map((item) => (
          <Link
            key={item.url}
            to={item.url}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              isActive(item.url)
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span className="hidden lg:inline">{item.title}</span>
          </Link>
        ))}

        {groups.map((group) => {
          const visible = group.items.filter((i) => !i.adminOnly || hasRole("admin"));
          if (visible.length === 0) return null;
          const groupActive = visible.some((i) => isActive(i.url));
          return (
            <DropdownMenu key={group.label}>
              <DropdownMenuTrigger
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  groupActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <group.icon className="h-4 w-4" />
                <span className="hidden lg:inline">{group.label}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {visible.map((item) => (
                  <DropdownMenuItem key={item.url} asChild>
                    <Link
                      to={item.url}
                      className={`flex items-center gap-2 ${
                        isActive(item.url) ? "bg-accent" : ""
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </nav>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
        aria-label="القائمة"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 z-30 border-b border-border/60 bg-card/95 backdrop-blur-xl shadow-lg max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-3 space-y-4">
            <div className="flex flex-col gap-1">
              {primary.map((item) => (
                <Link
                  key={item.url}
                  to={item.url}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive(item.url)
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              ))}
            </div>
            {groups.map((group) => {
              const visible = group.items.filter((i) => !i.adminOnly || hasRole("admin"));
              if (visible.length === 0) return null;
              return (
                <div key={group.label}>
                  <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {visible.map((item) => (
                      <Link
                        key={item.url}
                        to={item.url}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                          isActive(item.url)
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
