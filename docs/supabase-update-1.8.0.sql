-- =====================================================================
-- ReadFlow 1.8 (OPCIONAL): mais espaço por pessoa para Introduções Gerais longas e fotografias da atividade
-- Supabase > SQL Editor > New query > cola TUDO > Run. Seguro voltar a correr. Não mexe em dados, contas nem no código de convite.
-- A versão 1.8 funciona sem isto. Só é útil para quem tem muitos livros com capa + textos longos + fotografias (mais de 600 entradas).
-- =====================================================================

create or replace function public.covers_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.covers where user_id = new.user_id) >= 2000 then
    raise exception 'too_many_covers';
  end if;
  return new;
end $$;
