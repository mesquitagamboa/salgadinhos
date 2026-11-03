import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
export function useStaff(){
 const [staff,setStaff]=useState(false),[checking,setChecking]=useState(true),[email,setEmail]=useState<string|null>(null);
 useEffect(()=>{let alive=true;let revision=0;
  async function check(){const current=++revision; const {data:{session}}=await supabase.auth.getSession();const result=session?await supabase.rpc('lanchonete_staff'):null;if(alive&&current===revision){setEmail(session?.user.email??null);setStaff(result?.data===true);setChecking(false);}}
  void check();const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>{setTimeout(()=>void check(),0);});return()=>{alive=false;subscription.unsubscribe();};
 },[]);return{staff,checking,email};
}
