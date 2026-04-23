import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/statement")({
  component: PortalStatement,
});

function PortalStatement() {
  return <div>Statement placeholder</div>;
}
