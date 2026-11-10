-- =====================================================================
-- ReadFlow: esquema do sistema de amigos (Supabase / PostgreSQL)
-- Como usar: Supabase > SQL Editor > New query > cola TUDO > Run.
-- É seguro voltar a correr (usa "if not exists" / "or replace").
-- A privacidade é aplicada AQUI, no servidor (Row Level Security).
-- =====================================================================

-- 1) Perfis -------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  handle_name    text    not null check (handle_name ~ '^[a-z0-9_]{3,16}$'),
  handle_number  integer not null check (handle_number between 100000 and 999999),
  display_name   text    not null default '' check (char_length(display_name) <= 40),
  avatar         text    check (avatar is null or char_length(avatar) <= 40000),
  privacy        jsonb   not null default
    '{"bio":true,"reading":true,"finished":true,"favorites":true,"recommendations":true,"achievements":true,"activity":true,"stats":true}'::jsonb,
  updated_at     timestamptz not null default now(),
  unique (handle_name, handle_number)
);

-- 1b) Configuração (código de convite opcional) ----------------------------
-- Para que só os teus amigos criem conta, define um código e partilha-o em privado:
--   insert into public.app_config (key, value) values ('invite_code', 'O-TEU-CODIGO')
--   on conflict (key) do update set value = excluded.value;
-- Para deixar de exigir código:  delete from public.app_config where key = 'invite_code';
create table if not exists public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;     -- sem políticas: ninguém a lê, só as funções do servidor
revoke all on public.app_config from anon, authenticated;

-- 2) Quem segue quem (precisa de aprovação) -----------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','accepted')),
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

-- 3) O que cada pessoa partilha (uma linha por secção) --------------------
create table if not exists public.shared (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  section    text not null check (section in ('bio','reading','finished','favorites','recommendations','achievements','activity','stats')),
  payload    jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, section),
  check (octet_length(payload::text) < 300000)
);

-- 4) Segurança ----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.follows  enable row level security;
alter table public.shared   enable row level security;

revoke all on public.profiles, public.follows, public.shared from anon;
revoke insert, update, delete on public.profiles from authenticated;
revoke insert, update on public.follows from authenticated;
grant  select on public.profiles to authenticated;
grant  update (display_name, avatar, privacy, updated_at) on public.profiles to authenticated;  -- o ID (nome#número) nunca muda
grant  select, delete on public.follows to authenticated;
grant  select, insert, update, delete on public.shared to authenticated;

-- Só vês o perfil de quem tem uma relação contigo (a seguir, seguidor ou pedido).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (select 1 from public.follows f
               where (f.follower_id = auth.uid() and f.followee_id = profiles.id)
                  or (f.followee_id = auth.uid() and f.follower_id = profiles.id))
  );
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());
-- Deixar de seguir, recusar ou remover seguidor: qualquer das duas pessoas pode apagar a relação.
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

-- Só um seguidor APROVADO vê uma secção, e só se o dono a deixou ativa.
create or replace function public.can_view(target uuid, sec text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.follows f
    join public.profiles p on p.id = f.followee_id
    where f.follower_id = auth.uid()
      and f.followee_id = target
      and f.status = 'accepted'
      and coalesce((p.privacy ->> sec)::boolean, false)
  );
$$;

drop policy if exists shared_select on public.shared;
create policy shared_select on public.shared for select to authenticated
  using (user_id = auth.uid() or public.can_view(user_id, section));
drop policy if exists shared_insert on public.shared;
create policy shared_insert on public.shared for insert to authenticated with check (user_id = auth.uid());
drop policy if exists shared_update on public.shared;
create policy shared_update on public.shared for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists shared_delete on public.shared;
create policy shared_delete on public.shared for delete to authenticated using (user_id = auth.uid());

-- 5) Funções (as únicas formas de criar perfis e pedidos) ----------------
drop function if exists public.claim_profile(text, integer, text);
create or replace function public.claim_profile(p_name text, p_number integer, p_display text, p_invite text default '')
returns public.profiles language plpgsql security definer set search_path = public as $$
declare r public.profiles; need text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select value into need from public.app_config where key = 'invite_code';
  if need is not null and need <> '' and coalesce(p_invite, '') <> need
     and not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'invite_invalid';
  end if;
  insert into public.profiles (id, handle_name, handle_number, display_name)
  values (auth.uid(), lower(p_name), p_number, left(coalesce(p_display, ''), 40))
  on conflict (id) do update set display_name = excluded.display_name
  returning * into r;
  return r;
exception when unique_violation then
  raise exception 'handle_taken';
end $$;

create or replace function public.find_profile(p_name text, p_number integer)
returns table (id uuid, handle_name text, handle_number integer, display_name text, avatar text)
language sql security definer stable set search_path = public as $$
  select p.id, p.handle_name, p.handle_number, p.display_name, p.avatar
  from public.profiles p
  where auth.uid() is not null and p.handle_name = lower(p_name) and p.handle_number = p_number;
$$;

create or replace function public.request_follow(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); recent integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if target = me then raise exception 'self'; end if;
  if not exists (select 1 from public.profiles where id = target) then raise exception 'not_found'; end if;
  select count(*) into recent from public.follows where follower_id = me and created_at > now() - interval '1 hour';
  if recent >= 30 then raise exception 'rate_limited'; end if;
  insert into public.follows (follower_id, followee_id, status) values (me, target, 'pending') on conflict do nothing;
  return (select status from public.follows where follower_id = me and followee_id = target);
end $$;

create or replace function public.respond_follow(p_follower uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_accept then
    update public.follows set status = 'accepted' where follower_id = p_follower and followee_id = auth.uid();
  else
    delete from public.follows where follower_id = p_follower and followee_id = auth.uid();
  end if;
end $$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = auth.uid();   -- apaga em cadeia perfil, pedidos e dados partilhados
end $$;

-- Só pessoas com sessão iniciada podem chamar estas funções.
revoke execute on function public.can_view(uuid, text), public.claim_profile(text, integer, text, text),
  public.find_profile(text, integer), public.request_follow(uuid), public.respond_follow(uuid, boolean),
  public.delete_my_account() from public, anon;
grant execute on function public.can_view(uuid, text), public.claim_profile(text, integer, text, text),
  public.find_profile(text, integer), public.request_follow(uuid), public.respond_follow(uuid, boolean),
  public.delete_my_account() to authenticated;

-- 6) Capas dos livros (versão 1.4) ----------------------------------------
create table if not exists public.covers (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  ck         text not null check (char_length(ck) <= 40),          -- id da capa (aleatório)
  data       text not null check (char_length(data) <= 40000),     -- miniatura 96x144 (data URL)
  updated_at timestamptz not null default now(),
  primary key (user_id, ck)
);

alter table public.covers enable row level security;
revoke all on public.covers from anon;
grant select, insert, update, delete on public.covers to authenticated;

-- Só um seguidor aprovado vê as capas, e só se o dono partilha pelo menos uma lista de livros.
create or replace function public.can_view_any(target uuid, secs text[])
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.follows f
    join public.profiles p on p.id = f.followee_id
    where f.follower_id = auth.uid()
      and f.followee_id = target
      and f.status = 'accepted'
      and exists (select 1 from unnest(secs) s where coalesce((p.privacy ->> s)::boolean, false))
  );
$$;
revoke execute on function public.can_view_any(uuid, text[]) from public, anon;
grant execute on function public.can_view_any(uuid, text[]) to authenticated;

drop policy if exists covers_select on public.covers;
create policy covers_select on public.covers for select to authenticated
  using (user_id = auth.uid() or public.can_view_any(user_id, array['reading','finished','favorites','recommendations']));
drop policy if exists covers_insert on public.covers;
create policy covers_insert on public.covers for insert to authenticated with check (user_id = auth.uid());
drop policy if exists covers_update on public.covers;
create policy covers_update on public.covers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists covers_delete on public.covers;
create policy covers_delete on public.covers for delete to authenticated using (user_id = auth.uid());

-- Limite de capas por pessoa (evita abusos).
create or replace function public.covers_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.covers where user_id = new.user_id) >= 600 then
    raise exception 'too_many_covers';
  end if;
  return new;
end $$;
drop trigger if exists covers_limit_trg on public.covers;
create trigger covers_limit_trg before insert on public.covers for each row execute function public.covers_limit();
