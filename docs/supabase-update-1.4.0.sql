-- =====================================================================
-- ReadFlow 1.4: capas dos livros visíveis para os amigos
-- Para quem JÁ tem o servidor a funcionar: Supabase > SQL Editor > New query > cola TUDO > Run.
-- Não mexe em contas, perfis, pedidos, partilhas nem no código de convite. É seguro voltar a correr.
-- =====================================================================

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
