import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  Stethoscope,
  DollarSign,
  FileText,
  BookOpen,
  Workflow,
  Shield,
  Settings,
  LogOut,
  HardHat,
  BarChart3,
  Package,
  Truck,
  ShoppingCart,
  Wallet,
  Receipt,
  ArrowLeftRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; adminOnly?: boolean };
const items: NavItem[] = [
  { title: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard },
  { title: "الحالات", url: "/cases", icon: ClipboardList },
  { title: "طلبات الأطباء", url: "/pending-cases", icon: ClipboardList },
  { title: "الأطباء", url: "/doctors", icon: Stethoscope },
  { title: "الفنيون", url: "/technicians", icon: HardHat },
  { title: "تقرير الإنتاج", url: "/technician-reports", icon: BarChart3 },
  { title: "الأسعار", url: "/pricing", icon: DollarSign },
  { title: "الفواتير", url: "/invoices", icon: FileText },
  { title: "كشف الحساب", url: "/statements", icon: BookOpen },
  { title: "الموردون", url: "/suppliers", icon: Truck },
  { title: "المخزون", url: "/inventory", icon: Package },
  { title: "فواتير المشتريات", url: "/purchases", icon: ShoppingCart },
  { title: "الخزن", url: "/cash-accounts", icon: Wallet },
  { title: "المصروفات", url: "/expenses", icon: Receipt },
  { title: "سندات قبض/صرف", url: "/vouchers", icon: ArrowLeftRight },
  { title: "سير العمل", url: "/workflows", icon: Workflow, adminOnly: true },
  { title: "المستخدمون والأدوار", url: "/users", icon: Shield, adminOnly: true },
  { title: "الإعدادات", url: "/settings", icon: Settings, adminOnly: true },
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
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            H
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="truncate font-semibold text-sidebar-foreground">H.A.M.D</p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {profile?.full_name ?? "مستخدم"}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                if (item.adminOnly && !hasRole("admin")) return null;
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
