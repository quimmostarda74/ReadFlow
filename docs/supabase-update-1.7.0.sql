-- =====================================================================
-- ReadFlow 1.7: cofre da ligação ao Google (para entrares noutro computador sem ligar o Google outra vez)
-- Supabase > SQL Editor > New query > cola TUDO > Run. É seguro voltar a correr.
-- Não mexe em contas, perfis, pedidos, partilhas, capas nem no código de convite.
-- A tabela guarda só um texto CIFRADO no computador da pessoa (com a palavra-passe dela): nem tu, como administrador, o consegues ler.
-- Se não correres isto, tudo funciona na mesma; só é preciso ligar o Google uma vez em cada computador.
-- =====================================================================

create table if not exists public.vault (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  blob       text not null check (char_length(blob) <= 4000),
  updated_at timestamptz not null default now()
);

alter table public.vault enable row level security;
revoke all on public.vault from anon;
grant select, insert, update, delete on public.vault to authenticated;

drop policy if exists vault_select on public.vault;
create policy vault_select on public.vault for select to authenticated using (user_id = auth.uid());
drop policy if exists vault_insert on public.vault;
create policy vault_insert on public.vault for insert to authenticated with check (user_id = auth.uid());
drop policy if exists vault_update on public.vault;
create policy vault_update on public.vault for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists vault_delete on public.vault;
create policy vault_delete on public.vault for delete to authenticated using (user_id = auth.uid());
