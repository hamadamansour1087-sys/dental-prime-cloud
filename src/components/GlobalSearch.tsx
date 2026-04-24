import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  ClipboardList,
  Stethoscope,
  Users,
  FileText,
  Wallet,
  Receipt,
  Truck,
  Package,
  ShoppingCart,
  Settings,
  HardHat,
  BarChart3,
  DollarSign,
  BookOpen,
  ArrowLeftRight,
  FilePlus2,
  Search as SearchIcon,
} from "lucide-react";

type Variant = "admin" | "portal";

type NavLink = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  keywords?: string;
};

const adminNav: NavLink[] = [
  { title: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard, keywords: "dashboard home رئيسية" },
  { title: "الحالات", url: "/cases", icon: ClipboardList, keywords: "cases" },
  { title: "طلبات الأطباء", url: "/pending-cases", icon: ClipboardList, keywords: "pending" },
  { title: "الأطباء", url: "/doctors", icon: Stethoscope, keywords: "doctors" },
  { title: "المرضى", url: "/patients", icon: Users, keywords: "patients" },
  { title: "الفنيون", url: "/technicians", icon: HardHat, keywords: "technicians" },
  { title: "تقرير الإنتاج", url: "/technician-reports", icon: BarChart3 },
  { title: "الأسعار", url: "/pricing", icon: DollarSign, keywords: "prices" },
  { title: "الفواتير", url: "/invoices", icon: FileText, keywords: "invoices" },
  { title: "كشف الحساب", url: "/statements", icon: BookOpen, keywords: "statement" },
  { title: "الخزن", url: "/cash-accounts", icon: Wallet, keywords: "cash" },
  { title: "المصروفات", url: "/expenses", icon: Receipt, keywords: "expenses" },
  { title: "سندات قبض/صرف", url: "/vouchers", icon: ArrowLeftRight, keywords: "vouchers" },
  { title: "الموردون", url: "/suppliers", icon: Truck, keywords: "suppliers" },
  { title: "المخزون", url: "/inventory", icon: Package, keywords: "inventory" },
  { title: "فواتير المشتريات", url: "/purchases", icon: ShoppingCart, keywords: "purchases" },
  { title: "سير العمل", url: "/workflows", icon: BarChart3, keywords: "workflows" },
  { title: "المستخدمون", url: "/users", icon: Users },
  { title: "الإعدادات", url: "/settings", icon: Settings },
];

const portalNav: NavLink[] = [
  { title: "الرئيسية", url: "/portal/dashboard", icon: LayoutDashboard },
  { title: "حالة جديدة", url: "/portal/new-case", icon: FilePlus2 },
  { title: "حالاتي", url: "/portal/cases", icon: ClipboardList },
  { title: "كشف الحساب", url: "/portal/statement", icon: Wallet },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: Variant;
}

export function GlobalSearch({ open, onOpenChange, variant }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const navLinks = variant === "admin" ? adminNav : portalNav;
  const debounced = query.trim();

  const { data: cases } = useQuery({
    queryKey: ["global-search-cases", variant, debounced],
    enabled: open && debounced.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("cases")
        .select("id, case_number, patients(name), doctors(name)")
        .ilike("case_number", `%${debounced}%`)
        .limit(8);
      return data ?? [];
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ["global-search-doctors", debounced],
    enabled: open && variant === "admin" && debounced.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id, name, phone")
        .ilike("name", `%${debounced}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const { data: patients } = useQuery({
    queryKey: ["global-search-patients", debounced],
    enabled: open && variant === "admin" && debounced.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, name, phone")
        .ilike("name", `%${debounced}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const go = (to: string, params?: Record<string, string>) => {
    onOpenChange(false);
    setTimeout(() => navigate({ to, params } as any), 0);
  };

  const filteredNav = useMemo(() => {
    if (!debounced) return navLinks;
    const q = debounced.toLowerCase();
    return navLinks.filter(
      (n) => n.title.toLowerCase().includes(q) || (n.keywords ?? "").toLowerCase().includes(q),
    );
  }, [debounced, navLinks]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="ابحث عن صفحة، حالة، طبيب، مريض..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>لا توجد نتائج.</CommandEmpty>

        {filteredNav.length > 0 && (
          <CommandGroup heading="الصفحات">
            {filteredNav.map((item) => (
              <CommandItem
                key={item.url}
                value={`page-${item.url}-${item.title}`}
                onSelect={() => go(item.url)}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
                <CommandShortcut>{item.url}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {cases && cases.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="الحالات">
              {cases.map((c: any) => (
                <CommandItem
                  key={c.id}
                  value={`case-${c.id}-${c.case_number}`}
                  onSelect={() =>
                    go(
                      variant === "admin" ? "/cases/$caseId" : "/portal/cases",
                      variant === "admin" ? { caseId: c.id } : undefined,
                    )
                  }
                >
                  <ClipboardList className="h-4 w-4" />
                  <span className="font-medium">#{c.case_number}</span>
                  <span className="text-muted-foreground text-xs">
                    {c.patients?.name ?? "—"} • {c.doctors?.name ?? "—"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {doctors && doctors.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="الأطباء">
              {doctors.map((d: any) => (
                <CommandItem
                  key={d.id}
                  value={`doctor-${d.id}-${d.name}`}
                  onSelect={() => go("/doctors")}
                >
                  <Stethoscope className="h-4 w-4" />
                  <span>{d.name}</span>
                  {d.phone && <CommandShortcut>{d.phone}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {patients && patients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="المرضى">
              {patients.map((p: any) => (
                <CommandItem
                  key={p.id}
                  value={`patient-${p.id}-${p.name}`}
                  onSelect={() => go("/patients")}
                >
                  <Users className="h-4 w-4" />
                  <span>{p.name}</span>
                  {p.phone && <CommandShortcut>{p.phone}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {debounced.length < 2 && (
          <CommandGroup heading="تلميح">
            <div className="px-2 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <SearchIcon className="h-3.5 w-3.5" />
              اكتب حرفين على الأقل للبحث في الحالات والأطباء والمرضى.
            </div>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function useGlobalSearchHotkey(setOpen: (v: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "/" && !isTyping(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}
