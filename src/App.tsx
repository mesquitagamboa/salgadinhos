import {lazy,Suspense,useState} from 'react';
import {Flame,ChefHat,ChartNoAxesCombined,ShoppingBag,Sun,Moon,ArrowUpRight,MapPin} from 'lucide-react';
import {Button} from './components/ui/button';
import {useCatalog} from './hooks/useCatalog';
import {useStaff} from './hooks/useStaff';
import {Catalog} from './components/Catalog';
const Kitchen=lazy(()=>import('./components/Kitchen').then(m=>({default:m.Kitchen})));
import {StaffLogin} from './components/StaffLogin';
import {TrackingDialog} from './components/Tracking';
export default function App(){
 const [page,setPage]=useState<'catalogo'|'cozinha'|'gestao'>('catalogo'),[dark,setDark]=useState(()=>localStorage.getItem('theme')==='dark'),[track,setTrack]=useState(false),[demo,setDemo]=useState(false);
 const catalog=useCatalog();const auth=useStaff();
 function toggleTheme(){setDark(!dark);localStorage.setItem('theme',dark?'light':'dark');}
 return <div className={dark?'dark':''}><div className="app-shell min-h-screen bg-background text-foreground">
  <header className="site-header"><div className="header-inner"><button className="brand" onClick={()=>setPage('catalogo')} aria-label="Salgados da Sica, início"><img className="brand-logo" src="/logo-sica.png" alt=""/><span>Salgados da <b>Sica</b><small>CARINHO EM CADA MORDIDA</small></span></button>
  <nav aria-label="Navegação principal" className="top-nav">{([{id:'catalogo',label:'Cardápio',Icon:ShoppingBag},{id:'cozinha',label:'Cozinha',Icon:ChefHat},{id:'gestao',label:'Gestão',Icon:ChartNoAxesCombined}] as const).map(({id,label,Icon})=><button key={id} aria-label={label} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={17}/><span>{label}</span></button>)}</nav>
  <div className="header-actions"><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={dark?'Ativar modo claro':'Ativar modo escuro'}>{dark?<Sun size={19}/>:<Moon size={19}/>}</Button><Button variant="outline" className="tracking-header" onClick={()=>setTrack(true)}>Meu pedido <ArrowUpRight size={16}/></Button></div></div></header>
  <Suspense fallback={<div className="page-wrap py-20" role="status">Carregando painel…</div>}>{page==='catalogo'?<Catalog {...catalog} onTrack={()=>setTrack(true)}/>:auth.checking?<div className="page-wrap py-20" role="status">Verificando seu acesso…</div>:auth.staff||demo?<Kitchen page={page} demo={demo&&!auth.staff} open={catalog.open} config={catalog.config} onLeaveDemo={()=>setDemo(false)} email={auth.email}/>:<StaffLogin email={auth.email} onDemo={()=>setDemo(true)}/>}</Suspense>
  <footer className="page-wrap footer"><span><Flame size={16}/> Salgados da Sica <span className="muted">Feitos para compartilhar.</span></span><span><MapPin size={15}/> Pedidos para retirada</span><button onClick={()=>setTrack(true)}>Acompanhar pedido <ArrowUpRight size={14}/></button></footer>
  <TrackingDialog open={track} onOpenChange={setTrack}/>
 </div></div>;
}
