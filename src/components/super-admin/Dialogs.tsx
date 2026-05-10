import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { LabRequest, LabRow } from "./types";

interface ApproveProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: LabRequest | null;
  trialDays: number;
  setTrialDays: (n: number) => void;
  onConfirm: () => void;
  pending: boolean;
}

export function ApproveDialog({
  open,
  onOpenChange,
  request,
  trialDays,
  setTrialDays,
  onConfirm,
  pending,
}: ApproveProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>الموافقة على طلب المعمل</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p>
              <strong>المعمل:</strong> {request?.lab_name}
            </p>
            <p>
              <strong>صاحب الطلب:</strong> {request?.owner_name}
            </p>
            <p>
              <strong>البريد:</strong> {request?.email}
            </p>
          </div>
          <div>
            <Label>عدد أيام الفترة التجريبية</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "جارٍ..." : "موافقة وإنشاء المعمل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RejectProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: LabRequest | null;
  reason: string;
  setReason: (s: string) => void;
  onConfirm: () => void;
  pending: boolean;
}

export function RejectDialog({
  open,
  onOpenChange,
  request,
  reason,
  setReason,
  onConfirm,
  pending,
}: RejectProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>رفض طلب المعمل</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p>
              <strong>المعمل:</strong> {request?.lab_name}
            </p>
            <p>
              <strong>صاحب الطلب:</strong> {request?.owner_name}
            </p>
          </div>
          <div>
            <Label>سبب الرفض (اختياري)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="بيانات غير مكتملة..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "جارٍ..." : "رفض الطلب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ExtendProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lab: LabRow | null;
  extraDays: number;
  setExtraDays: (n: number) => void;
  onConfirm: () => void;
  pending: boolean;
}

export function ExtendTrialDialog({
  open,
  onOpenChange,
  lab,
  extraDays,
  setExtraDays,
  onConfirm,
  pending,
}: ExtendProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تمديد الفترة التجريبية</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-3 text-sm">
            <p>
              <strong>المعمل:</strong> {lab?.name}
            </p>
            <p>
              <strong>الأيام الحالية:</strong> {lab?.trial_days} يوم
            </p>
          </div>
          <div>
            <Label>عدد الأيام المضافة</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={extraDays}
              onChange={(e) => setExtraDays(Number(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "جارٍ..." : "تمديد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
