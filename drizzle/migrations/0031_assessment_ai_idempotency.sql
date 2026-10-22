-- Guarantee one interpretation per assessment, audience, and prompt version.
-- Retries update the same row; a new prompt version creates a new historical row.

create unique index if not exists assessment_ai_outputs_generation_key
  on public.assessment_ai_outputs (attempt_id, audience, prompt_version);
