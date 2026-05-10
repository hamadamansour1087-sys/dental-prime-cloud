import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Eye,
  RotateCcw,
  Wrench,
  XCircle,
} from "lucide-react";
import type { CaseRow, CaseStage, FollowupKind } from "./types";

interface Props {
  x: number;
  y: number;
  caseData: CaseRow;
  stages: CaseStage[] | undefined;
  onClose: () => void;
  onOpen: (caseId: string) => void;
  onMove: (caseId: string, toStageId: string, workflowId: string | null, currentStageId: string | null) => void;
  onDeliver: (caseId: string) => void;
  onUpdateStatus: (caseId: string, status: "active" | "on_hold" | "cancelled") => void;
  onFollowup: (caseId: string, caseNumber: string, kind: FollowupKind) => void;
  onCancel: (id: string, caseNumber: string) => void;
}

export function CaseContextMenu({
  x,
  y,
  caseData,
  stages,
  onClose,
  onOpen,
  onMove,
  onDeliver,
  onUpdateStatus,
  onFollowup,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Reposition to stay in viewport.
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + rect.width > vw - 8) left = vw - rect.width - 8;
    if (top + rect.height > vh - 8) top = vh - rect.height - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y]);

  // Close on outside click / scroll / resize / Escape.
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const currentStage = stages?.find((s) => s.id === caseData.current_stage_id) ?? null;
  const nextStage = currentStage
    ? stages?.find((s) => s.order_index === currentStage.order_index + 1) ?? null
    : null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      dir="rtl"
      className="fixed z-50 w-56 rounded-xl border border-border/60 bg-popover p-1.5 text-popover-foreground shadow-elevated"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem icon={<Eye className="ml-2 h-4 w-4" />} onClick={() => onOpen(caseData.id)}>
        فتح الحالة
      </MenuItem>

      <Divider />

      {stages
        ?.filter((s) => s.id !== caseData.current_stage_id)
        .map((s) => (
          <MenuItem
            key={s.id}
            icon={<ArrowLeftRight className="ml-2 h-4 w-4" />}
            onClick={() => onMove(caseData.id, s.id, caseData.workflow_id, caseData.current_stage_id)}
          >
            نقل إلى: {s.name}
          </MenuItem>
        ))}

      {nextStage && (
        <MenuItem
          icon={<ArrowLeftRight className="ml-2 h-4 w-4" />}
          onClick={() => onMove(caseData.id, nextStage.id, caseData.workflow_id, caseData.current_stage_id)}
        >
          المرحلة التالية: {nextStage.name}
        </MenuItem>
      )}

      <Divider />

      {caseData.status !== "delivered" && (
        <MenuItem
          icon={<CheckCircle2 className="ml-2 h-4 w-4 text-emerald-600" />}
          onClick={() => onDeliver(caseData.id)}
        >
          تسليم الحالة
        </MenuItem>
      )}

      {caseData.status !== "on_hold" && caseData.status !== "delivered" && (
        <MenuItem
          icon={<AlertTriangle className="ml-2 h-4 w-4 text-amber-600" />}
          onClick={() => onUpdateStatus(caseData.id, "on_hold")}
        >
          إيقاف مؤقت
        </MenuItem>
      )}

      {caseData.status === "on_hold" && (
        <MenuItem
          icon={<CheckCircle2 className="ml-2 h-4 w-4" />}
          onClick={() => onUpdateStatus(caseData.id, "active")}
        >
          إعادة تفعيل
        </MenuItem>
      )}

      <Divider />

      <MenuItem
        icon={<RotateCcw className="ml-2 h-4 w-4 text-blue-600" />}
        onClick={() => onFollowup(caseData.id, caseData.case_number, "remake")}
      >
        إعادة الحالة
      </MenuItem>
      <MenuItem
        icon={<Wrench className="ml-2 h-4 w-4 text-amber-600" />}
        onClick={() => onFollowup(caseData.id, caseData.case_number, "repair")}
      >
        تصليح الحالة
      </MenuItem>

      <Divider />

      <MenuItem
        icon={<XCircle className="ml-2 h-4 w-4" />}
        destructive
        onClick={() => onCancel(caseData.id, caseData.case_number)}
      >
        إلغاء الحالة
      </MenuItem>
    </div>,
    document.body,
  );
}

function MenuItem({
  icon,
  onClick,
  children,
  destructive = false,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent " +
        (destructive ? "text-destructive hover:text-destructive" : "hover:text-accent-foreground")
      }
    >
      {icon}
      {children}
    </button>
  );
}

function Divider() {
  return <div className="-mx-1 my-1 h-px bg-border" />;
}
