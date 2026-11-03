-- Schema additive: does not modify tables belonging to other applications.
create schema if not exists lanchonete_private;
revoke all on schema lanchonete_private from public;
grant usage on schema lanchonete_private to anon, authenticated;
create table lanchonete_private.equipe (email text primary key);
create function lanchonete_private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users u join lanchonete_private.equipe e on e.email = lower(u.email) where u.id = (select auth.uid()) and u.email_confirmed_at is not null)
$$;
revoke all on function lanchonete_private.is_staff() from public;
grant execute on function lanchonete_private.is_staff() to anon, authenticated;
create function public.lanchonete_staff() returns boolean language sql stable security invoker set search_path = '' as $$ select lanchonete_private.is_staff() $$;
revoke all on function public.lanchonete_staff() from public;
grant execute on function public.lanchonete_staff() to authenticated;

create table public.clientes (id uuid primary key default gen_random_uuid(), nome text not null check(length(nome) between 2 and 80), telefone text unique not null check(telefone ~ '^[0-9]{10,11}$'));
create table public.produtos (id uuid primary key default gen_random_uuid(), nome text not null, descricao text not null default '', preco numeric(10,2) not null check(preco > 0), categoria text not null, imagem_url text, is_ativo boolean not null default true, destaque boolean not null default false);
create table public.loja_config (id integer primary key default 1 check(id=1), aberta boolean not null default false);
insert into public.loja_config(id,aberta) values(1,false);
create table public.pedidos (
 id uuid primary key default gen_random_uuid(), numero_pedido bigint generated always as identity (start with 1024) unique,
 cliente_id uuid not null references public.clientes(id), nome_cliente text not null,
 status text not null default 'pendente' check(status in ('pendente','preparando','pronto','finalizado')),
 metodo_pagamento text not null check(metodo_pagamento in ('pix_demo','retirada')),
 status_pagamento text not null default 'pendente' check(status_pagamento in ('pendente','pago')),
 total numeric(10,2) not null default 0 check(total>=0), created_at timestamptz not null default now(),
 token_acompanhamento uuid not null default gen_random_uuid() unique, chave_idempotencia uuid not null unique
);
create table public.itens_pedido (id uuid primary key default gen_random_uuid(), pedido_id uuid not null references public.pedidos(id) on delete cascade, produto_id uuid not null references public.produtos(id), quantidade integer not null check(quantidade between 1 and 30), observacao text not null default '' check(length(observacao)<=200), preco_unitario numeric(10,2) not null, nome_produto text not null);
create index pedidos_cliente_idx on public.pedidos(cliente_id);
create index pedidos_data_idx on public.pedidos(created_at);
create index itens_pedido_idx on public.itens_pedido(pedido_id);
create index itens_produto_idx on public.itens_pedido(produto_id);
alter table public.clientes enable row level security;
alter table public.produtos enable row level security;
alter table public.pedidos enable row level security;
alter table public.itens_pedido enable row level security;
alter table public.loja_config enable row level security;
revoke all on public.clientes,public.produtos,public.pedidos,public.itens_pedido,public.loja_config from anon,authenticated;
grant select on public.produtos,public.loja_config to anon,authenticated;
grant select on public.clientes,public.pedidos,public.itens_pedido to authenticated;
grant update(status,status_pagamento) on public.pedidos to authenticated;
grant update(aberta) on public.loja_config to authenticated;
create policy catalogo on public.produtos for select to anon,authenticated using(is_ativo or (select lanchonete_private.is_staff()));
create policy loja_leitura on public.loja_config for select to anon,authenticated using(true);
create policy loja_equipe on public.loja_config for update to authenticated using((select lanchonete_private.is_staff())) with check((select lanchonete_private.is_staff()));
create policy clientes_equipe on public.clientes for select to authenticated using((select lanchonete_private.is_staff()));
create policy pedidos_equipe on public.pedidos for select to authenticated using((select lanchonete_private.is_staff()));
create policy pedidos_atualizar on public.pedidos for update to authenticated using((select lanchonete_private.is_staff())) with check((select lanchonete_private.is_staff()));
create policy itens_equipe on public.itens_pedido for select to authenticated using((select lanchonete_private.is_staff()));

-- Guest checkout is a narrowly scoped capability; clients never write totals or read customer records.
create function lanchonete_private.criar_pedido(p_nome text,p_telefone text,p_metodo text,p_itens jsonb,p_chave uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cliente uuid; v_pedido public.pedidos; v_produto public.produtos; v_item jsonb; v_qtd integer; v_total numeric(10,2):=0; v_tel text;
begin
 v_tel:=regexp_replace(p_telefone,'\D','','g');
 if p_nome is null or length(trim(p_nome)) not between 2 and 80 or v_tel is null or v_tel !~ '^[0-9]{10,11}$' or p_metodo is null or p_metodo not in ('pix_demo','retirada') or p_chave is null then raise exception 'Informe nome, telefone e pagamento válidos.'; end if;
 if p_itens is null or jsonb_typeof(p_itens)<>'array' then raise exception 'Carrinho inválido.'; end if;
 if jsonb_array_length(p_itens) not between 1 and 30 then raise exception 'Selecione de 1 a 30 itens.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_chave::text,0));
 select * into v_pedido from public.pedidos where chave_idempotencia=p_chave;
 if found then
   if not exists(select 1 from public.clientes where id=v_pedido.cliente_id and telefone=v_tel) then raise exception 'Requisição inválida.'; end if;
   return jsonb_build_object('numero_pedido',v_pedido.numero_pedido,'token',v_pedido.token_acompanhamento,'status',v_pedido.status,'total',v_pedido.total);
 end if;
 perform 1 from public.loja_config where id=1 and aberta for share;
 if not found then raise exception 'A loja está fechada. Volte em breve.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_tel,1));
 if (select count(*) from public.pedidos p join public.clientes c on c.id=p.cliente_id where c.telefone=v_tel and p.created_at>now()-interval '1 minute')>=3 then raise exception 'Aguarde um minuto antes de fazer outro pedido.'; end if;
 insert into public.clientes(nome,telefone) values(trim(p_nome),v_tel) on conflict(telefone) do update set telefone=excluded.telefone returning id into v_cliente;
 insert into public.pedidos(cliente_id,nome_cliente,metodo_pagamento,chave_idempotencia) values(v_cliente,trim(p_nome),p_metodo,p_chave) returning * into v_pedido;
 for v_item in select * from jsonb_array_elements(p_itens) loop
   if (v_item->>'quantidade') is null or (v_item->>'quantidade') !~ '^[0-9]{1,2}$' then raise exception 'Quantidade inválida.'; end if;
   v_qtd:=(v_item->>'quantidade')::integer;
   if v_qtd not between 1 and 30 or length(coalesce(v_item->>'observacao',''))>200 then raise exception 'Quantidade ou observação inválida.'; end if;
   select * into v_produto from public.produtos where id=(v_item->>'produto_id')::uuid and is_ativo for share;
   if not found then raise exception 'Um produto não está mais disponível.'; end if;
   insert into public.itens_pedido(pedido_id,produto_id,quantidade,observacao,preco_unitario,nome_produto) values(v_pedido.id,v_produto.id,v_qtd,coalesce(v_item->>'observacao',''),v_produto.preco,v_produto.nome);
   v_total:=v_total+v_produto.preco*v_qtd;
 end loop;
 update public.pedidos set total=v_total where id=v_pedido.id;
 return jsonb_build_object('numero_pedido',v_pedido.numero_pedido,'token',v_pedido.token_acompanhamento,'status',v_pedido.status,'total',v_total);
end $$;
revoke all on function lanchonete_private.criar_pedido(text,text,text,jsonb,uuid) from public;
grant execute on function lanchonete_private.criar_pedido(text,text,text,jsonb,uuid) to anon,authenticated;
create function public.criar_pedido(p_nome text,p_telefone text,p_metodo text,p_itens jsonb,p_chave uuid) returns jsonb language sql security invoker set search_path = '' as $$ select lanchonete_private.criar_pedido(p_nome,p_telefone,p_metodo,p_itens,p_chave) $$;
revoke all on function public.criar_pedido(text,text,text,jsonb,uuid) from public;
grant execute on function public.criar_pedido(text,text,text,jsonb,uuid) to anon,authenticated;

-- Tracking returns no customer name, phone, item notes or payment information.
create function lanchonete_private.acompanhar_pedido(p_numero bigint,p_telefone text) returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('numero_pedido',p.numero_pedido,'status',p.status,'token',p.token_acompanhamento) from public.pedidos p join public.clientes c on c.id=p.cliente_id where p.numero_pedido=p_numero and c.telefone=regexp_replace(p_telefone,'\D','','g') and p.created_at>now()-interval '7 days'
$$;
revoke all on function lanchonete_private.acompanhar_pedido(bigint,text) from public;
grant execute on function lanchonete_private.acompanhar_pedido(bigint,text) to anon,authenticated;
create function public.acompanhar_pedido(p_numero bigint,p_telefone text) returns jsonb language sql stable security invoker set search_path = '' as $$ select lanchonete_private.acompanhar_pedido(p_numero,p_telefone) $$;
revoke all on function public.acompanhar_pedido(bigint,text) from public;
grant execute on function public.acompanhar_pedido(bigint,text) to anon,authenticated;

create function lanchonete_private.pedido_status_event() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.status is distinct from old.status then
   if not ((old.status='pendente' and new.status='preparando') or (old.status='preparando' and new.status='pronto') or (old.status='pronto' and new.status='finalizado')) then raise exception 'Transição de pedido inválida.'; end if;
   if new.status='finalizado' and new.status_pagamento<>'pago' then raise exception 'Confirme o pagamento antes de finalizar.'; end if;
   perform realtime.send(jsonb_build_object('changed',true),'status','pedido:'||new.token_acompanhamento::text,false);
 end if;
 return new;
end $$;
revoke all on function lanchonete_private.pedido_status_event() from public;
create trigger pedido_status_event before update on public.pedidos for each row execute function lanchonete_private.pedido_status_event();
alter publication supabase_realtime add table public.pedidos,public.itens_pedido,public.produtos,public.loja_config;

insert into public.produtos(nome,descricao,preco,categoria,imagem_url,destaque) values
('Clássico da casa','Pão brioche, burger de 160 g, queijo derretido, alface e molho da casa.',24.90,'Burgers','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1000&q=85',true),
('Duplo smash','Dois smash burgers, cheddar em dobro, cebola e nosso molho especial.',32.90,'Burgers','https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1000&q=85',true),
('Crispy chicken','Frango crocante, salada fresquinha e maionese da casa no brioche.',26.90,'Burgers','https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=1000&q=85',false),
('Coxinha cremosa','Casquinha dourada, frango desfiado e um recheio bem cremoso.',8.00,'Salgados','https://images.unsplash.com/photo-1548340748-6d98e6ebfee1?auto=format&fit=crop&w=1000&q=85',true),
('Batata da casa','Batatas douradas e crocantes com uma pitada de páprica. Porção 200 g.',14.90,'Porções','https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=1000&q=85',false),
('Refrigerante gelado','Lata de 350 ml. O par perfeito para o seu lanche.',6.00,'Bebidas','https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=1000&q=85',false),
('Batata + refri','Combo adicional: batata 100 g + refrigerante 200 ml.',10.00,'Combos','https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=1000&q=85',false);
