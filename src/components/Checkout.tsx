import {useRef,useState} from 'react';
import {ArrowRight,Check,LoaderCircle,MessageCircle,ShoppingBag} from 'lucide-react';
import {toast} from 'sonner';
import {Dialog} from './ui/dialog';
import {Button} from './ui/button';
import {supabase} from '../lib/supabase';
import {cartTotal,normalizePhone,validPhone,formatPhone,scheduleISO,scheduleError,orderWhatsappUrl} from '../lib/order.mjs';
import {money} from '../lib/utils';
import type {CartItem,Tracking,LojaConfig} from '../types';
import {Progress} from './Tracking';

type SavedOrder=Tracking&{itens:{nome_produto:string;quantidade:number;observacao:string;preco_unitario:number}[];tipo_entrega:string;endereco_entrega:string|null;taxa_entrega:number;agendado_para:string;metodo_pagamento:string;troco_para:number|null};

export function Checkout({open,onOpenChange,cart,config,storeOpen,onSuccess}:{config:LojaConfig|null;open:boolean;onOpenChange:(v:boolean)=>void;cart:CartItem[];storeOpen:boolean;onSuccess:()=>void}){
 const [nome,setNome]=useState(''),[telefone,setTelefone]=useState(''),[method,setMethod]=useState<'pix'|'cartao'|'dinheiro'>('pix'),[troco,setTroco]=useState(''),[marketing,setMarketing]=useState(false),[busy,setBusy]=useState(false),[order,setOrder]=useState<SavedOrder|null>(null),[whatsapp,setWhatsapp]=useState('');
 const [schedule,setSchedule]=useState(''),[delivery,setDelivery]=useState<'retirada'|'entrega'>('retirada'),[address,setAddress]=useState(''),[areaConfirmed,setAreaConfirmed]=useState(false);
 const deliveryFee=delivery==='entrega'?Number(config?.taxa_entrega||0):0;
 const total=cartTotal(cart)+deliveryFee;
 const key=useRef(crypto.randomUUID());const flight=useRef(false);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(flight.current)return;
  const customerName=nome.trim().replace(/\s+/g,' ');
  if(customerName.split(' ').length<2||customerName.length>80||!validPhone(telefone)){toast.error('Informe nome completo e WhatsApp válido com DDD.');return;}
  if(method==='dinheiro'&&troco&&Number(troco)<total){toast.error('O troco precisa ser igual ou maior que o total.');return;}
  const scheduleIssue=scheduleError(schedule,config);if(scheduleIssue){toast.error(scheduleIssue);return;}
  flight.current=true;setBusy(true);
  const pendingWindow=window.open('about:blank','_blank');
  try{
   const {data,error}=await supabase.rpc('encomendar_whatsapp',{p_agendamento:scheduleISO(schedule),p_entrega:delivery,p_endereco:delivery==='entrega'?address:null,p_nome:customerName,p_telefone:normalizePhone(telefone),p_metodo:method,p_troco:method==='dinheiro'&&troco?Number(troco):null,p_marketing_opt_in:marketing,p_chave:key.current,p_itens:cart.map(i=>({produto_id:i.produto.id,quantidade:i.quantidade,observacao:i.observacao}))});
   if(error)throw error;
   const saved=data as SavedOrder;
   if(!saved.itens?.length)throw new Error('O pedido foi salvo, mas faltam os dados para montar a mensagem. Fale com a equipe pelo WhatsApp.');
   const link=orderWhatsappUrl(config?.whatsapp||'',saved,{nome:customerName,telefone});
   setOrder(saved);setWhatsapp(link);onSuccess();key.current=crypto.randomUUID();toast.success('Pedido registrado! Confirme no WhatsApp.');
   if(pendingWindow){pendingWindow.opener=null;pendingWindow.location.href=link;}
  }catch(e){pendingWindow?.close();toast.error(e instanceof Error?e.message:(e as {message?:string}).message||'Não foi possível enviar. Tente novamente.');}
  finally{flight.current=false;setBusy(false);}
 }
 function change(v:boolean){if(busy)return;onOpenChange(v);if(!v){setOrder(null);setWhatsapp('');}}
 return <Dialog open={open} onOpenChange={change} title={order?`Pedido #${order.numero_pedido} registrado!`:'Finalizar pedido'} description={order?'O pedido foi salvo. Agora confirme e envie a mensagem no WhatsApp.':'Confira como e quando receber seus salgados.'}>
  {order?<><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><div className="flex items-center gap-2 font-semibold"><Check size={18}/> Pedido salvo com sucesso</div><p className="mt-1 text-sm">A comanda #{order.numero_pedido} já está registrada para {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Fortaleza'}).format(new Date(order.agendado_para))}.</p></div><Progress initial={order} phone={telefone}/><a className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-white" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Abrir novamente no WhatsApp</a><Button className="mt-3 w-full" variant="outline" onClick={()=>change(false)}>Voltar ao cardápio</Button></>:<form onSubmit={submit} className="space-y-5">
   <label className="form-label">Nome completo<input required minLength={5} maxLength={80} value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome e sobrenome" autoComplete="name"/></label>
   <label className="form-label">WhatsApp com DDD<input required type="tel" inputMode="tel" maxLength={15} value={telefone} onChange={e=>setTelefone(formatPhone(e.target.value))} placeholder="(98) 98888-8888" autoComplete="tel"/><small className="muted">Usaremos seu contato para identificar o pedido e confirmar detalhes.</small></label>
   <fieldset><legend className="mb-2 text-sm font-semibold">Como vai receber?</legend><label className="payment-option"><input type="radio" checked={delivery==='retirada'} onChange={()=>setDelivery('retirada')}/><span><strong>Retirada na loja</strong><small>{config?.endereco}</small></span></label>{config?.entrega_ativa&&<label className="payment-option"><input type="radio" checked={delivery==='entrega'} onChange={()=>setDelivery('entrega')}/><span><strong>Entrega • {money(deliveryFee)}</strong><small>{config.area_entrega}</small></span></label>}{delivery==='entrega'&&<><label className="form-label">Endereço completo<input required minLength={10} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Rua, número, bairro, cidade e referência" autoComplete="street-address"/></label><label className="check-label mt-3"><input required type="checkbox" checked={areaConfirmed} onChange={e=>setAreaConfirmed(e.target.checked)}/>Meu endereço fica na área de entrega informada.</label></>}</fieldset>
   <label className="form-label">Data e horário da encomenda<input type="datetime-local" required value={schedule} onChange={e=>setSchedule(e.target.value)}/><small className="muted">Horário de Fortaleza. Antecedência mínima: {config?.antecedencia_horas} horas.</small></label>
   <fieldset><legend className="mb-2 text-sm font-semibold">Forma de pagamento</legend>{([['pix','Pix'],['cartao','Cartão'],['dinheiro','Dinheiro']] as const).map(([value,label])=><label className="payment-option" key={value}><input type="radio" checked={method===value} onChange={()=>setMethod(value)}/><span><strong>{label}</strong></span></label>)}</fieldset>
   {method==='dinheiro'&&<label className="form-label">Precisa de troco? Para quanto?<input type="number" min={total} max="99999" step="0.01" value={troco} onChange={e=>setTroco(e.target.value)} placeholder={money(total)}/><small className="muted">Deixe vazio se não precisar de troco.</small></label>}
   <div className="cart-total"><span>Total {deliveryFee>0&&<small>(inclui entrega: {money(deliveryFee)})</small>}</span><strong>{money(total)}</strong></div>
   <label className="check-label"><input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)}/>Aceito receber novidades e ofertas da Salgados da Sica pelo WhatsApp.</label>
   {!storeOpen&&<p role="alert" className="text-primary">A loja está fechada. Aguarde a reabertura para enviar.</p>}
   <Button type="submit" className="w-full" disabled={busy||!storeOpen||!cart.length}>{busy?<LoaderCircle className="animate-spin" size={18}/>:<><ShoppingBag size={17}/> Enviar pedido pelo WhatsApp <ArrowRight size={17}/></>}{busy?' Registrando…':''}</Button>
  </form>}
 </Dialog>;
}
