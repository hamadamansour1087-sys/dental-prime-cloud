import { format, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from "date-fns";
import type { DateRange, Preset } from "./types";

export function getPresetRange(preset: Preset): DateRange {
  const today = new Date();
  switch (preset) {
    case "today":
      return { from: format(today, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    case "week":
      return { from: format(subDays(today, 6), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    case "month":
      return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(endOfMonth(today), "yyyy-MM-dd") };
    case "last_month": {
      const lm = subMonths(today, 1);
      return { from: format(startOfMonth(lm), "yyyy-MM-dd"), to: format(endOfMonth(lm), "yyyy-MM-dd") };
    }
    case "ytd":
      return { from: format(startOfYear(today), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
    default:
      return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
  }
}

export function fmtCurrency(n: number) {
  return new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n || 0);
}
export function fmtNum(n: number) {
  return new Intl.NumberFormat("ar-EG").format(n || 0);
}

export const CHART_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 87% 65%)",
  "hsl(346 77% 60%)",
  "hsl(190 84% 50%)",
  "hsl(48 96% 53%)",
  "hsl(160 64% 45%)",
];
