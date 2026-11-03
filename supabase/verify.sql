-- Transactional integration checks. All test rows and configuration changes roll back.
begin;
update public.produtos set preco=5,esgotado=false where nome='Coxinha de frango' and is_ativo;
update public.loja_config set aberta=true,entrega_ativa=true,area_entrega='Área de teste',taxa_entrega=7 where id=1;
do $$
declare product uuid; key uuid:=gen_random_uuid(); r jsonb; retry jsonb; scheduled timestamptz; payload jsonb;
begin
 select id into product from public.produtos where nome='Coxinha de frango' and is_ativo;
 select t into scheduled from generate_series(now()+interval '4 hours',now()+interval '7 days',interval '1 hour') t
 where extract(dow from t at time zone 'America/Fortaleza') between 2 and 6 and (t at time zone 'America/Fortaleza')::time between '09:00' and '17:00' limit 1;
 payload:=jsonb_build_array(jsonb_build_object('produto_id',product,'quantidade',2,'preco',0.01));
 set local role anon;
 r:=public.encomendar('Teste transacional Sica','98900000000','retirada',payload,key,scheduled,'entrega','Endereço fictício de teste');
 retry:=public.encomendar('Teste transacional Sica','98900000000','retirada',payload,key,scheduled,'entrega','Endereço fictício de teste');
 assert (r->>'total')::numeric=17,'Server price and delivery fee mismatch';
 assert r=retry,'Idempotency did not preserve total';
 assert public.acompanhar_pedido((r->>'numero_pedido')::bigint,'98911111111') is null,'Wrong phone can track';
 begin perform * from public.pedidos;raise exception 'Anonymous order access';exception when insufficient_privilege then null;end;
 begin perform * from public.clientes;raise exception 'Anonymous customer access';exception when insufficient_privilege then null;end;
 begin update public.produtos set preco=1 where id=product;raise exception 'Anonymous product write';exception when insufficient_privilege then null;end;
 begin perform public.encomendar('Teste','98900000000','retirada',payload,gen_random_uuid(),now()+interval '1 hour');raise exception 'Short notice accepted';exception when raise_exception then if sqlerrm not like '%antecedência%' then raise;end if;end;
 begin perform public.encomendar('Teste','98900000000','retirada',payload,gen_random_uuid(),null);raise exception 'Missing schedule accepted';exception when raise_exception then if sqlerrm not like '%data e o horário%' then raise;end if;end;
 begin perform public.criar_pedido('Teste','98900000000','retirada',payload,gen_random_uuid());raise exception 'Legacy RPC available';exception when insufficient_privilege then null;end;
 reset role;
 update public.produtos set esgotado=true where id=product;
 set local role anon;
 begin perform public.encomendar('Teste','98900000000','retirada',payload,gen_random_uuid(),scheduled);raise exception 'Sold out accepted';exception when raise_exception then if sqlerrm not like '%indisponível%' then raise;end if;end;
 reset role;
 update public.produtos set esgotado=false,preco=null where id=product;
 set local role anon;
 begin perform public.encomendar('Teste','98900000000','retirada',payload,gen_random_uuid(),scheduled);raise exception 'Unpriced accepted';exception when raise_exception then if sqlerrm not like '%indisponível%' then raise;end if;end;
 reset role;
end $$;
rollback;
select 'PASS: pricing, delivery, idempotency, scheduling, sold-out products, drafts, private data, legacy RPC blocked' as result;
