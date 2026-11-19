-- Separate voting permission; grants no Bethel role or electoral write access.
create table voting_private.results_readers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table voting_private.results_readers enable row level security;
revoke all on voting_private.results_readers from public, anon, authenticated;

create function voting_private.can_read_results()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (voting_private.is_admin() or exists(
    select 1 from voting_private.results_readers where user_id=auth.uid() and enabled
  ));
$$;
revoke all on function voting_private.can_read_results() from public, anon, authenticated;

create function public.voting_results_access()
returns boolean language sql stable security definer set search_path='' as $$
  select voting_private.can_read_results();
$$;

create function public.voting_results_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not voting_private.can_read_results() then
    raise exception 'Acceso de consulta de resultados requerido' using errcode='42501';
  end if;
  return jsonb_build_object(
    'elections',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'election_year',e.election_year,'title',e.title
    ) order by e.election_year desc) from public.voting_elections e
      where exists(select 1 from public.voting_rounds r where r.election_id=e.id and r.status='closed')),'[]'::jsonb),
    'rounds',coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'election_id',r.election_id,'round_kind',r.round_kind,'round_number',r.round_number
    ) order by r.created_at desc,r.id) from public.voting_rounds r where r.status='closed'),'[]'::jsonb)
  );
end;
$$;

create function public.voting_results_read(p_round_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rnd public.voting_rounds%rowtype;
begin
  if not voting_private.can_read_results() then
    raise exception 'Acceso de consulta de resultados requerido' using errcode='42501';
  end if;
  select * into rnd from public.voting_rounds where id=p_round_id and status='closed';
  if rnd.id is null then raise exception 'Resultados disponibles al cerrar la ronda' using errcode='42501'; end if;
  return jsonb_build_object(
    'round',jsonb_build_object('id',rnd.id,'election_id',rnd.election_id,'round_kind',rnd.round_kind,
      'round_number',rnd.round_number,'status','closed','male_slots',rnd.male_slots,'female_slots',rnd.female_slots,
      'voter_count',(select count(*) from voting_private.participation where round_id=rnd.id)),
    'rows',coalesce((select jsonb_agg(jsonb_build_object('candidate_id',c.id,'full_name',c.full_name,
      'gender',c.gender,'vote_count',coalesce(t.vote_count,0)) order by c.gender,coalesce(t.vote_count,0) desc,c.full_name)
      from public.voting_round_candidates rc join public.voting_candidates c on c.id=rc.candidate_id
      left join public.voting_tallies t on t.round_id=rc.round_id and t.candidate_id=rc.candidate_id
      where rc.round_id=rnd.id),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.voting_results_access(), public.voting_results_snapshot(), public.voting_results_read(uuid)
  from public, anon, authenticated;
grant execute on function public.voting_results_access(), public.voting_results_snapshot(), public.voting_results_read(uuid)
  to authenticated;
