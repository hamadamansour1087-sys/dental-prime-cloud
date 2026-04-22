import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScanLine } from "lucide-react";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AIAssistant } from "@/components/AIAssistant";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const [scanOpen, setScanOpen] = useState(false);

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
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b bg-card/80 backdrop-blur px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setScanOpen(true)} title="مسح كود حالة">
                <ScanLine className="h-4 w-4" />
                <span className="hidden sm:inline">مسح QR</span>
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
          <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} />
          <AIAssistant />
        </div>
      </div>
    </SidebarProvider>
  );
}
