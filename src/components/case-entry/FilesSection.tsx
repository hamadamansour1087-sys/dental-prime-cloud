import { useRef } from "react";
import { Camera, FileBox, ImageIcon, Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileGrid } from "./FileGrid";
import type { CaseEntryFormApi } from "./useCaseEntryForm";

export function FilesSection({ api }: { api: CaseEntryFormApi }) {
  const {
    files,
    addFiles,
    removeFile,
    existingAttachments,
    removeExistingAttachment,
    onDrop,
    setCameraOpen,
    setScanPreviewId,
  } = api;

  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const allFilesCount = existingAttachments.length + files.length;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Paperclip className="h-4 w-4" /> الملفات
          {files.length > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
              {files.length}
            </span>
          )}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              addFiles(e.target.files, "photo");
              e.target.value = "";
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => setCameraOpen(true)} className="h-8">
            <Camera className="ml-1 h-3.5 w-3.5" /> كاميرا
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
            <ImageIcon className="ml-1 h-3.5 w-3.5" /> صور
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files, "photo");
                e.target.value = "";
              }}
            />
          </label>
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
            <FileBox className="ml-1 h-3.5 w-3.5" /> إسكان
            <input
              ref={scanRef}
              type="file"
              accept=".stl,.ply,.obj,.zip,.3mf,.dcm"
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files, "scan");
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/10 p-3"
      >
        {allFilesCount === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <Upload className="mx-auto mb-2 h-6 w-6 opacity-40" />
            اسحب الملفات هنا أو استخدم الأزرار أعلاه
          </div>
        ) : (
          <>
            {existingAttachments.length > 0 && (
              <div className="mb-2">
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                  ملفات موجودة ({existingAttachments.length})
                </p>
                <FileGrid
                  files={existingAttachments}
                  onRemove={removeExistingAttachment}
                  onPreview={setScanPreviewId}
                />
              </div>
            )}
            {files.length > 0 && (
              <div>
                {existingAttachments.length > 0 && (
                  <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                    ملفات جديدة ({files.length})
                  </p>
                )}
                <FileGrid files={files} onRemove={removeFile} onPreview={setScanPreviewId} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
