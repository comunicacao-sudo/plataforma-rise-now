create function public.order_stage_contents(p_pillar uuid,p_step uuid,p_expected uuid[],p_ids uuid[]) returns void
language plpgsql security invoker set search_path='' as $$
declare current_ids uuid[];
begin
 perform 1 from public.journey_stage_contents where pillar_id=p_pillar and step_key=p_step and active=true order by id for update;
 select array_agg(id order by position,id) into current_ids from public.journey_stage_contents where pillar_id=p_pillar and step_key=p_step and active=true;
 if current_ids is distinct from p_expected then raise exception 'Os conteúdos mudaram. Atualize a lista e tente novamente.';end if;
 if cardinality(p_ids) is distinct from cardinality(current_ids) or (select count(distinct id) from unnest(p_ids)id)<>cardinality(p_ids) or exists(select 1 from unnest(p_ids)id where not id=any(current_ids)) then raise exception 'Ordem inválida.';end if;
 update public.journey_stage_contents c set position=items.position-1,updated_at=now() from unnest(p_ids) with ordinality items(id,position) where c.id=items.id;
end $$;
revoke all on function public.order_stage_contents(uuid,uuid,uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.order_stage_contents(uuid,uuid,uuid[],uuid[]) to service_role;
