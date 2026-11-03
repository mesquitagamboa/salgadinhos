-- Additive migration: keeps historical orders and archives only the initial demonstration menu.
alter table public.produtos alter column preco drop not null;
alter table public.produtos add column unidade text not null default 'unidade' check(unidade in ('unidade','kit','cento','lata'));
alter table public.produtos add column unidades_pacote integer not null default 1 check(unidades_pacote between 1 and 1000);
alter table public.produtos add column sob_encomenda boolean not null default false;
alter table public.produtos add column esgotado boolean not null default false;
alter table public.produtos add column ingredientes text not null default '';
alter table public.loja_config add column endereco text not null default '';
alter table public.loja_config add column horarios text not null default '';
alter table public.loja_config add column whatsapp text not null default '' check(whatsapp='' or whatsapp ~ '^[0-9]{10,13}$');
alter table public.loja_config add column preparo_minutos integer check(preparo_minutos between 5 and 240);
alter table public.loja_config add column antecedencia_horas integer check(antecedencia_horas between 1 and 720);
alter table public.loja_config add column entrega_ativa boolean not null default false;
alter table public.loja_config add column taxa_entrega numeric(10,2) not null default 0 check(taxa_entrega>=0);
alter table public.loja_config add column area_entrega text not null default '';
alter table public.pedidos add column agendado_para timestamptz;
alter table public.pedidos add column tipo_entrega text not null default 'retirada' check(tipo_entrega in ('retirada','entrega'));
alter table public.pedidos add column endereco_entrega text;
alter table public.pedidos add column taxa_entrega numeric(10,2) not null default 0;
grant insert,update on public.produtos to authenticated;
grant update(endereco,horarios,whatsapp,preparo_minutos,antecedencia_horas,entrega_ativa,taxa_entrega,area_entrega) on public.loja_config to authenticated;
create policy produtos_inserir_equipe on public.produtos for insert to authenticated with check((select lanchonete_private.is_staff()));
create policy produtos_editar_equipe on public.produtos for update to authenticated using((select lanchonete_private.is_staff())) with check((select lanchonete_private.is_staff()));
create function lanchonete_private.validar_abertura() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.aberta and (length(trim(new.endereco))<5 or length(trim(new.horarios))<3 or new.preparo_minutos is null or new.antecedencia_horas is null) then raise exception 'Preencha endereço, horários, preparo e antecedência antes de abrir.'; end if;
 if new.entrega_ativa and length(trim(new.area_entrega))<3 then raise exception 'Informe a área atendida para habilitar entregas.'; end if;
 if new.aberta and not exists(select 1 from public.produtos where is_ativo and not esgotado and preco>0) then raise exception 'Publique pelo menos um produto com preço válido antes de abrir.'; end if;
 return new;
end $$;
revoke all on function lanchonete_private.validar_abertura() from public;
create trigger validar_abertura before update on public.loja_config for each row execute function lanchonete_private.validar_abertura();

update public.produtos set is_ativo=false where nome in ('Clássico da casa','Duplo smash','Crispy chicken','Batata da casa','Batata + refri','Refrigerante gelado','Coxinha cremosa');
insert into public.produtos(nome,descricao,preco,categoria,imagem_url,destaque,unidade,unidades_pacote,sob_encomenda) values
('Coxinha de frango','Um clássico para acompanhar os bons momentos.',null,'Salgados individuais','/logo-sica.png',true,'unidade',1,false),
('Bolinha de queijo','Pequena no tamanho, especial em cada mordida.',null,'Salgados individuais','/logo-sica.png',true,'unidade',1,false),
('Kibe','Sabor marcante para completar a sua seleção.',null,'Salgados individuais','/logo-sica.png',false,'unidade',1,false),
('Empada','Para a pausa do café ou para compartilhar.',null,'Assados','/logo-sica.png',false,'unidade',1,false),
('Kit festa • 50 minis','50 unidades. Informe os sabores desejados nas observações; a equipe confirma a disponibilidade.',null,'Kits e centos','/logo-sica.png',true,'kit',50,true),
('Cento de salgados • 100 minis','100 unidades para reunir quem você gosta. Sabores sujeitos à confirmação da equipe.',null,'Kits e centos','/logo-sica.png',true,'cento',100,true);

create function lanchonete_private.encomendar(p_nome text,p_telefone text,p_metodo text,p_itens jsonb,p_chave uuid,p_agendamento timestamptz,p_entrega text,p_endereco text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.loja_config; r jsonb; p public.produtos; item jsonb; precisa_agendar boolean:=false; t numeric:=0;
begin
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
 if precisa_agendar and (p_agendamento is null or c.antecedencia_horas is null) then raise exception 'Escolha a data e o horário da encomenda.'; end if;
 if p_agendamento is not null and (p_agendamento < now()+make_interval(hours=>case when precisa_agendar then c.antecedencia_horas else 0 end,mins=>case when precisa_agendar then 0 else coalesce(c.preparo_minutos,0) end) or p_agendamento>now()+interval '90 days') then raise exception 'Respeite a antecedência e agende para até 90 dias.'; end if;
 r:=lanchonete_private.criar_pedido(p_nome,p_telefone,p_metodo,p_itens,p_chave);
 update public.pedidos set agendado_para=p_agendamento,tipo_entrega=p_entrega,endereco_entrega=case when p_entrega='entrega' then trim(p_endereco) else null end,taxa_entrega=t,total=total+t where chave_idempotencia=p_chave;
 return r||jsonb_build_object('total',(r->>'total')::numeric+t);
end $$;
revoke all on function lanchonete_private.encomendar(text,text,text,jsonb,uuid,timestamptz,text,text) from public;
grant execute on function lanchonete_private.encomendar(text,text,text,jsonb,uuid,timestamptz,text,text) to anon,authenticated;
-- Close the legacy guest entry point: all orders must pass availability and scheduling validation.
revoke execute on function public.criar_pedido(text,text,text,jsonb,uuid) from anon,authenticated;
revoke execute on function lanchonete_private.criar_pedido(text,text,text,jsonb,uuid) from anon,authenticated;
create function public.encomendar(p_nome text,p_telefone text,p_metodo text,p_itens jsonb,p_chave uuid,p_agendamento timestamptz default null,p_entrega text default 'retirada',p_endereco text default null) returns jsonb language sql security invoker set search_path='' as $$ select lanchonete_private.encomendar(p_nome,p_telefone,p_metodo,p_itens,p_chave,p_agendamento,p_entrega,p_endereco) $$;
revoke all on function public.encomendar(text,text,text,jsonb,uuid,timestamptz,text,text) from public;
grant execute on function public.encomendar(text,text,text,jsonb,uuid,timestamptz,text,text) to anon,authenticated;
