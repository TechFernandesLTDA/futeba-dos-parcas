# Contexto do Projeto: Futeba dos Parças

## Visão Geral

Aplicativo Android para organização e gestão de partidas de futebol amador (rachas/peladas).
O foco é permitir agendamento de jogos, confirmação de presença de jogadores, sorteio de times e estatísticas simples.

## Arquitetura

O projeto utiliza uma arquitetura MVVM (Model-View-ViewModel) baseada nos componentes do Android Jetpack.

### Camadas

1. **UI (View)**: Fragments e Activities. Responsáveis por exibir dados e capturar interações do usuário. Usam ViewBinding.
2. **Presentation (ViewModel)**: Gerencia o estado da UI (`StateFlow/LiveData`) e interage com o Repositório. Sobrevive a mudanças de configuração.
3. **Data (Repository)**: Abstrai a fonte de dados (Firebase). Única fonte de verdade para o ViewModel.
4. **Model**: Data Classes (POJOs) que representam as entidades do domínio (Game, User, Team).

## Backend

O projeto atualmente utiliza **Firebase** como backend (diferente da documentação legada que citava Node.js).

- **Firestore**: Banco de dados NoSQL para armazenar Jogos, Usuários, Confirmações.
- **FirebaseAuth**: Autenticação de usuários.

## Principais Funcionalidades Implementadas

- Login/Cadastro (Firebase Auth).
- Listagem de Jogos Agendados.
- Criação de Jogos (com recorrência, local, horário).
- Detalhes do Jogo (Lista de confirmados, botão de presença).
- Perfil do Usuário.

## Estrutura de Pastas Importantes

- `ui/`: Contém subpacotes por feature (`games`, `profile`, `home`).
- `data/model/`: Classes de domínio (`Game.kt`, `User.kt`).
- `data/repository/`: Lógica de acesso a dados (`GameRepository.kt`, `AuthRepository.kt`).
- `di/`: Configuração de Injeção de Dependência (Hilt Module).
