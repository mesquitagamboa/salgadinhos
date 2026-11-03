alter table public.loja_config add column horarios_semana jsonb not null default '{}';
grant update(horarios_semana) on public.loja_config to authenticated;

create or replace function lanchonete_private.validar_abertura() returns trigger language plpgsql security invoker set search_path='' as $$
declare dia jsonb;
begin
 if new.aberta and (length(trim(new.endereco))<5 or length(trim(new.horarios))<3 or new.antecedencia_horas is null) then raise exception 'Preencha endereço, horários e antecedência antes de abrir.'; end if;
 if new.entrega_ativa and length(trim(new.area_entrega))<3 then raise exception 'Informe a área atendida para habilitar entregas.'; end if;
 if new.aberta and not exists(select 1 from public.produtos where is_ativo and not esgotado and preco>0) then raise exception 'Publique pelo menos um produto com preço válido antes de abrir.'; end if;
 if jsonb_typeof(new.horarios_semana)<>'object' then raise exception 'Agenda inválida.'; end if;
 for dia in select value from jsonb_each(new.horarios_semana) loop
  if dia<>'null'::jsonb and (jsonb_typeof(dia)<>'object' or coalesce(dia->>'abre','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(dia->>'fecha','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (dia->>'abre')>=(dia->>'fecha')) then raise exception 'Confira os horários de abertura e fechamento.'; end if;
 end loop;
 return new;
end $$;
create or replace function lanchonete_private.encomendar(p_nome text,p_telefone text,p_metodo text,p_itens jsonb,p_chave uuid,p_agendamento timestamptz,p_entrega text,p_endereco text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.loja_config; r jsonb; p public.produtos; item jsonb; precisa_agendar boolean:=false; t numeric:=0; dia jsonb; hora time;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_chave::text,0));
 select * into c from public.loja_config where id=1 for share;
 -- Retry returns the original order even after closing; the original function checks the phone.
 if exists(select 1 from public.pedidos where chave_idempotencia=p_chave) then
   return lanchonete_private.criar_pedido(p_nome,p_telefone,p_metodo,p_itens,p_chave);
 end if;
 if p_entrega is null or p_entrega not in ('retirada','entrega') then raise exception 'Escolha retirada ou entrega.'; end if;
 if p_entrega='entrega' then
   if not c.entrega_ativa then raise exception 'Entregas indisponíveis no momento.'; end if;
   if p_endereco is null or length(trim(p_endereco)) not between 10 and 500 then raise exception 'Informe endereço completo para entrega.'; end if;
   t:=c.taxa_entrega;
 end if;
 if jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'Carrinho inválido.'; end if;
 for item in select * from jsonb_array_elements(p_itens) loop
   select * into p from public.produtos where id=(item->>'produto_id')::uuid for share;
   if not found or not p.is_ativo or p.esgotado or p.preco is null then raise exception 'Um produto está indisponível ou sem preço definido.'; end if;
   precisa_agendar:=precisa_agendar or p.sob_encomenda;
 end loop;
 if p_agendamento is null or c.antecedencia_horas is null then raise exception 'Escolha a data e o horário da encomenda.'; end if;
 if p_agendamento < now()+make_interval(hours=>c.antecedencia_horas) or p_agendamento>now()+interval '90 days' then raise exception 'Respeite a antecedência e agende para até 90 dias.'; end if;
 dia:=c.horarios_semana->(extract(dow from p_agendamento at time zone 'America/Fortaleza')::integer)::text;
 hora:=(p_agendamento at time zone 'America/Fortaleza')::time;
 if dia is null or dia='null'::jsonb or hora<(dia->>'abre')::time or hora>(dia->>'fecha')::time then raise exception 'Escolha um horário de atendimento da loja.'; end if;
 r:=lanchonete_private.criar_pedido(p_nome,p_telefone,p_metodo,p_itens,p_chave);
 update public.pedidos set agendado_para=p_agendamento,tipo_entrega=p_entrega,endereco_entrega=case when p_entrega='entrega' then trim(p_endereco) else null end,taxa_entrega=t,total=total+t where chave_idempotencia=p_chave;
 return r||jsonb_build_object('total',(r->>'total')::numeric+t);
end $$;