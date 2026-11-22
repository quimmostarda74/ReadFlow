-- =====================================================================
-- ReadFlow 1.11: ativa no servidor os Flows, as Críticas Elaboradíssimas e o «Quero ler» nos perfis
-- CORRE ISTO SE OS FLOWS / CRÍTICAS NÃO FUNCIONAM. Serve mesmo que já tenhas corrido o da 1.9 (é seguro repetir).
-- Supabase > SQL Editor > New query > cola TUDO > Run.
-- Não mexe em contas, perfis, pedidos, partilhas existentes, capas, cofre nem no código de convite.
-- Depois, na app: Amigos > «Testar o servidor» deve dizer «Tudo ativo no servidor».
-- =====================================================================

-- 1) Flows: um por pessoa e por atividade ------------------------------------------------------
create table if not exists public.activity_flows (
  owner_id     uuid not null references public.profiles(id) on delete cascade,      -- dono da atividade
  activity_key text not null check (char_length(activity_key) <= 60),
  user_id      uuid not null references public.profiles(id) on delete cascade,      -- quem deu o Flow
  author_name  text not null default '' check (char_length(author_name) <= 40),
  created_at   timestamptz not null default now(),
  primary key (owner_id, activity_key, user_id)
);
create index if not exists activity_flows_owner_idx on public.activity_flows (owner_id);

-- 2) Críticas Elaboradíssimas ---------------------------------------------------------------------
create table if not exists public.activity_comments (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  activity_key text not null check (char_length(activity_key) <= 60),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  author_name  text not null default '' check (char_length(author_name) <= 40),
  body         text not null check (char_length(body) between 1 and 600),
  created_at   timestamptz not null default now()
);
create index if not exists activity_comments_owner_idx on public.activity_comments (owner_id, activity_key);

alter table public.activity_flows enable row level security;
alter table public.activity_comments enable row level security;
revoke all on public.activity_flows from anon;
revoke all on public.activity_comments from anon;
grant select, insert, delete on public.activity_flows to authenticated;
grant select, insert, delete on public.activity_comments to authenticated;

-- Quem vê e quem reage: o dono, o autor e os seguidores aprovados do dono (se ele deixar a atividade visível em Privacidade).
drop policy if exists flows_select on public.activity_flows;
create policy flows_select on public.activity_flows for select to authenticated
  using (user_id = auth.uid() or owner_id = auth.uid() or public.can_view(owner_id, 'activity'));
drop policy if exists flows_insert on public.activity_flows;
create policy flows_insert on public.activity_flows for insert to authenticated
  with check (user_id = auth.uid() and (owner_id = auth.uid() or public.can_view(owner_id, 'activity')));
drop policy if exists flows_delete on public.activity_flows;
create policy flows_delete on public.activity_flows for delete to authenticated using (user_id = auth.uid());

drop policy if exists comments_select on public.activity_comments;
create policy comments_select on public.activity_comments for select to authenticated
  using (user_id = auth.uid() or owner_id = auth.uid() or public.can_view(owner_id, 'activity'));
drop policy if exists comments_insert on public.activity_comments;
create policy comments_insert on public.activity_comments for insert to authenticated
  with check (user_id = auth.uid() and (owner_id = auth.uid() or public.can_view(owner_id, 'activity')));
drop policy if exists comments_delete on public.activity_comments;        -- apaga o autor ou o dono da atividade (moderação)
create policy comments_delete on public.activity_comments for delete to authenticated using (user_id = auth.uid() or owner_id = auth.uid());

-- 3) Limites por hora (evita abusos) ----------------------------------------------------------------
create or replace function public.interactions_limit() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'activity_comments' then
    if (select count(*) from public.activity_comments where user_id = new.user_id and created_at > now() - interval '1 hour') >= 40 then raise exception 'rate_limit'; end if;
  else
    if (select count(*) from public.activity_flows where user_id = new.user_id and created_at > now() - interval '1 hour') >= 200 then raise exception 'rate_limit'; end if;
  end if;
  return new;
end $$;
drop trigger if exists comments_limit_trg on public.activity_comments;
create trigger comments_limit_trg before insert on public.activity_comments for each row execute function public.interactions_limit();
drop trigger if exists flows_limit_trg on public.activity_flows;
create trigger flows_limit_trg before insert on public.activity_flows for each row execute function public.interactions_limit();

-- 4) A secção «Quero ler» passa a ser aceite nas partilhas -------------------------------------
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.shared'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%section%' loop
    execute format('alter table public.shared drop constraint %I', c.conname);
  end loop;
  alter table public.shared add constraint shared_section_check
    check (section in ('bio','reading','finished','favorites','recommendations','wantToRead','achievements','activity','stats'));
end $$;

-- 5) As capas dos livros de «Quero ler» também se veem (só se já existir a tabela das capas, da versão 1.4) ----
do $$
begin
  if to_regclass('public.covers') is not null and to_regprocedure('public.can_view_any(uuid, text[])') is not null then
    drop policy if exists covers_select on public.covers;
    create policy covers_select on public.covers for select to authenticated
      using (user_id = auth.uid() or public.can_view_any(user_id, array['reading','finished','favorites','recommendations','wantToRead']));
  end if;
end $$;

-- 6) Pede ao servidor para reconhecer já as tabelas novas (sem isto pode demorar a «ver» as tabelas criadas)
notify pgrst, 'reload schema';
