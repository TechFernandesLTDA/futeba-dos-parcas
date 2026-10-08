# Programa de Parcerias para Quadras e Arenas Society — Futeba dos Parças

## 1. Visão Geral e Contexto

O **Futeba dos Parças** é um produto proprietário da **Tech Fernandes LTDA** (CNPJ 57.285.516/0001-47, Curitiba/PR), desenvolvido para gerenciar peladas, confirmações de presença, escalações e estatísticas de futebol amador.

O programa de parcerias visa conectar arenas e quadras esportivas locais aos organizadores de peladas ativos na plataforma, dando visibilidade aos espaços, inclusive em dias e horários de menor demanda.

---

## 2. Proposta de Valor para Gestores de Arenas

1. **Preenchimento de Horários Ociosos:**
   - Horários de segunda a quinta-feira (18h às 20h ou após as 22h) e finais de semana à tarde costumam ter vacância expressiva.
   - Organizadores escolhem o local do jogo entre os locais cadastrados no app; uma arena listada passa a ser uma opção para eles.

2. **Visibilidade Georreferenciada:**
   - As quadras cadastradas aparecem no mapa interativo (`/map/locations`).
   - Exibição de tipos de quadra (society, futsal, campo, areia) e comodidades cadastradas (estacionamento, banheiro, vestiário, chuveiro, bar, restaurante, churrasqueira, Wi-Fi, ar-condicionado, arquibancada, iluminação, placar eletrônico).

3. **Fidelização de Grupos Mensalistas:**
   - Grupos do app contam com confirmação de presença, lembretes, lista de espera e caixa do grupo para organizar jogos recorrentes. Não há, hoje, métrica que comprove redução de faltas ou inadimplência; não prometer isso a parceiros.

4. **Selo de Quadra Verificada (`is_verified: true`):**
   - O local aparece como verificado no app (sem o aviso "Este local ainda não foi verificado") quando os dados comerciais forem validados pela Tech Fernandes.

---

## 3. Modelo Operacional de Dados e Governança

- **Status inicial:** Conforme diretrizes de governança do produto (AGENTS.md), novos locais importados ou cadastrados entram com `publication_status: DRAFT` e `is_verified: false`.
- **Validação comercial autorizada:** A publicação como `ACTIVE` e com selo `is_verified: true` ocorre somente após confirmação direta com o gestor da arena (telefone, e-mail institucional ou visita).
- **Preços e fotos reais:** Nunca fabricar tabelas de preços ou imagens fictícias. Valores e fotos de divulgação devem ser enviados formalmente pelo gestor responsável ou confirmados na tabela pública do estabelecimento.
- **Campos de snake_case:** Em conformidade com o Firestore em produção, as propriedades do documento `locations/{id}` seguem convenção `snake_case` (`publication_status`, `is_verified`, `has_active_fields`).

---

## 4. Modelos de Apresentação e Contato Comercial (Templates)

> **AVISO DE COMPLIANCE:** Estes modelos são arquivos de documentação para uso exclusivo por operadores humanos autorizados em abordagens comerciais 1-a-1. **Nenhum disparo em massa, spam ou envio automatizado via WhatsApp ou e-mail é permitido sem aprovação prévia de Renan Locatiz Fernandes.**

### 4.1. Template de Primeiro Contato por E-mail (Apresentação Institucional)

**Assunto:** Parceria Futeba dos Parças & Tech Fernandes — Divulgação da [Nome da Arena]

```text
Olá, [Nome do Gestor ou Equipe da Arena],

Meu nome é [Nome do Representante], da Tech Fernandes, empresa de tecnologia de Curitiba/PR desenvolvedora da plataforma Futeba dos Parças (https://futebadosparcas.com.br).

Nosso aplicativo ajuda grupos de futebol amador a organizar peladas: confirmação de presença, sorteio de times, estatísticas e caixa do grupo.

Gostaríamos de convidar a [Nome da Arena] para fazer parte da nossa rede de quadras parceiras. Com isso, os grupos da região poderão:
1. Encontrar sua arena no mapa de locais da cidade com fotos e comodidades completas;
2. Selecionar suas quadras diretamente ao agendar as rodadas semanais;
3. Preencher horários de menor movimento e conectar-se com novos mensalistas.

As condições de cadastro e divulgação são alinhadas diretamente com a arena.

Podemos agendar uma rápida conversa de 5 minutos ou alinhar os dados da arena por aqui?

Atenciosamente,

[Nome do Representante]
Tech Fernandes LTDA
techfernandesltda@gmail.com
https://techfernandes.com.br
```

---

### 4.2. Template de Mensagem para WhatsApp Comercial (Abordagem Direta 1-a-1)

```text
Olá, [Nome do Gestor / Arena]! Tudo bem?

Aqui é da equipe do Futeba dos Parças, aplicativo da Tech Fernandes para organização de peladas e futebol amador (futebadosparcas.com.br).

Queremos incluir a [Nome da Arena] na lista de locais do app, para que grupos de [Cidade/Bairro] possam escolher sua quadra ao marcar jogos.

Se tiver interesse em conhecer como funciona, posso te enviar as informações por aqui? Valeu!
```

---

## 5. Ficha de Coleta de Informações da Arena (Onboarding)

Ao fechar contato com o gestor, coletar os seguintes dados para cadastro no Firestore:

1. **Dados Básicos:**
   - Nome Fantasia do estabelecimento
   - Razão Social e CNPJ (se disponível)
   - Responsável pelo atendimento comercial e WhatsApp
   - Endereço completo com CEP e Ponto de Referência
   - Coordenadas GPS (latitude e longitude para o Geohash)

2. **Infraestrutura:**
   - Quantidade de quadras
   - Dimensões e tipo de piso (Grama Sintética Monofilamento, Fibrilada, Futsal, Areia)
   - Cobertura (Aberta ou Coberta)
   - Iluminação (LED ou Vapor Metálico)

3. **Comodidades:**
   - Vestiários (com/sem chuveiro quente)
   - Churrasqueiras (quantidade e política de uso)
   - Lanchonete / Bar / Espaço de Convivência
   - Estacionamento (gratuito, pago ou vagas na rua)
   - Fornecimento de bolas e coletes

4. **Tabela de Horários e Preços:**
   - Faixa de valor por hora (diurno, noturno, mensalistas)
   - Política de cancelamento de horário

---

## 6. Métricas de Sucesso do Programa

O funil de crescimento para o canal de arenas e quadras é mensurado por:

1. **Visualizações da página `/parcerias`:** Medidas via evento `landing_viewed { page: 'parcerias' }`.
2. **Cliques de interesse comercial:** Medidos via evento `partnership_inquiry_clicked { source: 'partnerships_page' }`.
3. **Novas arenas cadastradas e verificadas:** Contagem de documentos em `locations` com `is_verified: true`.
4. **Jogos agendados em quadras cadastradas:** medidos a partir da coleção `games` (local do jogo); o evento `game_created` (`fieldType`, `groupId`) não carrega o local.
