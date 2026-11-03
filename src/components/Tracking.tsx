import {useEffect,useState} from 'react';
import {Check,ChefHat,ShoppingBag,Clock3} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog} from './ui/dialog';
import {Button} from './ui/button';
import {supabase} from '../lib/supabase';
import {normalizePhone,validPhone,statuses} from '../lib/order.mjs';
import type {Tracking} from '../types';
export function Progress({initial,phone}:{initial:Tracking;phone:string}){
 const [order,setOrder]=useState(initial),[live,setLive]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;
 const refresh=async()=>{const {data,error}=await supabase.rpc('acompanhar_pedido',{p_numero:initial.numero_pedido,p_telefone:normalizePhone(phone)});if(!active)return;if(error||!data)setError('Não foi possível atualizar agora. Tentaremos novamente.');else{setOrder(data);setError('');}};
 // Broadcast is only an invalidation signal; always fetch authoritative status from SQL.
 const ch=supabase.channel(`pedido:${initial.token}`).on('broadcast',{event:'status'},refresh).subscribe(s=>{if(active)setLive(s==='SUBSCRIBED');if(s==='SUBSCRIBED')void refresh();});
 void refresh();const interval=setInterval(refresh,15000);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',refresh);void supabase.removeChannel(ch);};
 },[initial.numero_pedido,initial.token,phone]);
 const index=statuses.indexOf(order.status);
 return <div className="tracking-progress"><div className="tracking-live"><span className={`status-dot ${live?'':'closed'}`}/>{live?'Acompanhando ao vivo':'Reconectando • atualização automática'}</div>{[{title:'Pedido recebido',sub:'Já está com a nossa equipe.',Icon:Clock3},{title:'Em preparo',sub:'Seus salgados estão sendo preparados.',Icon:ChefHat},{title:'Pedido pronto',sub:'Pronto para retirada ou saída para entrega.',Icon:ShoppingBag},{title:'Finalizado',sub:'Bom apetite. Até a próxima!',Icon:Check}].map(({title,sub,Icon},i)=><div className={`progress-step ${i<=index?'done':''}`} key={title}><span><Icon size={20}/></span><div><strong>{title}</strong><p>{sub}</p></div>{i<index&&<Check size={16}/>}</div>)}{error&&<p role="status" className="text-sm text-primary">{error}</p>}</div>;
}
export function TrackingDialog({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
 const [number,setNumber]=useState(''),[phone,setPhone]=useState(''),[result,setResult]=useState<Tracking|null>(null),[busy,setBusy]=useState(false),[resultPhone,setResultPhone]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();if(!validPhone(phone)){toast.error('Informe seu telefone com DDD.');return;}setBusy(true);const{data,error}=await supabase.rpc('acompanhar_pedido',{p_numero:Number(number.replace('#','')),p_telefone:normalizePhone(phone)});setBusy(false);if(error||!data){toast.error('Pedido não encontrado. Confira o número e telefone.');setResult(null);return;}setResult(data);setResultPhone(phone);}
 return <Dialog open={open} onOpenChange={onOpenChange} title={result?`Seu pedido #${result.numero_pedido}`:'Como está meu pedido?'} description="Informe o número e o telefone usados no pedido. Consulta disponível até 7 dias após a data da encomenda.">{result?<><Progress initial={result} phone={resultPhone}/><Button className="mt-5 w-full" variant="outline" onClick={()=>setResult(null)}>Consultar outro pedido</Button></>:<form onSubmit={submit} className="space-y-4"><label className="form-label">Número do pedido<input required inputMode="numeric" pattern="#?[0-9]+" placeholder="Ex.: 1024" value={number} onChange={e=>setNumber(e.target.value)}/></label><label className="form-label">Telefone com DDD<input required type="tel" placeholder="(85) 99999-9999" value={phone} onChange={e=>setPhone(e.target.value)}/></label><Button className="w-full" disabled={busy}>{busy?'Buscando…':'Acompanhar pedido'}</Button></form>}</Dialog>;
}
