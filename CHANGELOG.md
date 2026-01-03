# Changelog

## [1.3.0] - 2026-01-06

### Novidades

- **Perfil do Jogador**: novos campos de perfil (data de nascimento, genero, altura/peso, pe dominante, posicoes, estilo de jogo e experiencia).
- **Autoavaliacao Inteligente**: notas automaticas calculadas pelo desempenho e combinadas com notas manuais para refletir a forma real do jogador.

### Melhorias

- **Consistencia de Ratings**: notas efetivas aplicadas no mercado de jogadores, comparador, cards e balanceamento de times.
- **Tela Inicial**: ajuste no carregamento de "Meus Proximos Jogos" para evitar cards cortados.

### Ajustes Tecnicos

- **Tema Padrao**: o app agora inicia no tema claro.

## [1.2.0] - 2026-01-05

### Correções (Fixes)

- **Criação de Jogos**: Corrigido bug crítico onde jogos "Apenas Grupo" eram criados sem o campo `dateTime` no banco de dados, tornando-os invisíveis nas listagens.
  - Implementada conversão robusta de Data/Hora usando `java.util.Date` e `java.time.ZoneId` para suportar adequadamente todas as instâncias do Firestore.
  - Adicionado "fallback" de segurança na camada de repositório (`GameRepositoryImpl`) para auto-corrigir jogos criados sem `dateTime` caso o problema ocorra novamente.
- **Compilação**: Resolvido erro de compatibilidade de API (Argument type mismatch) no `CreateGameViewModel` ao converter Timestamp.
- **Performance**: Melhoria na query de buscas de jogos de grupo, otimizando a recuperação de IDs de grupos do usuário.
- **Estabilidade**: Adicionado log de erros detalhado (AppLogger.e) nas Streams do Firestore para facilitar diagnóstico de falhas em tempo real (como índices faltando).
- **Limpeza**: Removidos logs de debug intrusivos que estavam poluindo o Logcat em produção.

### Mudanças Anteriores (Destaques Recentes)

- **Interface**: Melhorias na consistência visual do cabeçalho da "Liga" em relação às outras telas principais.
- **Gamification**: Ajustes nas regras de segurança do Firestore para permitir que donos de jogos validem partidas e atualizem XP.
