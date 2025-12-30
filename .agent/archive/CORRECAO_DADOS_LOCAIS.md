# Correção e Restauração de Dados de Locais

**Data**: 27/12/2024
**Problema**: 30 Locais legados apresentando "0 quadras" no app.

## 🛠️ Soluções Aplicadas

### 1. Robustez na Query (LocationRepository)

A query que buscava as quadras foi simplificada para remover dependências de índices compostos (`is_active` + `location_id`). Agora a filtragem de ativos é feita no lado do cliente (Kotlin), garantindo que se os dados existirem no banco, eles serão retornados.

### 2. Restauração Automática (LegacyDataRestorer)

Implementado um sistema de verificação e restauração automática que roda na inicialização do app (`Application.onCreate`).

- **Arquivo**: `com.futebadosparcas.util.LegacyDataRestorer`
- **Funcionamento**:
    1. Verifica a existência dos 30 locais listados (JB Esportes, Brasil Soccer, etc).
    2. Se o local não existir, cria o registro.
    3. Se o local existir mas não tiver quadras (0 fields), cria as quadras conforme especificação (Futsal/Society, quantidades, infraestrutura).
    4. Se o local já tiver quadras, não faz nada (preserva dados).

## 🚀 Como Validar

1. Recompile e instale o app.
2. Abra o aplicativo (isso disparará o processo de restauração em segundo plano).
3. Aguarde alguns segundos.
4. Vá para a tela de "Gerenciar Locais" ou lista de locais.
5. As quadras devem aparecer corretamente.

## 📝 Lista de Locais Restaurados

- JB Esportes & Eventos (8 quadras)
- Brasil Soccer (5 quadras)
- Top Sports (6 quadras)
- ... e outros 27 locais.
