import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Produto,LojaConfig } from '../types';
export function useCatalog() {
 const [products,setProducts]=useState<Produto[]>([]),[open,setOpen]=useState(false),[config,setConfig]=useState<LojaConfig|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  async function load(){
   const [p,s]=await Promise.all([supabase.from('produtos').select('*').eq('is_ativo',true).order('destaque',{ascending:false}).order('nome'),supabase.from('loja_config').select('*').eq('id',1).single()]);
   if(!active)return;
   if(p.error||s.error){setError('Não foi possível carregar o cardápio. Tente novamente.');setOpen(false);}else{setProducts(p.data as Produto[]);setConfig(s.data as LojaConfig);setOpen(s.data.aberta);setError('');}setLoading(false);
  }
  const ch=supabase.channel('catalogo').on('postgres_changes',{event:'*',schema:'public',table:'produtos'},load).on('postgres_changes',{event:'*',schema:'public',table:'loja_config'},load).subscribe(status=>{if(status==='SUBSCRIBED')void load();});
  void load(); const refresh=()=>void load(); window.addEventListener('focus',refresh);
  const interval=window.setInterval(refresh,30000);
  return()=>{active=false;void supabase.removeChannel(ch);window.removeEventListener('focus',refresh);clearInterval(interval);};
 },[]);
 return {products,open,loading,error,config};
}
