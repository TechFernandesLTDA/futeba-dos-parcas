# 🗺️ Mapeamento do Projeto - Futeba dos Parças

Este documento serve como guia para entender a estrutura do projeto e facilitar a implementação de novas solicitações.

## 📝 Visão Geral

O **Futeba dos Parças** é um ecossistema para gestão de peladas de futebol, composto por um aplicativo Android (nativo) e um backend em Node.js.

- **Objetivo:** Gestão de jogos, confirmações, mensalistas, finanças e estatísticas.
- **Público:** Organizadores e jogadores de futebol amador.

---

## 📂 Estrutura de Diretórios

### 1. 📱 Mobile (`/app`)

Baseado em **Android Nativo (Kotlin)** seguindo os princípios de **Clean Architecture** e o padrão **MVVM**.

- **`src/main/java/com/futebadosparcas/data`**:
  - `api`: Interfaces do Retrofit para chamadas ao backend.
  - `local`: Banco de dados Room para cache local.
  - `repository`: Implementações do Repository Pattern (abstração de dados).
- **`src/main/java/com/futebadosparcas/domain`**: Modelos de dados e **UseCases** (lógica de negócio reutilizável).
- **`src/main/java/com/futebadosparcas/ui`**:
  - `activities`/`fragments`/**Compose Components**: Interface do usuário (estilo Duolingo).
  - `viewmodel`: Lógica de apresentação usando StateFlow/LiveData.
  - `theme`: Design System com as cores Primary (#58CC02) e Accent (#FF9600).
- **`src/main/java/com/futebadosparcas/di`**: Injeção de dependência com **Dagger Hilt**.
- **`src/main/res`**: Recursos visuais (layouts XML, strings, drawables).

### 2. ⚙️ Backend (`/backend`)

Baseado em **Node.js com TypeScript** e **Express**.

- **`src/entities`**: Modelos do banco de dados (TypeORM).
- **`src/controllers`**: Manipulação de requisições HTTP.
- **`src/services`**: Lógica de negócio principal (incluindo `GameGeneratorService`).
- **`src/cron`**: Tarefas agendadas (Geração de jogos para 30 dias e fechamento de listas).
- **`src/websocket`**: Atualizações em tempo real (confirmações, times, notificações).
- **`src/dto`**: Objetos de transferência de dados para validação.
- **`src/routes`**: Endpoints da API protegidos por JWT.
- **`src/migrations`**: Histórico de alterações no banco de dados.

### 3. 🤔 Lógicas e Estética Específicas

- **Estética Duolingo:** O app deve ser vibrante, com animações de sucesso, badges de XP e indicadores de "streaks" (jogos seguidos).
- **Regras de Negócio (RN):** Consulte a seção 8 da [Documentação Técnica](file:///c:/Projetos/Futeba%20dos%20Par%C3%A7as/documentacao_tecnica_futeba_dos_parcas.md) para detalhes sobre cancelamento, mensalistas vs avulsos (RN002) e recálculo de estatísticas (RN012).
- **Real-time:** O sistema usa WebSockets para que a lista de confirmados e os times apareçam na hora para todos os jogadores.

---

## 🚀 Guia para Novas Solicitações

Quando receber uma nova tarefa, siga este fluxo mental:

### Passo 1: Identificar o Escopo

- **Backend necessário?** (Novas rotas, novos campos no banco).
- **UI necessária?** (Novas telas, botões, filtros).
- **Estatísticas envolvidas?** (Verificar triggers ou lógicas de agregação).

### Passo 2: Alterações no Backend

1. Se houver novos dados, crie/altere a **Entity** em `backend/src/entities`.
2. Adicione a lógica no **Service** correspondente.
3. Exponha via **Controller** e **Route**.
4. Teste o endpoint (ex: via Postman ou logs internos).

### Passo 3: Alterações no Mobile

1. Atualize o modelo em `domain`.
2. Adicione a chamada na interface `api` em `data`.
3. Atualize o `Repository` para lidar com o novo dado (seja local ou remoto).
4. Implemente a lógica no `ViewModel`.
5. Atualize a UI (XML e Activity/Fragment).

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologias Principais |
| :--- | :--- |
| **Mobile** | Kotlin, MVVM, Room, Retrofit, Coroutines, Dagger Hilt |
| **Backend** | Node.js, TypeScript, Express, TypeORM |
| **Banco de Dados** | PostgreSQL |
| **Tempo Real** | WebSockets |
| **Notificações** | Firebase Cloud Messaging (FCM) |

---

## 📌 Links Importantes

- [Documentação Técnica Completa](file:///c:/Projetos/Futeba%20dos%20Par%C3%A7as/documentacao_tecnica_futeba_dos_parcas.md)
- [Repositório Principal](https://github.com/renanfernandesprimedb/futeba-dos-parcas) (Exemplo)

> [!TIP]
> Sempre verifique se uma nova regra de negócio afeta as estatísticas dos jogadores. O sistema de estatísticas é um dos diferenciais do app.
