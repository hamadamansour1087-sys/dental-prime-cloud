import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isCyber = theme === "cyber";
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      title={isCyber ? "تبديل إلى التصميم الفاتح" : "تبديل إلى التصميم الداكن"}
    >
      {isCyber ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isCyber ? "فاتح" : "داكن"}</span>
    </Button>
  );
}
