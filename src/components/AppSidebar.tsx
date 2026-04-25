import { Link, useLocation, useNavigate } from "@tanstack/react-router";
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
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "الرئيسية",
    items: [
      { title: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard },
      { title: "الحالات", url: "/cases", icon: ClipboardList },
      { title: "طلبات الأطباء", url: "/pending-cases", icon: ClipboardList },
      { title: "الفنيون", url: "/technicians", icon: HardHat },
      { title: "تقرير الإنتاج", url: "/technician-reports", icon: BarChart3 },
      { title: "التقارير والتحليلات", url: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "المالية",
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
    items: [
      { title: "الموردون", url: "/suppliers", icon: Truck },
      { title: "المخزون", url: "/inventory", icon: Package },
      { title: "فواتير المشتريات", url: "/purchases", icon: ShoppingCart },
    ],
  },
  {
    label: "النظام",
    items: [
      { title: "الإعدادات", url: "/settings", icon: Settings, adminOnly: true },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { signOut, hasRole, profile } = useAuth();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <Sidebar collapsible="icon" side="right" className="gradient-sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-primary text-primary-foreground font-display font-extrabold text-lg shadow-glow">
            H
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="truncate font-display font-bold text-sidebar-foreground tracking-tight">H.A.M.D</p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {profile?.full_name ?? "مستخدم"}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => {
          const visible = group.items.filter((i) => !i.adminOnly || hasRole("admin"));
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => {
                    const active = location.pathname.startsWith(item.url);
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
