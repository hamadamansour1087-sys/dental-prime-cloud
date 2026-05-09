import { ArrowRight, Printer, Save, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseEntryFormApi } from "./useCaseEntryForm";

export function HeaderBar({ api }: { api: CaseEntryFormApi }) {
  const {
    onCancel,
    isEdit,
    form,
    selectedDoctor,
    nextCaseNumber,
    mode,
    canSubmit,
    submitting,
    submit,
  } = api;

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel} className="h-9 w-9 shrink-0" title="رجوع (Esc)">
              <ArrowRight className="h-5 w-5" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold sm:text-lg">{isEdit ? "تعديل الحالة" : "حالة جديدة"}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {form.patient_name || "بدون اسم مريض"}
              {selectedDoctor && ` · ${selectedDoctor.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {nextCaseNumber && mode === "admin" && (
            <span className="hidden rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary sm:inline-block">
              {nextCaseNumber}
            </span>
          )}
          <div className="hidden items-center gap-1.5 md:flex">
            {mode === "admin" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => submit("save_print")}
                disabled={!canSubmit}
                title="حفظ + طباعة (Ctrl+P)"
              >
                <Printer className="ml-1.5 h-4 w-4" /> حفظ وطباعة
              </Button>
            )}
            {!isEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => submit("save_new")}
                disabled={!canSubmit}
                title="حفظ + حالة جديدة (Ctrl+Enter)"
              >
                <Zap className="ml-1.5 h-4 w-4" /> حفظ + جديد
              </Button>
            )}
            <Button size="sm" onClick={() => submit("save")} disabled={!canSubmit} title="حفظ (Ctrl+S)">
              {submitting ? (
                <>
                  <Upload className="ml-1.5 h-4 w-4 animate-pulse" /> جاري الحفظ
                </>
              ) : (
                <>
                  <Save className="ml-1.5 h-4 w-4" /> حفظ
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function MobileActionBar({ api }: { api: CaseEntryFormApi }) {
  const { mode, isEdit, canSubmit, submitting, submit } = api;
  return (
    <div className="fixed bottom-0 start-0 end-0 z-30 border-t bg-card/95 p-3 shadow-lg backdrop-blur-md md:hidden">
      <div className="flex gap-2">
        {mode === "admin" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => submit("save_print")}
            disabled={!canSubmit}
            className="flex-1"
          >
            <Printer className="ml-1 h-4 w-4" />
            <span className="text-xs">طباعة</span>
          </Button>
        )}
        {!isEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => submit("save_new")}
            disabled={!canSubmit}
            className="flex-1"
          >
            <Zap className="ml-1 h-4 w-4" />
            <span className="text-xs">+ جديد</span>
          </Button>
        )}
        <Button size="sm" onClick={() => submit("save")} disabled={!canSubmit} className="flex-1">
          {submitting ? (
            <Upload className="h-4 w-4 animate-pulse" />
          ) : (
            <>
              <Save className="ml-1 h-4 w-4" />
              <span className="text-xs">حفظ</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
