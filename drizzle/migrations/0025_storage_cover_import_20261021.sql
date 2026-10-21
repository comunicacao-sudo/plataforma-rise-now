-- Definitive cover-path mapping for the verified 2026-10-21 Storage import.
-- Binary assets remain in Supabase Storage and are intentionally not committed to Git.
do $$
declare
  mismatch_count integer;
  mapped_count integer;
begin
  with expected(title, stable_key, cover_path) as (
    values
    ('Self Brand & Posicionamento', 'b3407b6f-6fb6-4e8e-b434-f3015597b7d3'::uuid, 'covers/import-20261021/d84294b5-aaec-4547-8bc1-48f656cb1af9.png'),
    ('Tomada de Decisão Profissional', '7a57b6bb-94b9-4b1f-b42a-7eac4410df18'::uuid, 'covers/import-20261021/d0198946-a54f-4ff0-9acc-c5abe73c33e2.png'),
    ('Mapa de Esclarecimento', '7789ee31-bff4-4766-a178-9037d5255d10'::uuid, 'covers/import-20261021/9861abbb-d96a-47c0-9bfa-908a391dabd0.png'),
    ('Onboarding RISE', '9f63aace-2568-4af8-a177-95324e2133e8'::uuid, 'covers/import-20261021/91206845-c7a8-4913-95c6-e3b79e70ebc4.png'),
    ('Identity Session', '5ccc5982-819a-4883-88b1-ca46685c384f'::uuid, 'covers/import-20261021/2e3a7727-80bd-44a3-bc3f-7744114007a2.png'),
    ('Questionário do perfil comportamental', '7d2d3d63-9fc4-4d7a-a1c0-6e32a5c91c50'::uuid, 'covers/import-20261021/33e6e4ea-f693-4910-aaba-cb6850a9ea23.png'),
    ('1:1 Direção', 'c0fd9fa4-0c5c-437b-bad0-b8f33a658183'::uuid, 'covers/import-20261021/87f24adf-922f-4a37-bd43-fb799c586815.png'),
    ('Consciência & Leitura de Ambiente', '3aa09845-fa81-4097-b73f-710b14f7a5d1'::uuid, 'covers/import-20261021/40767b08-908b-4d26-ac04-1f708d886192.png'),
    ('O Novo Profissional', 'a81c13da-2a9a-4dd4-a0dc-bd482cea60da'::uuid, 'covers/import-20261021/e3dc914e-78ab-4490-a147-fc73ea8a4b39.png'),
    ('Competências do Próximo Nível', '83a70fbe-ddd7-48f7-b4f8-5eb7d913b523'::uuid, 'covers/import-20261021/633d88d2-3b16-4da8-8126-66fba4c3f084.png'),
    ('IA na Prática', '74c559b9-c222-4503-9fd5-68db4474f98a'::uuid, 'covers/import-20261021/eb4d185c-b5c3-4cc0-92df-d79df8234af0.png'),
    ('Forward Reflection', 'ff9a6db1-8a60-42cc-ba71-73381ac72313'::uuid, 'covers/import-20261021/a1c6b06f-d0c1-49ce-96ae-06bfd91f3420.png'),
    ('Consolidação', 'cf94849b-b919-4e02-8c73-9f84456c798d'::uuid, 'covers/import-20261021/9dad6ee0-d76f-4c59-95a1-4054e7e83335.png'),
    ('AI & Productivity Session', 'b45614c3-648c-45a3-b05f-0167793da7ad'::uuid, 'covers/import-20261021/abe3a098-ed83-471f-80a6-66f7e0080226.png'),
    ('RISE 90 START', '09ab6a52-7214-4cb2-adeb-7b06e35f139d'::uuid, 'covers/import-20261021/c22d076d-6244-4069-91a1-07577b6a93eb.png'),
    ('Next Level Lab', '2f4c1b5f-3473-490c-b11e-03c8128e27f8'::uuid, 'covers/import-20261021/28d27c89-4eda-466b-993a-7ca0497a9334.png'),
    ('Consistência & Accountability', '8e58a530-ddf9-48ea-aa87-1ffe8d1043a7'::uuid, 'covers/import-20261021/83a57309-55f2-4cdb-a2fa-695df7b5cb00.png'),
    ('RISE 90 CHECKPOINT', 'ab5b1e6c-86c8-42d6-9296-19ecc68cd391'::uuid, 'covers/import-20261021/082bec40-6fa6-44c7-ab71-1dcb7465c6a4.png'),
    ('RISE Decision Room', '6908d7b6-450a-4053-8968-c4ddb71b1232'::uuid, 'covers/import-20261021/54658f92-5bc8-4cbc-9364-f2944fc34a25.png'),
    ('Sustentar a Evolução', '2ce08f2c-69e4-4ac9-9b15-888de1b6cb74'::uuid, 'covers/import-20261021/43ece0b4-f574-41ad-a34e-5d1a4b82d022.png'),
    ('RISE Board', '17905347-5e1d-469d-9bde-379379844324'::uuid, 'covers/import-20261021/b47a56f8-c059-456d-8ac0-ec919735732d.png'),
    ('RISE 90 REVIEW', 'cce586eb-dd6e-4683-a0e7-92a4a6fb7f41'::uuid, 'covers/import-20261021/5e5a541d-6a11-4d07-905f-ba2e55aa8fa4.png'),
    ('RISE Closing', 'f1976e75-5322-4885-8247-dead1e849a11'::uuid, 'covers/import-20261021/4e452b75-7093-49a1-8f7b-1c2ddcbbfed8.png')
  )
  select count(*)
    into mismatch_count
  from expected e
  where (
      select count(*)
      from public.journey_steps js
      where js.archived_at is null
        and js.title = e.title
    ) <> 1
    or not exists (
      select 1
      from public.journey_steps js
      where js.archived_at is null
        and js.title = e.title
        and js.stable_key = e.stable_key
    );

  if mismatch_count <> 0 then
    raise exception 'Storage import aborted: % official journey-step mappings are missing or ambiguous.', mismatch_count;
  end if;

  with expected(title, stable_key, cover_path) as (
    values
    ('Self Brand & Posicionamento', 'b3407b6f-6fb6-4e8e-b434-f3015597b7d3'::uuid, 'covers/import-20261021/d84294b5-aaec-4547-8bc1-48f656cb1af9.png'),
    ('Tomada de Decisão Profissional', '7a57b6bb-94b9-4b1f-b42a-7eac4410df18'::uuid, 'covers/import-20261021/d0198946-a54f-4ff0-9acc-c5abe73c33e2.png'),
    ('Mapa de Esclarecimento', '7789ee31-bff4-4766-a178-9037d5255d10'::uuid, 'covers/import-20261021/9861abbb-d96a-47c0-9bfa-908a391dabd0.png'),
    ('Onboarding RISE', '9f63aace-2568-4af8-a177-95324e2133e8'::uuid, 'covers/import-20261021/91206845-c7a8-4913-95c6-e3b79e70ebc4.png'),
    ('Identity Session', '5ccc5982-819a-4883-88b1-ca46685c384f'::uuid, 'covers/import-20261021/2e3a7727-80bd-44a3-bc3f-7744114007a2.png'),
    ('Questionário do perfil comportamental', '7d2d3d63-9fc4-4d7a-a1c0-6e32a5c91c50'::uuid, 'covers/import-20261021/33e6e4ea-f693-4910-aaba-cb6850a9ea23.png'),
    ('1:1 Direção', 'c0fd9fa4-0c5c-437b-bad0-b8f33a658183'::uuid, 'covers/import-20261021/87f24adf-922f-4a37-bd43-fb799c586815.png'),
    ('Consciência & Leitura de Ambiente', '3aa09845-fa81-4097-b73f-710b14f7a5d1'::uuid, 'covers/import-20261021/40767b08-908b-4d26-ac04-1f708d886192.png'),
    ('O Novo Profissional', 'a81c13da-2a9a-4dd4-a0dc-bd482cea60da'::uuid, 'covers/import-20261021/e3dc914e-78ab-4490-a147-fc73ea8a4b39.png'),
    ('Competências do Próximo Nível', '83a70fbe-ddd7-48f7-b4f8-5eb7d913b523'::uuid, 'covers/import-20261021/633d88d2-3b16-4da8-8126-66fba4c3f084.png'),
    ('IA na Prática', '74c559b9-c222-4503-9fd5-68db4474f98a'::uuid, 'covers/import-20261021/eb4d185c-b5c3-4cc0-92df-d79df8234af0.png'),
    ('Forward Reflection', 'ff9a6db1-8a60-42cc-ba71-73381ac72313'::uuid, 'covers/import-20261021/a1c6b06f-d0c1-49ce-96ae-06bfd91f3420.png'),
    ('Consolidação', 'cf94849b-b919-4e02-8c73-9f84456c798d'::uuid, 'covers/import-20261021/9dad6ee0-d76f-4c59-95a1-4054e7e83335.png'),
    ('AI & Productivity Session', 'b45614c3-648c-45a3-b05f-0167793da7ad'::uuid, 'covers/import-20261021/abe3a098-ed83-471f-80a6-66f7e0080226.png'),
    ('RISE 90 START', '09ab6a52-7214-4cb2-adeb-7b06e35f139d'::uuid, 'covers/import-20261021/c22d076d-6244-4069-91a1-07577b6a93eb.png'),
    ('Next Level Lab', '2f4c1b5f-3473-490c-b11e-03c8128e27f8'::uuid, 'covers/import-20261021/28d27c89-4eda-466b-993a-7ca0497a9334.png'),
    ('Consistência & Accountability', '8e58a530-ddf9-48ea-aa87-1ffe8d1043a7'::uuid, 'covers/import-20261021/83a57309-55f2-4cdb-a2fa-695df7b5cb00.png'),
    ('RISE 90 CHECKPOINT', 'ab5b1e6c-86c8-42d6-9296-19ecc68cd391'::uuid, 'covers/import-20261021/082bec40-6fa6-44c7-ab71-1dcb7465c6a4.png'),
    ('RISE Decision Room', '6908d7b6-450a-4053-8968-c4ddb71b1232'::uuid, 'covers/import-20261021/54658f92-5bc8-4cbc-9364-f2944fc34a25.png'),
    ('Sustentar a Evolução', '2ce08f2c-69e4-4ac9-9b15-888de1b6cb74'::uuid, 'covers/import-20261021/43ece0b4-f574-41ad-a34e-5d1a4b82d022.png'),
    ('RISE Board', '17905347-5e1d-469d-9bde-379379844324'::uuid, 'covers/import-20261021/b47a56f8-c059-456d-8ac0-ec919735732d.png'),
    ('RISE 90 REVIEW', 'cce586eb-dd6e-4683-a0e7-92a4a6fb7f41'::uuid, 'covers/import-20261021/5e5a541d-6a11-4d07-905f-ba2e55aa8fa4.png'),
    ('RISE Closing', 'f1976e75-5322-4885-8247-dead1e849a11'::uuid, 'covers/import-20261021/4e452b75-7093-49a1-8f7b-1c2ddcbbfed8.png')
  )
  update public.journey_steps js
     set cover_path = e.cover_path
    from expected e
   where js.archived_at is null
     and js.title = e.title
     and js.stable_key = e.stable_key
     and js.cover_path is distinct from e.cover_path;

  with expected(title, stable_key, cover_path) as (
    values
    ('Self Brand & Posicionamento', 'b3407b6f-6fb6-4e8e-b434-f3015597b7d3'::uuid, 'covers/import-20261021/d84294b5-aaec-4547-8bc1-48f656cb1af9.png'),
    ('Tomada de Decisão Profissional', '7a57b6bb-94b9-4b1f-b42a-7eac4410df18'::uuid, 'covers/import-20261021/d0198946-a54f-4ff0-9acc-c5abe73c33e2.png'),
    ('Mapa de Esclarecimento', '7789ee31-bff4-4766-a178-9037d5255d10'::uuid, 'covers/import-20261021/9861abbb-d96a-47c0-9bfa-908a391dabd0.png'),
    ('Onboarding RISE', '9f63aace-2568-4af8-a177-95324e2133e8'::uuid, 'covers/import-20261021/91206845-c7a8-4913-95c6-e3b79e70ebc4.png'),
    ('Identity Session', '5ccc5982-819a-4883-88b1-ca46685c384f'::uuid, 'covers/import-20261021/2e3a7727-80bd-44a3-bc3f-7744114007a2.png'),
    ('Questionário do perfil comportamental', '7d2d3d63-9fc4-4d7a-a1c0-6e32a5c91c50'::uuid, 'covers/import-20261021/33e6e4ea-f693-4910-aaba-cb6850a9ea23.png'),
    ('1:1 Direção', 'c0fd9fa4-0c5c-437b-bad0-b8f33a658183'::uuid, 'covers/import-20261021/87f24adf-922f-4a37-bd43-fb799c586815.png'),
    ('Consciência & Leitura de Ambiente', '3aa09845-fa81-4097-b73f-710b14f7a5d1'::uuid, 'covers/import-20261021/40767b08-908b-4d26-ac04-1f708d886192.png'),
    ('O Novo Profissional', 'a81c13da-2a9a-4dd4-a0dc-bd482cea60da'::uuid, 'covers/import-20261021/e3dc914e-78ab-4490-a147-fc73ea8a4b39.png'),
    ('Competências do Próximo Nível', '83a70fbe-ddd7-48f7-b4f8-5eb7d913b523'::uuid, 'covers/import-20261021/633d88d2-3b16-4da8-8126-66fba4c3f084.png'),
    ('IA na Prática', '74c559b9-c222-4503-9fd5-68db4474f98a'::uuid, 'covers/import-20261021/eb4d185c-b5c3-4cc0-92df-d79df8234af0.png'),
    ('Forward Reflection', 'ff9a6db1-8a60-42cc-ba71-73381ac72313'::uuid, 'covers/import-20261021/a1c6b06f-d0c1-49ce-96ae-06bfd91f3420.png'),
    ('Consolidação', 'cf94849b-b919-4e02-8c73-9f84456c798d'::uuid, 'covers/import-20261021/9dad6ee0-d76f-4c59-95a1-4054e7e83335.png'),
    ('AI & Productivity Session', 'b45614c3-648c-45a3-b05f-0167793da7ad'::uuid, 'covers/import-20261021/abe3a098-ed83-471f-80a6-66f7e0080226.png'),
    ('RISE 90 START', '09ab6a52-7214-4cb2-adeb-7b06e35f139d'::uuid, 'covers/import-20261021/c22d076d-6244-4069-91a1-07577b6a93eb.png'),
    ('Next Level Lab', '2f4c1b5f-3473-490c-b11e-03c8128e27f8'::uuid, 'covers/import-20261021/28d27c89-4eda-466b-993a-7ca0497a9334.png'),
    ('Consistência & Accountability', '8e58a530-ddf9-48ea-aa87-1ffe8d1043a7'::uuid, 'covers/import-20261021/83a57309-55f2-4cdb-a2fa-695df7b5cb00.png'),
    ('RISE 90 CHECKPOINT', 'ab5b1e6c-86c8-42d6-9296-19ecc68cd391'::uuid, 'covers/import-20261021/082bec40-6fa6-44c7-ab71-1dcb7465c6a4.png'),
    ('RISE Decision Room', '6908d7b6-450a-4053-8968-c4ddb71b1232'::uuid, 'covers/import-20261021/54658f92-5bc8-4cbc-9364-f2944fc34a25.png'),
    ('Sustentar a Evolução', '2ce08f2c-69e4-4ac9-9b15-888de1b6cb74'::uuid, 'covers/import-20261021/43ece0b4-f574-41ad-a34e-5d1a4b82d022.png'),
    ('RISE Board', '17905347-5e1d-469d-9bde-379379844324'::uuid, 'covers/import-20261021/b47a56f8-c059-456d-8ac0-ec919735732d.png'),
    ('RISE 90 REVIEW', 'cce586eb-dd6e-4683-a0e7-92a4a6fb7f41'::uuid, 'covers/import-20261021/5e5a541d-6a11-4d07-905f-ba2e55aa8fa4.png'),
    ('RISE Closing', 'f1976e75-5322-4885-8247-dead1e849a11'::uuid, 'covers/import-20261021/4e452b75-7093-49a1-8f7b-1c2ddcbbfed8.png')
  )
  select count(*)
    into mapped_count
  from expected e
  join public.journey_steps js
    on js.archived_at is null
   and js.title = e.title
   and js.stable_key = e.stable_key
   and js.cover_path = e.cover_path;

  if mapped_count <> 23 then
    raise exception 'Storage import aborted: expected 23 final cover mappings, found %.', mapped_count;
  end if;

  if (
    select count(*)
    from public.journey_steps js
    where js.archived_at is null
      and js.title = 'Next Level Lab, Consistência'
      and js.stable_key = '9cf07bef-1098-4c29-9cfb-ceb7fb545e5d'::uuid
      and js.cover_path is null
  ) <> 1 then
    raise exception 'Storage import aborted: Next Level Lab, Consistência must remain uniquely mapped with no cover.';
  end if;
end
$$;


