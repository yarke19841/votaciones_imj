-- Preserve historical rows while retiring anonymous access to the old API.
-- Restrictive policies AND the legacy permissive policies: an old USING(true)
-- policy can no longer authorize a non-administrator.
do $migration$
declare relation text; fn record; definition text;
begin
  foreach relation in array array['member','candidate','cast_vote','election','election_member','attendance_voter'] loop
    if to_regclass(format('public.%I',relation)) is null then continue; end if;
    execute format('alter table public.%I enable row level security',relation);
    execute format('revoke all on public.%I from public,anon',relation);
    execute format('create policy legacy_voting_admin_boundary on public.%I as restrictive for all to authenticated using ((select public.voting_storage_admin())) with check ((select public.voting_storage_admin()))',relation);
  end loop;

  -- These two retired endpoints previously executed as owner without checking
  -- the caller. Preserve their administrator behavior, add the missing guard,
  -- and bind every relation to public before fixing the search_path.
  for fn in select p.oid,p.oid::regprocedure as signature,pg_get_functiondef(p.oid) as body
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in('admin_set_active_pool','admin_setup_tie_round_with_attendance')
  loop
    definition := regexp_replace(fn.body, E'\nbegin\n', E'\nbegin\n  if not voting_private.is_admin() then raise exception ''Solo Administración'' using errcode=''42501''; end if;\n', 'i');
    if position('if not voting_private.is_admin()' in definition)=0 then
      raise exception 'No se pudo proteger la función %',fn.signature;
    end if;
    definition := regexp_replace(definition, '\m(from|update|into)\s+(election|candidate|attendance_voter)\M', '\1 public.\2', 'gi');
    execute definition;
    execute format('alter function %s set search_path to %L',fn.signature,'');
  end loop;

  -- Administrative operations always require a session as well as their guard.
  for fn in select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'admin\_%' escape '\'
  loop
    execute format('revoke all on function %s from public,anon',fn.signature);
  end loop;
end;
$migration$;

-- Existing objects remain available to authorized administrators. Public object
-- URLs must stop working too; SELECT RLS alone cannot protect a public bucket.
update storage.buckets set public=false where id='candidate-photo';
create policy legacy_candidate_photo_anon_boundary on storage.objects as restrictive
  for all to anon using(bucket_id<>'candidate-photo') with check(bucket_id<>'candidate-photo');
create policy legacy_candidate_photo_staff_boundary on storage.objects as restrictive
  for all to authenticated
  using(bucket_id<>'candidate-photo' or (select public.voting_storage_admin()))
  with check(bucket_id<>'candidate-photo' or (select public.voting_storage_admin()));

-- An authenticated results-only account is not an active Bethel/calendar user.
-- Keep existing ownership/manager rules; add the missing active-user boundary.
do $migration$
declare relation text; helper text;
begin
  foreach relation in array array['absence_reasons','church_attendance_settings','ministries','calendar_rules','event_rules'] loop
    if to_regclass(format('public.%I',relation)) is null then continue; end if;
    helper := case when relation in('absence_reasons','church_attendance_settings')
      then 'app_security.is_active_bethel_user()' else 'app_security.is_active_calendar_user()' end;
    if to_regprocedure(helper) is null then raise exception 'Falta la función de autorización %',helper; end if;
    execute format('create policy active_account_boundary on public.%I as restrictive for all to authenticated using ((select %s)) with check ((select %s))',relation,helper,helper);
    execute format('revoke all on public.%I from public,anon',relation);
  end loop;
end;
$migration$;
