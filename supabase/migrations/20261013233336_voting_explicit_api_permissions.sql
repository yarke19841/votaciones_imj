-- Supabase defaults can grant anon/authenticated EXECUTE directly, so revoking
-- PUBLIC alone is insufficient. Keep only the intended narrow public API.
do $$
declare fn record;
begin
 for fn in select p.oid::regprocedure signature,p.proname
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'voting_%'
 loop
   execute format('revoke all on function %s from public, anon, authenticated',fn.signature);
   execute format('grant execute on function %s to authenticated',fn.signature);
   if fn.proname in ('voting_enter','voting_ballot','voting_submit','voting_photo_visible') then
     execute format('grant execute on function %s to anon',fn.signature);
   end if;
 end loop;
end $$;
revoke all on all functions in schema voting_private from public,anon,authenticated;
