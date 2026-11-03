export const statuses = ['pendente', 'preparando', 'pronto', 'finalizado'];
export function nextStatus(status) { const index=statuses.indexOf(status); return index<0?null:statuses[index + 1] ?? null; }
export function canPurchase(product) { return product.is_ativo && !product.esgotado && product.preco !== null && Number(product.preco)>0; }
export function whatsappUrl(phone) { const digits=normalizePhone(phone); return `https://wa.me/${digits.length<=11?'55':''}${digits}`; }
export function scheduleISO(value) { return value ? new Date(`${value}:00-03:00`).toISOString() : null; }
export function scheduleError(value, config, now=Date.now()) {
 if(!value||!config?.antecedencia_horas)return 'Escolha uma data e um horário.';
 const date=new Date(`${value}:00-03:00`), stamp=date.getTime();
 if(!Number.isFinite(stamp)||stamp<now+config.antecedencia_horas*3600000||stamp>now+90*86400000)return `Agende com pelo menos ${config.antecedencia_horas}h de antecedência e até 90 dias.`;
 const day=new Date(`${value.slice(0,10)}T12:00:00Z`).getUTCDay();
 const hours=config.horarios_semana[String(day)];const time=value.slice(11,16);
 if(!hours||time<hours.abre||time>hours.fecha)return 'Escolha um horário dentro do atendimento da loja.';
 return null;
}
export function cartTotal(items) { return items.reduce((sum, item) => sum + Math.round(Number(item.produto.preco) * 100) * item.quantidade, 0) / 100; }
export function normalizePhone(phone) { return phone.replace(/\D/g, ''); }
export function formatPhone(phone) {
  const digits=normalizePhone(phone).slice(0,11);
  if(digits.length<3)return digits?`(${digits}`:'';
  const area=digits.slice(0,2),number=digits.slice(2),mobile=number.startsWith('9'),prefix=number.slice(0,mobile?5:4),tail=number.slice(mobile?5:4);
  return `(${area}) ${prefix}${tail?`-${tail}`:''}`;
}
export function validPhone(phone) { return /^[0-9]{10,11}$/.test(normalizePhone(phone)); }
export function orderWhatsappUrl(storePhone, order, customer) {
  const lines=[`*Novo Pedido #${order.numero_pedido}*`,``,`*Cliente:* ${customer.nome}`,`*WhatsApp:* ${customer.telefone}`,``,`*Itens:*`];
  for(const item of order.itens) {
    lines.push(`• ${item.quantidade}x ${item.nome_produto}${item.observacao?` — ${item.observacao}`:''} — ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(item.preco_unitario)*item.quantidade)}`);
  }
  lines.push('',`*Recebimento:* ${order.tipo_entrega==='entrega'?'Entrega':'Retirada'}`);
  if(order.endereco_entrega) lines.push(`*Endereço:* ${order.endereco_entrega}`);
  if(Number(order.taxa_entrega)>0) lines.push(`*Taxa de entrega:* ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(order.taxa_entrega)}`);
  lines.push(`*Agendado:* ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Fortaleza'}).format(new Date(order.agendado_para))}`);
  lines.push(`*Pagamento:* ${{pix:'Pix',cartao:'Cartão',dinheiro:'Dinheiro'}[order.metodo_pagamento]||order.metodo_pagamento}`);
  if(order.troco_para) lines.push(`*Troco para:* ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(order.troco_para)}`);
  lines.push('',`*Total: ${new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(order.total)}*`);
  const digits=normalizePhone(storePhone);
  return `https://wa.me/${digits.length<=11?'55':''}${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
}
export function todayStart(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Fortaleza', year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return new Date(`${day}T00:00:00-03:00`).toISOString();
}
