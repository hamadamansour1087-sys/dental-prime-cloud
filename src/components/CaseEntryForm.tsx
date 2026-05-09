/**
 * CaseEntryForm — Professional, high-volume case entry screen.
 *
 * Thin orchestrator. All state, queries, and submit logic live in
 * `case-entry/useCaseEntryForm.ts`. UI is split into focused sections:
 *  - PatientSection      (doctor, clinic, patient, due date, notes)
 *  - WorkItemsSection    (per-item Materials + Teeth subsections)
 *  - FilesSection        (photo / scan uploads)
 *  - SummaryCard         (totals — acts as PricingSection)
 *  - HeaderBar / MobileActionBar (save actions)
 */
import { InlineCameraDialog } from "@/components/InlineCameraDialog";
import { ScanPreviewDialog } from "@/components/ScanPreviewDialog";

import { useCaseEntryForm } from "./case-entry/useCaseEntryForm";
import { HeaderBar, MobileActionBar } from "./case-entry/ActionBar";
import { PatientSection } from "./case-entry/PatientSection";
import { WorkItemsSection } from "./case-entry/WorkItemsSection";
import { FilesSection } from "./case-entry/FilesSection";
import { SummaryCard } from "./case-entry/SummaryCard";
import type { CaseEntryMode } from "./case-entry/types";

// Re-exports for backwards compatibility with existing imports.
export type {
  CaseEntryItem,
  PendingFileMeta,
  DoctorOption,
  WorkTypeOption,
  CaseEntryMode,
} from "./case-entry/types";

interface CaseEntryFormProps {
  mode: CaseEntryMode;
  labId: string;
  fixedDoctorId?: string;
  editCaseId?: string;
  onSaved?: (caseId: string, caseNumber: string) => void;
  onCancel?: () => void;
}

export function CaseEntryForm(props: CaseEntryFormProps) {
  const api = useCaseEntryForm(props);
  const {
    addFiles,
    cameraOpen,
    setCameraOpen,
    scanPreviewId,
    setScanPreviewId,
    fileBlobsRef,
    files,
  } = api;

  return (
    <div className="flex h-full min-h-screen flex-col bg-background">
      <HeaderBar api={api} />

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 pb-32 md:pb-6">
        <div className="grid gap-4 lg:grid-cols-12">
          <section className="space-y-4 lg:col-span-5">
            <PatientSection api={api} />
            <SummaryCard api={api} />
          </section>

          <section className="space-y-4 lg:col-span-7">
            <WorkItemsSection api={api} />
            <FilesSection api={api} />
          </section>
        </div>
      </div>

      <MobileActionBar api={api} />

      <InlineCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => {
          const dt = new DataTransfer();
          dt.items.add(file);
          addFiles(dt.files, "photo");
        }}
      />
      <ScanPreviewDialog
        open={!!scanPreviewId}
        onOpenChange={(v) => !v && setScanPreviewId(null)}
        file={scanPreviewId ? fileBlobsRef.current.get(scanPreviewId) ?? null : null}
        fileName={scanPreviewId ? files.find((f) => f.id === scanPreviewId)?.name : undefined}
      />
    </div>
  );
}
