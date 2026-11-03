alter table public.clientes add column created_at timestamptz not null default now();
alter table public.clientes add column marketing_opt_in boolean not null default false;
alter table public.pedidos add column troco_para numeric(10,2) check(troco_para is null or troco_para>0);
alter table public.pedidos drop constraint if exists pedidos_metodo_pagamento_check;
alter table public.pedidos add constraint pedidos_metodo_pagamento_check check(metodo_pagamento in ('pix','cartao','dinheiro','pix_demo','retirada'));

create function lanchonete_private.encomendar_whatsapp(p_nome text,p_telefone text,p_metodo text,p_itens jsonb,p_chave uuid,p_agendamento timestamptz,p_entrega text,p_endereco text,p_troco numeric default null,p_marketing_opt_in boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.loja_config; r jsonb; p public.produtos; item jsonb; t numeric:=0; dia jsonb; hora time; pedido public.pedidos;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_chave::text,0));
 select * into c from public.loja_config where id=1 for share;
 if exists(select 1 from public.pedidos where chave_idempotencia=p_chave) then
   r:=lanchonete_private.criar_pedido(p_nome,p_telefone,'retirada',p_itens,p_chave);
   select * into pedido from public.pedidos where chave_idempotencia=p_chave;
   if p_marketing_opt_in then update public.clientes set marketing_opt_in=true where id=pedido.cliente_id; end if;
   return r||jsonb_build_object('itens',(select coalesce(jsonb_agg(jsonb_build_object('nome_produto',i.nome_produto,'quantidade',i.quantidade,'observacao',i.observacao,'preco_unitario',i.preco_unitario) order by i.id),'[]'::jsonb) from public.itens_pedido i where i.pedido_id=pedido.id),'tipo_entrega',pedido.tipo_entrega,'endereco_entrega',pedido.endereco_entrega,'taxa_entrega',pedido.taxa_entrega,'agendado_para',pedido.agendado_para,'metodo_pagamento',pedido.metodo_pagamento,'troco_para',pedido.troco_para);
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
 end loop;
 if p_agendamento is null or c.antecedencia_horas is null then raise exception 'Escolha a data e o horário da encomenda.'; end if;
 if p_agendamento < now()+make_interval(hours=>c.antecedencia_horas) or p_agendamento>now()+interval '90 days' then raise exception 'Respeite a antecedência e agende para até 90 dias.'; end if;
 dia:=c.horarios_semana->(extract(dow from p_agendamento at time zone 'America/Fortaleza')::integer)::text;
 hora:=(p_agendamento at time zone 'America/Fortaleza')::time;
 if dia is null or dia='null'::jsonb or hora<(dia->>'abre')::time or hora>(dia->>'fecha')::time then raise exception 'Escolha um horário de atendimento da loja.'; end if;
 if p_metodo='dinheiro' and p_troco is not null and p_troco<0 then raise exception 'Troco inválido.'; end if;
 if p_metodo<>'dinheiro' and p_troco is not null then raise exception 'Troco só pode ser informado para pagamento em dinheiro.'; end if;
 if p_metodo not in ('pix','cartao','dinheiro') then raise exception 'Escolha uma forma de pagamento válida.'; end if;
 r:=lanchonete_private.criar_pedido(p_nome,p_telefone,'retirada',p_itens,p_chave);
 update public.pedidos set metodo_pagamento=p_metodo,agendado_para=p_agendamento,tipo_entrega=p_entrega,endereco_entrega=case when p_entrega='entrega' then trim(p_endereco) else null end,taxa_entrega=t,total=total+t,troco_para=p_troco where chave_idempotencia=p_chave returning * into pedido;
 if p_marketing_opt_in then update public.clientes set marketing_opt_in=true where id=pedido.cliente_id; end if;
 if p_troco is not null and p_troco<pedido.total then raise exception 'O troco precisa cobrir o total do pedido.'; end if;
 return r||jsonb_build_object('total',pedido.total,'itens',(select coalesce(jsonb_agg(jsonb_build_object('nome_produto',i.nome_produto,'quantidade',i.quantidade,'observacao',i.observacao,'preco_unitario',i.preco_unitario) order by i.id),'[]'::jsonb) from public.itens_pedido i where i.pedido_id=pedido.id),'tipo_entrega',pedido.tipo_entrega,'endereco_entrega',pedido.endereco_entrega,'taxa_entrega',pedido.taxa_entrega,'agendado_para',pedido.agendado_para,'metodo_pagamento',pedido.metodo_pagamento,'troco_para',pedido.troco_para);
end $$;
revoke all on function lanchonete_private.encomendar_whatsapp(text,text,text,jsonb,uuid,timestamptz,text,text,numeric,boolean) from public;
grant execute on function lanchonete_private.encomendar_whatsapp(text,text,text,jsonb,uuid,timestamptz,text,text,numeric,boolean) to anon,authenticated;
create function public.encomendar_whatsapp(p_nome text,p_telefone text,p_metodo text,p_itens jsonb,p_chave uuid,p_agendamento timestamptz default null,p_entrega text default 'retirada',p_endereco text default null,p_troco numeric default null,p_marketing_opt_in boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select lanchonete_private.encomendar_whatsapp(p_nome,p_telefone,p_metodo,p_itens,p_chave,p_agendamento,p_entrega,p_endereco,p_troco,p_marketing_opt_in) $$;
revoke all on function public.encomendar_whatsapp(text,text,text,jsonb,uuid,timestamptz,text,text,numeric,boolean) from public;
grant execute on function public.encomendar_whatsapp(text,text,text,jsonb,uuid,timestamptz,text,text,numeric,boolean) to anon,authenticated;
