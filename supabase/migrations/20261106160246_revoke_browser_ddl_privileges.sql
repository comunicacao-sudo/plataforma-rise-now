-- O visitante usa apenas as páginas estáticas e o Supabase Auth, não as tabelas.
revoke all privileges on all tables in schema public from anon;

-- RLS não protege operações de tabela como TRUNCATE. O navegador só precisa de CRUD.
revoke truncate, trigger, references on all tables in schema public from authenticated;
do $$ begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute 'revoke maintain on all tables in schema public from authenticated';
  end if;
end $$;

-- Tabelas futuras criadas pelo papel de migração exigem grants explícitos.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
