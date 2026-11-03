# Salgados da Sica

Catálogo, encomendas, cozinha e gestão em React + TypeScript, Tailwind, componentes Shadcn/Radix, Lucide, Recharts e Supabase. A marca e a logo são da Salgados da Sica; o nome técnico do repositório permanece `salgadinhos`.

## Usar

1. Abra **Gestão** e entre com a conta autorizada. No primeiro acesso, crie a conta com o e-mail autorizado e confirme o e-mail. Não há senha padrão.
2. Em **Produtos e disponibilidade**, edite os salgados, preço por unidade/kit/cento, quantidade no pacote e ingredientes. Envie fotos JPG/PNG/WebP de até 5 MB. Arquivar preserva histórico; esgotar bloqueia novas compras.
3. Confira **Atendimento e encomendas**. WhatsApp, endereço e horários já foram configurados no banco com os dados fornecidos pelo responsável. Segunda fechado; terça a sábado 09–18h; domingo 10–14h. Antecedência mínima: 3 horas para todos os pedidos.
4. Cadastre pelo menos um preço válido e clique **Abrir loja**. Valores não definidos aparecem como “Em breve” e não podem ser comprados. Entregas podem ser habilitadas em Atendimento e encomendas após definir bairros atendidos e taxa.
5. A cozinha recebe pedidos em Realtime. Arraste para a próxima coluna ou use os botões. Confirme recebimento do pagamento antes de finalizar. Ative o som para os avisos.

As sugestões de cardápio precisam de revisão do responsável. A imagem de capa é ilustrativa, gerada por IA; a logo foi fornecida pelo usuário e preservada. O checkout salva o pedido e abre uma mensagem pronta no WhatsApp; pagamento é combinado e confirmado pela equipe. O aceite de ofertas é opcional e desmarcado por padrão.

## Estrutura

```text
src/components/    Catálogo, checkout, acompanhamento, cozinha e gestão
src/components/ui/ Button e Dialog (Shadcn/Radix)
src/hooks/         Catálogo, autenticação e pedidos Realtime
src/lib/           Cliente Supabase, preços e validação de agenda e mensagem de pedido para WhatsApp
supabase/          Evolução SQL e verificações transacionais
public/            Logo e imagem ilustrativa da capa
tests/             Testes de preços, telefone e agenda
```

## Desenvolvimento

Node.js 24 ou compatível com Vite 8. Execute `npm ci`, `npm run dev`. Valide com `npm test` e `npm run build`. Dependências fixadas no lockfile.

O cliente usa somente a chave **publishable**, segura para frontend quando combinada com RLS. Nenhuma chave administrativa ou senha é publicada. `.env.example` permite apontar para outro ambiente.

## Banco e permissões

Projeto Supabase: `wfzdzhsxdqagckmzqnta`. Tabelas de outros sistemas foram preservadas. Ordem de implantação em um banco novo: `schema.sql`, `sica.sql`, `sica-hardening.sql`, `sica-agenda.sql`. As migrações já foram aplicadas ao projeto indicado; não as reaplique manualmente nele.

Clientes anônimos leem apenas catálogo/configuração; checkout e acompanhamento passam por funções limitadas. Equipe depende de usuário autenticado, e-mail confirmado e registro em `lanchonete_private.equipe`, administrado exclusivamente no banco. O e-mail autorizado não é embutido no frontend nem neste repositório público.

O servidor valida preço, produto disponível, antecedência, dias/horários, entrega e idempotência. Taxa de entrega é fixa, conforme configuração. Endereço dentro da área é declarado pelo cliente e deve ser conferido pela equipe; não há roteirização ou validação geográfica automática.

Pedidos e configuração usam Postgres Changes; acompanhamento usa um canal com token aleatório e recarrega o status oficial ao receber um evento. Reconsulta periódica cobre reconexão. Confirmação de telefone por número de pedido não equivale a login: a consulta retorna apenas andamento, nunca dados pessoais.

## Verificação e limites

`npm test`: cálculos monetários, telefone, fuso, dias de funcionamento, antecedência e indisponibilidade. `supabase/verify.sql`: testes de integração com rollback, incluindo taxa, idempotência, sigilo dos dados, validação do pedido WhatsApp e consentimento opcional.

O cadastro/login depende das configurações de e-mail do Supabase. Adicione a URL publicada à lista de redirect URLs em Auth para retorno ao app após confirmação. A confirmação de e-mail e login da conta real devem ser feitos pelo titular; não são simulados por bypass.

Antes de abrir ao público: preencher preços e conferir cardápio, validar o primeiro login e um pedido real, configurar SMTP para volume de produção e proteção contra abuso conforme tráfego. O limite básico por telefone não substitui proteção por IP/CAPTCHA para tráfego aberto. Não foram feitos testes de carga ou integração bancária.
