import {useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {todayStart} from '../lib/order.mjs';
import type {Pedido} from '../types';
export function useOrders(enabled:boolean,onNew:()=>void){
 const [orders,setOrders]=useState<Pedido[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[live,setLive]=useState(false);
 const callback=useRef(onNew);callback.current=onNew;
 useEffect(()=>{if(!enabled){setOrders([]);return;}let active=true;let sequence=0;
 async function refresh(){const n=++sequence;const {data,error}=await supabase.from('pedidos').select('*,itens_pedido(*)').or(`status.neq.finalizado,created_at.gte.${todayStart()}`).order('created_at');if(!active||n!==sequence)return;if(error)setError('Não foi possível atualizar os pedidos.');else{setOrders(data as Pedido[]);setError('');}setLoading(false);}
 const channel=supabase.channel('cozinha').on('postgres_changes',{event:'*',schema:'public',table:'pedidos'},payload=>{if(payload.eventType==='INSERT')callback.current();void refresh();}).subscribe(status=>{if(active)setLive(status==='SUBSCRIBED');if(status==='SUBSCRIBED')void refresh();});
 void refresh();const tick=setInterval(refresh,20000);window.addEventListener('focus',refresh);
 return()=>{active=false;clearInterval(tick);window.removeEventListener('focus',refresh);void supabase.removeChannel(channel);};
 },[enabled]);return{orders,setOrders,loading,error,live};
}
