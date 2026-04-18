

## H.A.M.D — Dental Lab Management System (v1)

### Important stack adaptation
Your spec calls for FastAPI + Celery + Redis + MinIO + Next.js. Lovable doesn't support that stack. I'll build the equivalent on **React + TanStack Start + Lovable Cloud** (Postgres + Auth + Storage + Edge Functions + RLS). All core features map cleanly; background jobs become scheduled Edge Functions.

### v1 scope (focused foundation)
The full spec is 12+ domains and months of work. v1 delivers a usable, end-to-end core. Later phases add billing, FIFO inventory, doctor portal, and analytics.

**Included in v1:**
1. **Auth + Multi-tenancy** — email/password login, `labs` table, every record scoped by `lab_id`, RLS policies enforce isolation, separate `user_roles` table (admin / manager / technician).
2. **Lab setup** — lab profile, settings (currency, timezone, prefixes), basic theme.
3. **Doctors & Patients** — CRUD with search, contact info, notes.
4. **Cases** — case number auto-gen, doctor/patient link, work type, shade, due date, attachments (Supabase Storage), notes.
5. **Dynamic Workflow Engine** — per-lab `workflows` + `workflow_stages` + `workflow_transitions`. Default workflow seeded on lab creation (استلام → طبعة → معدن → بورسلين → تشطيب → جاهز → تم التسليم). Stage history tracked with timestamps and duration.
6. **Kanban + List views** — drag case across stages, see overdue, filter by doctor/stage/date.
7. **Roles & Permissions** — `roles`, `permissions`, `role_permissions` tables seeded with module/action permissions. Admin UI to assign.
8. **Audit log** — every case stage change + sensitive write recorded.

**Deferred to later phases (will plan separately):**
- Billing / invoices / payments
- FIFO inventory + material batches + cost tracking + profitability
- Doctor self-service portal
- Reports / PDF export / advanced analytics
- Representatives / delivery
- Super-admin platform panel + subscription billing

### UX & language
- **Arabic RTL** primary, Cairo/Tajawal font, clean modern UI consistent with the system's enterprise feel.
- Sidebar navigation: Dashboard · Cases (Kanban/List) · Doctors · Patients · Workflows · Users & Roles · Settings.
- Dashboard shows: cases per stage, overdue count, today's deliveries, recent activity.

### Tenancy model
Single app URL. User logs in → scoped to their lab via `lab_id` on their profile + RLS. New labs created via signup (first user becomes lab admin). Subdomains/super-admin can come later.

### Data model (v1 tables)
`labs`, `profiles`, `user_roles`, `roles`, `permissions`, `role_permissions`, `doctors`, `patients`, `work_types`, `cases`, `case_attachments`, `workflows`, `workflow_stages`, `workflow_transitions`, `case_stage_history`, `audit_log`. All non-system tables carry `lab_id` with RLS.

### Build order
1. Cloud setup, schema, RLS, seed default permissions/roles/workflow
2. Auth + lab signup + role-gated routes
3. Doctors + Patients CRUD
4. Cases + attachments + workflow engine + Kanban
5. Roles & permissions admin UI
6. Dashboard + audit log + settings polish

After v1 ships and you've used it, we'll plan Phase 2 (billing + inventory + costing).

