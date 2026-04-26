import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { ar } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerInputProps {
  /** Value in `yyyy-MM-dd` format (HTML date input compatible). */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
  disabled?: boolean;
  /** Label shown in the trigger when there's no value (defaults to placeholder). */
  title?: string;
}

/**
 * Friendly date picker that replaces native `<input type="date">`.
 * Stores value as `yyyy-MM-dd` string for easy interoperability.
 * Displays as e.g. "26 أبريل 2026".
 */
export function DatePickerInput({
  value,
  onChange,
  placeholder = "اختر التاريخ",
  className,
  clearable = true,
  disabled,
  title,
}: DatePickerInputProps) {
  const [open, setOpen] = React.useState(false);

  const date = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          title={title ?? placeholder}
          className={cn(
            "h-9 justify-start gap-2 px-3 text-right font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="flex-1 truncate">
            {date ? format(date, "d MMMM yyyy", { locale: ar }) : placeholder}
          </span>
          {clearable && value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange("");
                }
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="مسح التاريخ"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          initialFocus
          className={cn("pointer-events-auto p-3")}
        />
      </PopoverContent>
    </Popover>
  );
}
