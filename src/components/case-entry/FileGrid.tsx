import { memo } from "react";
import { Eye, FileBox, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingFileMeta } from "./types";

export const FileGrid = memo(function FileGrid({
  files,
  onRemove,
  onPreview,
}: {
  files: PendingFileMeta[];
  onRemove: (id: string) => void;
  onPreview?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {files.map((f) => {
        const canOpenPreview = f.kind === "scan";
        const canPreview3d = f.kind === "scan" && /\.(stl|ply|obj|3mf)$/i.test(f.name);
        return (
          <div key={f.id} className="group relative overflow-hidden rounded-md border bg-background shadow-xs">
            {f.previewUrl ? (
              <img src={f.previewUrl} alt={f.name} loading="lazy" decoding="async" className="h-24 w-full object-cover" />
            ) : (
              <button
                type="button"
                onClick={() => canOpenPreview && onPreview?.(f.id)}
                className={cn(
                  "flex h-24 w-full flex-col items-center justify-center gap-1 bg-muted/40 p-2 text-center",
                  canOpenPreview && "cursor-pointer hover:bg-muted/70",
                )}
                title={canOpenPreview ? "اضغط للمعاينة" : f.name}
              >
                <FileBox className="h-6 w-6 text-muted-foreground" />
                <span className="line-clamp-2 text-[10px] text-muted-foreground" dir="ltr">
                  {f.name}
                </span>
                {canOpenPreview && <span className="text-[9px] font-bold text-primary">{canPreview3d ? "معاينة 3D" : "عرض الملف"}</span>}
              </button>
            )}
            <div className="flex items-center justify-between gap-1 p-1.5">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  f.kind === "scan" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {f.kind === "scan" ? "إسكان" : "صورة"}
              </span>
              {canOpenPreview && (
                <Button type="button" size="sm" variant="secondary" className="h-6 px-2 text-[10px]" onClick={() => onPreview?.(f.id)}>
                  <Eye className="ml-1 h-3 w-3" /> معاينة
                </Button>
              )}
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => onRemove(f.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
});
