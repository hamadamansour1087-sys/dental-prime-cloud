import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScanLine, Search } from "lucide-react";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AIAssistant } from "@/components/AIAssistant";
import { NotificationsBell } from "@/components/NotificationsBell";
import { GlobalSearch, useGlobalSearchHotkey } from "@/components/GlobalSearch";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const [scanOpen, setScanOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useGlobalSearchHotkey(setSearchOpen);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background gradient-mesh">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-card/75 backdrop-blur-xl supports-[backdrop-filter]:bg-card/65 px-4 shadow-xs">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchOpen(true)}
                className="gap-2 text-muted-foreground hover:text-foreground"
                title="بحث عام (Ctrl+K)"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">بحث...</span>
                <kbd className="hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setScanOpen(true)} title="مسح كود حالة">
                <ScanLine className="h-4 w-4" />
                <span className="hidden sm:inline">مسح QR</span>
              </Button>
              <NotificationsBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 animate-fade-in-up">
            <Outlet />
          </main>
          <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} />
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} variant="admin" />
          <AIAssistant />
        </div>
      </div>
    </SidebarProvider>
  );
}
