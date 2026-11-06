create index journey_content_markers_content_idx on public.journey_content_markers(content_id);
create function private.viewer_stage_media_path(p_content_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when private.has_platform_access() then private.authorized_stage_video((select auth.uid()),p_content_id)->>'mediaPath' end
$$;
revoke all on function private.viewer_stage_media_path(uuid) from public,anon;
grant execute on function private.viewer_stage_media_path(uuid) to authenticated,service_role;
create or replace function public.get_journey_media_path(_step_key uuid) returns text
language sql stable security invoker set search_path='' as $$
 select case when private.has_platform_access() then coalesce(private.viewer_stage_media_path(_step_key),private.get_journey_media_path(_step_key)) end
$$;
revoke all on function public.get_journey_media_path(uuid) from public,anon;
grant execute on function public.get_journey_media_path(uuid) to authenticated,service_role;
