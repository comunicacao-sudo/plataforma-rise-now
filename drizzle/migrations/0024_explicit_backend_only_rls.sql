-- Internal tables are accessed only by trusted Edge Functions using the
-- service-role client. Keep browser access denied, but make that decision
-- explicit so every RLS-enabled table has an auditable policy.

create policy "backend only: app user connections"
on public.app_user_connections
for all
to anon, authenticated
using (false)
with check (false);

create policy "backend only: assessment ai outputs"
on public.assessment_ai_outputs
for all
to anon, authenticated
using (false)
with check (false);

create policy "backend only: assessment attempts"
on public.assessment_attempts
for all
to anon, authenticated
using (false)
with check (false);

create policy "backend only: assessment development plans"
on public.assessment_development_plans
for all
to anon, authenticated
using (false)
with check (false);

create policy "backend only: assessment private notes"
on public.assessment_development_private_notes
for all
to anon, authenticated
using (false)
with check (false);

create policy "backend only: assessment responses"
on public.assessment_responses
for all
to anon, authenticated
using (false)
with check (false);
