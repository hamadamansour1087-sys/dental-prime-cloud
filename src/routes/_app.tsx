import { createFileRoute, Outlet, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScanLine, Search, LogOut } from "lucide-react";
import { QrScannerDialog } from "@/components/QrScannerDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AIAssistant } from "@/components/AIAssistant";
import { NotificationsBell } from "@/components/NotificationsBell";
import { PortalNotificationsBell } from "@/components/PortalNotificationsBell";
import { GlobalSearch, useGlobalSearchHotkey } from "@/components/GlobalSearch";
import { TopNav } from "@/components/TopNav";
import { BackupReminderDialog, shouldRemindBackup } from "@/components/BackupReminderDialog";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut, profile, labId, hasRole } = useAuth();
  const navigate = useNavigate();
  const [scanOpen, setScanOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [graceExpired, setGraceExpired] = useState(false);
  useGlobalSearchHotkey(setSearchOpen);

  // Give the auth state a brief grace period after login so that we don't
  // flash "ليس حساب معمل" while the profile/roles are still being fetched.
  useEffect(() => {
    if (user && (!profile || !labId)) {
      setGraceExpired(false);
      const t = setTimeout(() => setGraceExpired(true), 1500);
      return () => clearTimeout(t);
    }
    setGraceExpired(false);
  }, [user, profile, labId]);

  if (loading || (user && (!profile || !labId) && !graceExpired)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  if (!profile || !labId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" dir="rtl">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold">هذا الحساب ليس حساب معمل</h2>
          <p className="mt-2 text-sm text-muted-foreground">سجّل الدخول بحساب المعمل الصحيح من صفحة برنامج المعمل.</p>
          <Button variant="outline" className="mt-4" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  const performLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const handleLogout = () => {
    // Only nag admins (they own the data) and only once every 24h
    if (hasRole("admin") && labId && shouldRemindBackup()) {
      setBackupOpen(true);
    } else {
      performLogout();
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background gradient-mesh">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-card/75 backdrop-blur-xl supports-[backdrop-filter]:bg-card/65 shadow-xs">
        <div className="flex h-14 items-center gap-3 px-4">
          {/* Brand */}
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-primary-foreground font-display font-extrabold text-base shadow-glow">
              H
            </div>
            <div className="hidden sm:block leading-tight">
              <p className="font-display font-bold text-foreground tracking-tight text-sm">H.A.M.D</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                {profile?.full_name ?? "مستخدم"}
              </p>
            </div>
          </Link>

          {/* Primary nav */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <TopNav />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="gap-2 text-muted-foreground hover:text-foreground"
              title="بحث عام (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
              <span className="hidden lg:inline">بحث...</span>
              <kbd className="hidden xl:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setScanOpen(true)} title="مسح كود حالة">
              <ScanLine className="h-4 w-4" />
            </Button>
            <NotificationsBell />
            <PortalNotificationsBell variant="lab" />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} title="تسجيل الخروج">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 animate-fade-in-up">
        <Outlet />
      </main>

      <QrScannerDialog open={scanOpen} onOpenChange={setScanOpen} />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} variant="admin" />
      <AIAssistant />
      {labId && (
        <BackupReminderDialog
          open={backupOpen}
          onOpenChange={setBackupOpen}
          labId={labId}
          onProceed={performLogout}
        />
      )}
    </div>
  );
}
