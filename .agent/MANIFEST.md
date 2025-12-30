# 🤖 AGENT MANIFEST & ENVIRONMENT SPEC

Este arquivo é a "Verdade Absoluta" sobre o ambiente operacional, permissões e capacidades do Agente neste projeto.

## 🖥️ Ambiente Operacional

| Propriedade | Valor | Notas |
|-------------|-------|-------|
| **OS** | Windows | Usar caminhos com backslash `\` |
| **Shell** | PowerShell | Comandos devem ser compatíveis com PS |
| **Root Path** | `c:\Projetos\Futeba dos Parças` | Caminho base absoluto |
| **Timezone** | `America/Sao_Paulo` (GMT-3) | Horário local do usuário |
| **Encoding** | UTF-8 | Padrão para todos os arquivos |

## 🛠️ Stack & Ferramentas

| Ferramenta | Versão | Comando de Verificação |
|------------|--------|------------------------|
| **Kotlin** | 2.0.21 | Definido em `libs.versions.toml` |
| **Java/JDK** | 17 (Recomendado) | `java -version` |
| **Gradle** | 8.x | `./gradlew --version` |
| **Node.js** | 18+ (Backend/Functions) | `node -v` |
| **Firebase CLI** | Latest | `firebase --version` |

## 🔐 Permissões & Acessos

### Sistema de Arquivos

- **Leitura**: `.agent/*`, `app/*`, `backend/*`, `scripts/*`
- **Escrita**: Todo o projeto (Exceto `.git`)
- **Execução**: Scripts em `scripts/`, `./gradlew`, `npm`

### Firebase (via Service Account)

- **Credencial**: `backend/futebadosparcas-firebase-adminsdk-fbsvc-b5fb25775d.json`
- **Nível**: **ADMIN** (Leitura/Escrita Irrestrita)
- **Restrições**:
  - ❌ NUNCA deletar collection `users` em produção.
  - ⚠️ Cuidado extremo com `firestore.rules`.
  - ✅ Preferir usar emuladores ou ambiente de dev se disponível.

## 📂 Mapa de Conhecimento (Docs)

Onde encontrar as informações vitais:

| Categoria | Arquivo | Descrição |
|-----------|---------|-----------|
| **Regras (A)** | `.agentrules` | Regras de ouro de codificação e arquitetura |
| **Contexto (B)** | `GEMINI.md` | Guia específico para o modelo Gemini |
| **Estado (C)** | `.agent/PROJECT_STATE.md` | O que está pronto, em progresso e pendente |
| **Specs (D)** | `.agent/docs/IMPLEMENTACAO.md` | Detalhes técnicos da implementação atual |
| **Reference (E)** | `.agent/QUICK_REFERENCE.md` | Snippets, Schemas e IDs rápidos |
| **Roadmap (F)** | `.agent/docs/ROADMAP_FIREBASE_2025.md` | Planejamento futuro |
| **Logs (G)** | `.agent/archive/*` | Histórico de correções e alterações antigas |

## 🚀 Capacidades do Agente

O que eu POSSO fazer sem pedir permissão explícita (SAFE):

1. **Ler** qualquer arquivo do projeto.
2. **Listar** diretórios.
3. **Executar** build (`./gradlew assembleDebug`).
4. **Executar** testes (`./gradlew test`).
5. **Executar** lint (`./gradlew lint`).
6. **Criar** arquivos novos (se solicitado).
7. **Mover/Organizar** arquivos de documentação (como feito nesta task).

O que requer **ATENÇÃO** ou **APROVAÇÃO TÁCITA**:

1. **Deletar** arquivos de código fonte.
2. **Deploy** (`firebase deploy`).
3. **Instalar** novas dependências npm/gradle.
4. **Rewrites** grandes em arquivos core (`GameRepositoryImpl.kt`).

---
**Hash de Integridade**: `MANIFEST_V1_2024_12_27`
