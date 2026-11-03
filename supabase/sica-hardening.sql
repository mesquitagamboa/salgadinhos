create or replace function lanchonete_private.encomendar(p_nome text,p_telefone text,p_metodo text,p_itens jsonb,p_chave uuid,p_agendamento timestamptz,p_entrega text,p_endereco text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.loja_config; r jsonb; p public.produtos; item jsonb; precisa_agendar boolean:=false; t numeric:=0;
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
 if precisa_agendar and (p_agendamento is null or c.antecedencia_horas is null) then raise exception 'Escolha a data e o horário da encomenda.'; end if;
 if p_agendamento is not null and (p_agendamento < now()+make_interval(hours=>case when precisa_agendar then c.antecedencia_horas else 0 end,mins=>case when precisa_agendar then 0 else coalesce(c.preparo_minutos,0) end) or p_agendamento>now()+interval '90 days') then raise exception 'Respeite a antecedência e agende para até 90 dias.'; end if;
 r:=lanchonete_private.criar_pedido(p_nome,p_telefone,p_metodo,p_itens,p_chave);
 update public.pedidos set agendado_para=p_agendamento,tipo_entrega=p_entrega,endereco_entrega=case when p_entrega='entrega' then trim(p_endereco) else null end,taxa_entrega=t,total=total+t where chave_idempotencia=p_chave;
 return r||jsonb_build_object('total',(r->>'total')::numeric+t);
end $$;

create or replace function lanchonete_private.acompanhar_pedido(p_numero bigint,p_telefone text) returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('numero_pedido',p.numero_pedido,'status',p.status,'token',p.token_acompanhamento) from public.pedidos p join public.clientes c on c.id=p.cliente_id where p.numero_pedido=p_numero and c.telefone=regexp_replace(p_telefone,'\D','','g') and coalesce(p.agendado_para,p.created_at)>now()-interval '7 days'
$$;
alter table public.produtos add constraint produto_textos_validos check(length(nome) between 2 and 100 and length(descricao)<=600 and length(ingredientes)<=1000 and (imagem_url is null or length(imagem_url)<=2000));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sica-produtos','sica-produtos',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy sica_fotos_inserir on storage.objects for insert to authenticated with check(bucket_id='sica-produtos' and (select lanchonete_private.is_staff()));
create policy sica_fotos_ler_equipe on storage.objects for select to authenticated using(bucket_id='sica-produtos' and (select lanchonete_private.is_staff()));
