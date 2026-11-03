import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,Plus,Search,Heart,ShoppingBag,Minus,Trash2,Wheat,Clock3,Check,CalendarDays,MapPin,MessageCircle} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from './ui/button';
import {Dialog} from './ui/dialog';
import {money} from '../lib/utils';
import {cartTotal,canPurchase,whatsappUrl} from '../lib/order.mjs';
import type {Produto,CartItem,LojaConfig} from '../types';
import {Checkout} from './Checkout';

export function Catalog({products,open,loading,error,config,onTrack}:{products:Produto[];open:boolean;loading:boolean;error:string;config:LojaConfig|null;onTrack:()=>void}) {
 const [category,setCategory]=useState('Todos'),[search,setSearch]=useState(''),[cart,setCart]=useState<CartItem[]>([]),[upsell,setUpsell]=useState(false),[checkout,setCheckout]=useState(false),[mobileCart,setMobileCart]=useState(false);
 const categories=['Todos',...new Set(products.map(p=>p.categoria))];
 const filtered=useMemo(()=>products.filter(p=>(category==='Todos'||p.categoria===category)&&`${p.nome} ${p.descricao}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))),[products,category,search]);
 const extra=products.find(p=>p.categoria==='Bebidas'&&canPurchase(p));
 const total=cartTotal(cart),count=cart.reduce((s,i)=>s+i.quantidade,0);
 const whatsapp=config?.whatsapp?whatsappUrl(config.whatsapp):null;
 useEffect(()=>{setCart(old=>old.flatMap(item=>{const p=products.find(p=>p.id===item.produto.id);return p&&canPurchase(p)?[{...item,produto:p}]:[];}));},[products]);
 function add(product:Produto,suggest=true){
  if(!canPurchase(product))return;
  const found=cart.find(i=>i.produto.id===product.id);
  if(found?.quantidade===30){toast.error('Limite de 30 unidades ou pacotes por produto.');return;}
  setCart(c=>found?c.map(i=>i.produto.id===product.id?{...i,quantidade:i.quantidade+1}:i):[...c,{produto:product,quantidade:1,observacao:''}]);
  toast.success(`${product.nome} adicionado`);
  if(suggest&&product.categoria!=='Bebidas'&&extra&&!cart.some(i=>i.produto.id===extra.id))setUpsell(true);
 }
 function quantity(id:string,change:number){setCart(c=>c.map(i=>i.produto.id===id?{...i,quantidade:Math.min(30,i.quantidade+change)}:i).filter(i=>i.quantidade>0));}
 const cartContent=<>
  <div className="cart-heading"><h2>Sua sacola</h2><span className="count-badge">{count}</span></div>
  {!cart.length?<div className="empty-cart"><span><ShoppingBag size={32} strokeWidth={1.4}/></span><h3>Uma sacola cheia de carinho</h3><p>Escolha seus salgados favoritos.<br/>O próximo bom momento começa aqui.</p></div>:<div className="cart-items">{cart.map(item=><div className="cart-item" key={item.produto.id}>
   <div className="flex justify-between gap-2"><strong>{item.produto.nome}</strong><span>{money(Number(item.produto.preco)*item.quantidade)}</span></div>
   <small>{item.produto.unidades_pacote} unidade(s) por {item.produto.unidade}</small>
   <div className="quantity"><button aria-label={`Diminuir ${item.produto.nome}`} onClick={()=>quantity(item.produto.id,-1)}>{item.quantidade===1?<Trash2 size={13}/>:<Minus size={13}/>}</button><span>{item.quantidade}</span><button aria-label={`Aumentar ${item.produto.nome}`} onClick={()=>quantity(item.produto.id,1)}><Plus size={13}/></button></div>
   <input aria-label={`Observação para ${item.produto.nome}`} className="note-input" placeholder="Sabores e cuidados com a embalagem" maxLength={200} value={item.observacao} onChange={e=>setCart(c=>c.map(i=>i.produto.id===item.produto.id?{...i,observacao:e.target.value}:i))}/>
  </div>)}</div>}
  <div className="cart-total"><span>Subtotal</span><strong>{money(total)}</strong></div>
  <Button className="w-full" disabled={!cart.length||!open||!!error} onClick={()=>{setMobileCart(false);setCheckout(true);}}>{open?'Continuar pedido':'Pedidos indisponíveis agora'}<ArrowRight size={17}/></Button>
  <p className="cart-footnote"><Check size={13}/>{config?.entrega_ativa?'Retirada ou entrega no checkout':'Retirada na loja'}</p>
 </>;
 return <main className="page-wrap catalog-page">
  <div className="breadcrumb">Da cozinha da Sica para os seus melhores momentos <Heart size={12}/></div>
  <section className="hero sica-hero"><div className="hero-copy">
   <span className="eyebrow"><span className={`status-dot ${open?'':'closed'}`}/>{loading?'PREPARANDO O CARDÁPIO':open?'ACEITANDO PEDIDOS':'CONHEÇA A SALGADOS DA SICA'}</span>
   <h1>Pequenos salgados.<br/><em>Grandes momentos.</em></h1>
   <p>Para o café, para a festa, para dividir.<br/>Um jeito gostoso de colocar carinho à mesa.</p>
   <a href="#cardapio" className="hero-cta">Escolher meus salgados <ArrowRight size={18}/></a>
   <div className="hero-details"><span><Wheat size={16}/> Sabor de casa</span><span><Heart size={16}/> Feito para compartilhar</span></div>
  </div><div className="hero-photo"><img src="/salgados-hero.png" alt="Seleção ilustrativa de coxinhas, kibes, bolinhas de queijo e empadas" fetchPriority="high"/><div className="hero-sticker"><Heart size={22}/><span>O toque da Sica.<br/><strong>Em cada mordida.</strong></span></div><span className="photo-caption">IMAGEM ILUSTRATIVA</span></div></section>
  <div className="service-strip"><span><Wheat size={20}/><strong>Do seu tamanho</strong><small>Individuais, kits e centos</small></span><span><CalendarDays size={20}/><strong>Festa com sabor de casa</strong><small>Encomende com antecedência</small></span><button onClick={onTrack}>Já pediu? Acompanhe aqui <ArrowRight size={16}/></button></div>
  <section id="cardapio" className="catalog-section"><div className="section-title"><div><span className="eyebrow text-primary">ESCOLHA O SABOR DO SEU MOMENTO</span><h2>O que vai à sua mesa<span>?</span></h2></div><label className="search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Busque seu salgado favorito" aria-label="Buscar no cardápio"/></label></div>
   <nav className="categories" aria-label="Categorias">{categories.map(c=><button aria-pressed={category===c} key={c} onClick={()=>setCategory(c)} className={category===c?'selected':''}>{c==='Todos'&&<Wheat size={15}/>} {c}</button>)}</nav>
   <div className="catalog-layout"><div><div className="catalog-count"><h3>{category==='Todos'?'Os sabores da Sica':category}</h3><span>{loading?'Carregando…':`${filtered.length} opções`}</span></div>
    {error?<div role="alert" className="notice">{error}<Button variant="outline" onClick={()=>location.reload()}>Tentar novamente</Button></div>:<div className="product-grid">{loading?Array.from({length:6},(_,i)=><div className="product-card skeleton" key={i} role="status" aria-label="Carregando produto"><div/><section><i/><i/><i/></section></div>):filtered.map(p=><article className="product-card" key={p.id}>
     <div className={`product-image ${!p.imagem_url||p.imagem_url==='/logo-sica.png'?'brand-product':''}`}><img src={p.imagem_url||'/logo-sica.png'} alt={p.imagem_url&&p.imagem_url!=='/logo-sica.png'?p.nome:'Salgados da Sica — foto do produto em breve'} loading="lazy" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='/logo-sica.png';}}/>{p.sob_encomenda?<span className="product-tag"><CalendarDays size={12}/> Sob encomenda</span>:p.destaque&&<span className="product-tag"><Heart size={12}/> Seleção da Sica</span>}</div>
     <div className="product-body"><span className="product-category">{p.categoria} • {p.unidades_pacote>1?`${p.unidades_pacote} unidades`:p.unidade}</span><h3>{p.nome}</h3><p>{p.descricao}</p>{p.ingredientes&&<details className="ingredients"><summary>Ingredientes e alergênicos</summary><p>{p.ingredientes}</p></details>}<div className="product-bottom"><strong>{p.preco===null?'Em breve':money(p.preco)}{p.preco!==null&&<small> / {p.unidade}</small>}</strong><button disabled={!canPurchase(p)} className="add-button" aria-label={`Adicionar ${p.nome}`} onClick={()=>add(p)}><Plus size={21}/></button></div>{p.esgotado&&<p className="sold-out">Esgotado por hoje</p>}</div>
    </article>)}</div>}
    {!loading&&!error&&!filtered.length&&<div className="empty-state"><Search/><h3>Nenhum salgado encontrado</h3><p>Tente outra busca ou categoria.</p><Button variant="outline" onClick={()=>{setCategory('Todos');setSearch('');}}>Limpar filtros</Button></div>}
   </div><aside className="cart-panel">{cartContent}</aside></div>
  </section>
  <section className="party-banner"><div><span className="eyebrow">ANIVERSÁRIO, REUNIÃO OU AQUELE ENCONTRO</span><h2>A festa é sua.<br/>Os salgados são da Sica.</h2><p>Escolha kits ou centos, indique os sabores e agende seu pedido.</p><Button variant="secondary" onClick={()=>{setCategory('Kits e centos');document.getElementById('cardapio')?.scrollIntoView({behavior:'smooth'});}}>Ver kits e centos <ArrowRight size={16}/></Button></div><img src="/logo-sica.png" alt="Salgados da Sica"/></section>
  <section className="store-info" aria-label="Informações da loja"><div><MapPin size={22}/><h3>Encontre a Sica</h3><p>{config?.endereco||'Endereço de retirada em breve.'}</p></div><div><Clock3 size={22}/><h3>Quando bate a vontade</h3><p>{config?.horarios||'Horários de atendimento em breve.'}</p>{config?.preparo_minutos&&<small>Preparo estimado: {config.preparo_minutos} min.</small>}</div><div><CalendarDays size={22}/><h3>Planeje seu momento</h3><p>{config?.antecedencia_horas?`Encomendas com no mínimo ${config.antecedencia_horas} horas de antecedência.`:'Encomendas disponíveis em breve.'}</p>{config?.entrega_ativa&&<small>Entrega: {config.area_entrega}. Taxa {money(Number(config.taxa_entrega))}.</small>}</div></section>
  {whatsapp&&<a className="whatsapp-link" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/> Fale com a Sica pelo WhatsApp <ArrowRight size={16}/></a>}
  <p className="allergy-note">Tem alguma alergia alimentar? Confirme ingredientes e risco de contato cruzado com a equipe antes de comprar.</p>
  <button className="mobile-cart" onClick={()=>setMobileCart(true)}><ShoppingBag size={20}/><span>Ver sacola ({count})</span><strong>{money(total)}</strong><ArrowRight size={18}/></button>
  <Dialog open={mobileCart} onOpenChange={setMobileCart} title="Sua sacola" description="Confira quantidades, sabores e observações.">{cartContent}</Dialog>
  <Dialog open={upsell} onOpenChange={setUpsell} title="Uma companhia para seus salgados?" description={extra?`${extra.nome} por ${money(Number(extra.preco))}.`:''}>{extra&&<><Button className="w-full" onClick={()=>{add(extra,false);setUpsell(false);}}>Adicionar {extra.nome}<Plus size={18}/></Button><Button variant="ghost" className="mt-2 w-full" onClick={()=>setUpsell(false)}>Só os salgados, por enquanto</Button></>}</Dialog>
  <Checkout open={checkout} onOpenChange={setCheckout} cart={cart} config={config} storeOpen={open} onSuccess={()=>setCart([])}/>
 </main>;
}
