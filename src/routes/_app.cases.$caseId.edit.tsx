import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { CaseEntryForm } from "@/components/CaseEntryForm";

export const Route = createFileRoute("/_app/cases/$caseId/edit")({
  component: EditCasePage,
});

function EditCasePage() {
  const { caseId } = Route.useParams();
  const { labId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (!labId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-4 md:-mx-6 md:-my-6">
      <CaseEntryForm
        mode="admin"
        labId={labId}
        editCaseId={caseId}
        onCancel={() => navigate({ to: "/cases/$caseId", params: { caseId } })}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["cases"] });
          qc.invalidateQueries({ queryKey: ["case-detail", caseId] });
          qc.invalidateQueries({ queryKey: ["case-items", caseId] });
          navigate({ to: "/cases/$caseId", params: { caseId } });
        }}
      />
    </div>
  );
}
