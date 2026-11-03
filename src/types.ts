export type Status = 'pendente' | 'preparando' | 'pronto' | 'finalizado';
export interface Produto { id:string; nome:string; descricao:string; preco:number|null; categoria:string; imagem_url:string; is_ativo:boolean; destaque:boolean; unidade:string; unidades_pacote:number; sob_encomenda:boolean; esgotado:boolean; ingredientes:string }
export interface LojaConfig { id:number; aberta:boolean; endereco:string; horarios:string; whatsapp:string; preparo_minutos:number|null; antecedencia_horas:number|null; entrega_ativa:boolean; taxa_entrega:number; area_entrega:string; horarios_semana:Record<string,{abre:string;fecha:string}|null> }
export interface CartItem { produto:Produto; quantidade:number; observacao:string }
export interface ItemPedido { id:string; nome_produto:string; quantidade:number; observacao:string; preco_unitario:number }
export interface Pedido { id:string; numero_pedido:number; nome_cliente:string; status:Status; metodo_pagamento:'pix'|'cartao'|'dinheiro'|'pix_demo'|'retirada'; troco_para?:number|null; status_pagamento:'pendente'|'pago'; total:number; created_at:string; itens_pedido:ItemPedido[]; agendado_para?:string|null;tipo_entrega?:'retirada'|'entrega';endereco_entrega?:string|null;taxa_entrega?:number }
export interface Tracking { numero_pedido:number; status:Status; token:string; total?:number }
