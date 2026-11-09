-- Mantém a evidência da operação sem perpetuar cópias completas do acesso excluído.
do $$
declare definition text; marker text:='delete from public.admin_trash where id=item.id;';
begin
 select pg_get_functiondef('public.purge_expired_trash(text)'::regprocedure) into definition;
 if position(marker in definition)=0 then
  raise exception 'A função de retenção mudou; revise a migração.';
 end if;
 execute replace(definition,marker,$replacement$
   if item.resource_type='access' then
    update public.audit_log set payload=jsonb_build_object('type','access','purged',true)
    where target in(item.resource_id::text,item.snapshot->>'userId',source->>'email');
   end if;
   delete from public.admin_trash where id=item.id;
 $replacement$);
end $$;
