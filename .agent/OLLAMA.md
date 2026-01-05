# 🦙 Ollama Cloud & Model Stratification

Este arquivo define a estratégia de uso dos modelos via Ollama Cloud Integration no projeto Futeba dos Parças.

## 🏆 Ranking & Seleção de Modelos

| Rank | Modelo (Cloud) | Comando CLI | Especialidade | Contexto |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `qwen3-coder:480b-cloud` | `ollama run qwen3-coder:480b-cloud` | **Heavy Coding** (Refatoração estrutural, geração em massa) | Alta |
| **2** | `deepseek-v3.1:671b-cloud` | `ollama run deepseek-v3.1:671b-cloud` | **Raciocínio + Implementação** (Design patterns, lógica complexa) | Alta |
| **3** | `gpt-oss:120b-cloud` | `ollama run gpt-oss:120b-cloud` | Generalista Equilibrado | Média |
| **4** | `glm-4.7:cloud` | `ollama run glm-4.7:cloud` | **Long Context** (Análise de logs, múltiplos arquivos) | **198K** |
| **5** | `gpt-oss:20b-cloud` | `ollama run gpt-oss:20b-cloud` | Tarefas rápidas / leves | Baixa |

## 🚀 Diretrizes de Uso

### Quando usar qual?

1. **Refatoração Pesada / Boilerplate (`qwen3-coder`)**:
    * Criar múltiplos arquivos de uma vez.
    * Migração de Java para Kotlin em massa.
    * Gerar testes unitários para módulos inteiros.

2. **Arquitetura & Design (`deepseek-v3.1`)**:
    * Decidir como implementar uma nova feature complexa.
    * Resolver bugs lógicos difíceis (race conditions, data consistency).
    * "Raciocinar antes de codar".

3. **Contexto Extenso (`glm-4.7`)**:
    * "Analise todos os arquivos de layout do projeto".
    * "Verifique duplicidade nesses 50 arquivos".
    * Entender o histórico completo de um bug.

### 🔧 Setup

Certifique-se de estar logado:

```bash
ollama signin
```

(O ambiente já está autenticado).

## 🤝 Integração com Antigravity

O agente principal (Gemini/Antigravity) atua como orquestrador. Quando uma tarefa se encaixa nos perfis acima, o agente deve delegar usando `run_command`.

Exemplo:

```bash
ollama run qwen3-coder:480b-cloud "Refatore o arquivo X para usar Clean Architecture..."
```
