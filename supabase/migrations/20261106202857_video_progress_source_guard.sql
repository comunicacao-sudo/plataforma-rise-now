-- O cliente informa a versão que realmente estava no player. A trava impede
-- atribuir o progresso de um vídeo antigo ao substituto durante uma edição.
create function public.record_stage_video_progress(p_user_id uuid,p_content_id uuid,p_current integer,p_duration integer,p_ended boolean,p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare revision_value integer; source jsonb; result jsonb;
begin
 select source_revision into revision_value from public.journey_stage_contents where id=p_content_id for share;
 if revision_value is null or p_revision is null or revision_value<>p_revision then raise exception 'A gravação foi atualizada. Reabra a aula para continuar.'; end if;
 source:=private.authorized_stage_video(p_user_id,p_content_id);
 if source is null then raise exception 'Vídeo não liberado para este acesso.'; end if;
 result:=public.record_stage_video_progress(p_user_id,p_content_id,p_current,p_duration,p_ended);
 return result||jsonb_build_object('enrollmentId',source->>'enrollmentId','stepKey',source->>'stepKey');
end $$;
revoke all on function public.record_stage_video_progress(uuid,uuid,integer,integer,boolean,integer) from public,anon,authenticated;
grant execute on function public.record_stage_video_progress(uuid,uuid,integer,integer,boolean,integer) to service_role;
