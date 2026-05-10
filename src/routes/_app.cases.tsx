/**
 * Cases list page — slim orchestrator.
 *
 * UI is split into `src/components/cases/*`:
 *   - CasesToolbar      — search/filter/view toggle
 *   - CasesTableView    — table layout
 *   - CasesKanbanView   — board layout
 *   - CaseContextMenu   — right-click actions
 * Data fetching lives in `useCasesData`.
 *
 * The legacy in-page "new case" dialog (replaced by /cases/new) was removed.
 */
import { type MouseEvent as ReactMouseEvent, useMemo, useState } from "react";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StageTransitionDialog } from "@/components/StageTransitionDialog";
import { FollowupCaseDialog } from "@/components/FollowupCaseDialog";
import { DeliveryDialog } from "@/components/DeliveryDialog";
import { CaseContextMenu } from "@/components/cases/CaseContextMenu";
import { CasesTableView } from "@/components/cases/CasesTableView";
import { CasesKanbanView } from "@/components/cases/CasesKanbanView";
import { CasesToolbar, type CasesView } from "@/components/cases/CasesToolbar";
import { useCasesData } from "@/components/cases/useCasesData";
import type { CaseRow, FollowupKind } from "@/components/cases/types";

export const Route = createFileRoute("/_app/cases")({
  component: CasesPage,
});

function CasesPage() {
  const { labId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [view, setView] = useState<CasesView>("table");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  const [stageOpen, setStageOpen] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<{
    caseId: string;
    workflowId: string | null;
    currentStageId: string | null;
    toStageId: string;
  } | null>(null);

  const [followup, setFollowup] = useState<{ caseId: string; caseNumber: string; type: FollowupKind } | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryCaseId, setDeliveryCaseId] = useState("");
  const [cancelTarget, setCancelTarget] = useState<{ id: string; caseNumber: string } | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; caseData: CaseRow } | null>(null);

  const { stages, cases, readyTechnicians, deliveryAgents, parentWorkTypes } = useCasesData(labId);

  const goToCase = (caseId: string) => {
    setContextMenu(null);
    const targetPath = `/cases/${caseId}`;
    try {
      navigate({ to: "/cases/$caseId", params: { caseId } });
      window.setTimeout(() => {
        if (window.location.pathname !== targetPath) {
          window.location.assign(targetPath);
        }
      }, 120);
    } catch {
      window.location.assign(targetPath);
    }
  };

  const moveCase = (
    caseId: string,
    toStageId: string,
    workflowId: string | null,
    currentStageId: string | null,
  ) => {
    setContextMenu(null);
    setSelectedTransition({ caseId, workflowId, currentStageId, toStageId });
    setStageOpen(true);
  };

  const updateCaseStatus = async (
    caseId: string,
    status: "active" | "on_hold" | "delivered" | "cancelled",
  ) => {
    setContextMenu(null);
    const patch: { status: typeof status; date_delivered?: string } = { status };
    if (status === "delivered") patch.date_delivered = new Date().toISOString();
    const { error } = await supabase.from("cases").update(patch).eq("id", caseId);
    if (error) return toast.error(error.message);
    toast.success("تم التحديث");
    qc.invalidateQueries({ queryKey: ["cases"] });
  };

  const today = new Date().toISOString().slice(0, 10);

  const openCaseContextMenu = (event: ReactMouseEvent<HTMLElement>, caseData: CaseRow) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, caseData });
  };

  const filteredCases = useMemo<CaseRow[]>(() => {
    let list = cases.data ?? [];
    if (stageFilter !== "all") list = list.filter((c) => c.current_stage_id === stageFilter);
    if (dateFilter) {
      list = list.filter((c) => !!c.stage_entered_at && c.stage_entered_at.slice(0, 10) === dateFilter);
    }
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.case_number?.toLowerCase().includes(s) ||
          c.doctors?.name?.toLowerCase().includes(s) ||
          c.patients?.name?.toLowerCase().includes(s) ||
          c.work_types?.name?.toLowerCase().includes(s),
      );
    }
    return list;
  }, [cases.data, search, stageFilter, dateFilter]);

  if (location.pathname !== "/cases") return <Outlet />;

  return (
    <div className="space-y-4">
      <StageTransitionDialog
        open={stageOpen}
        onOpenChange={(o) => {
          setStageOpen(o);
          if (!o) setSelectedTransition(null);
        }}
        caseId={selectedTransition?.caseId ?? ""}
        workflowId={selectedTransition?.workflowId ?? null}
        currentStageId={selectedTransition?.currentStageId ?? null}
        initialToStageId={selectedTransition?.toStageId}
        onTransitioned={() => {
          qc.invalidateQueries({ queryKey: ["cases"] });
          qc.invalidateQueries({ queryKey: ["cases-ready-technicians"] });
        }}
      />

      <DeliveryDialog
        open={deliveryOpen}
        onOpenChange={setDeliveryOpen}
        caseId={deliveryCaseId}
        onDelivered={() => qc.invalidateQueries({ queryKey: ["cases"] })}
      />

      {followup && (
        <FollowupCaseDialog
          open={!!followup}
          onOpenChange={(o) => !o && setFollowup(null)}
          caseId={followup.caseId}
          caseNumber={followup.caseNumber}
          caseType={followup.type}
          onCreated={(newCaseId, options) => {
            setFollowup(null);
            if (options.withNewWork) goToCase(newCaseId);
          }}
        />
      )}

      {contextMenu && (
        <CaseContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          caseData={contextMenu.caseData}
          stages={stages.data}
          onClose={() => setContextMenu(null)}
          onOpen={goToCase}
          onMove={moveCase}
          onDeliver={(id) => {
            setContextMenu(null);
            setDeliveryCaseId(id);
            setDeliveryOpen(true);
          }}
          onUpdateStatus={updateCaseStatus}
          onFollowup={(caseId, caseNumber, type) => {
            setContextMenu(null);
            setFollowup({ caseId, caseNumber, type });
          }}
          onCancel={(id, caseNumber) => {
            setCancelTarget({ id, caseNumber });
            setContextMenu(null);
          }}
        />
      )}

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إلغاء الحالة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء الحالة{" "}
              <span className="font-mono font-semibold">{cancelTarget?.caseNumber}</span>؟ لا يمكن التراجع عن هذا
              الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (cancelTarget) updateCaseStatus(cancelTarget.id, "cancelled");
                setCancelTarget(null);
              }}
            >
              إلغاء الحالة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">الحالات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة ومتابعة جميع حالات المعمل</p>
        </div>
        <Button onClick={() => navigate({ to: "/cases/new" })} className="rounded-xl shadow-sm h-10 px-5 gap-2">
          <Plus className="h-4 w-4" />
          حالة جديدة
        </Button>
      </div>

      <CasesToolbar
        search={search}
        onSearchChange={setSearch}
        stageFilter={stageFilter}
        onStageFilterChange={setStageFilter}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        stages={stages.data}
        count={filteredCases.length}
        view={view}
        onViewChange={setView}
      />

      {view === "table" ? (
        <CasesTableView
          cases={filteredCases}
          stages={stages.data}
          readyTechnicians={readyTechnicians.data}
          deliveryAgents={deliveryAgents.data}
          parentWorkTypes={parentWorkTypes.data}
          today={today}
          onOpen={goToCase}
          onContextMenu={openCaseContextMenu}
        />
      ) : (
        <CasesKanbanView
          cases={filteredCases}
          stages={stages.data}
          parentWorkTypes={parentWorkTypes.data}
          today={today}
          onOpen={goToCase}
          onMove={moveCase}
          onContextMenu={openCaseContextMenu}
        />
      )}
    </div>
  );
}
