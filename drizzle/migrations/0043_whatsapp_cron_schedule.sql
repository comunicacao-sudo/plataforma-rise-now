-- Agendamento das notificações de WhatsApp (rise-cron) a cada 10 minutos.
-- O segredo é gerado dentro do banco e guardado no Vault: ninguém precisa
-- copiar ou colar o valor. A Edge Function lê o mesmo segredo por
-- public.rise_cron_secret(), executável apenas pelo service_role.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'rise_cron_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'rise_cron_secret',
      'Segredo do agendamento de notificações de WhatsApp (rise-cron)'
    );
  end if;
end $$;

create or replace function public.rise_cron_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'rise_cron_secret' limit 1
$$;

revoke all on function public.rise_cron_secret() from public, anon, authenticated;
grant execute on function public.rise_cron_secret() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'rise-whatsapp-notificacoes';

select cron.schedule(
  'rise-whatsapp-notificacoes',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := 'https://riakceytqrlvdcgcwfdx.supabase.co/functions/v1/rise-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rise_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
