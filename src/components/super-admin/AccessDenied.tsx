import { LogOut, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AccessDenied({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4" dir="rtl">
      <Card className="w-full max-w-md border-destructive/30 bg-card/80 backdrop-blur-lg text-center">
        <CardContent className="py-12 space-y-4">
          <XCircle className="h-16 w-16 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">غير مصرح بالوصول</h2>
          <p className="text-sm text-muted-foreground">هذا الحساب ليس مسجلاً كسوبر أدمن.</p>
          <Button variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4 ml-2" /> تسجيل الخروج
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
