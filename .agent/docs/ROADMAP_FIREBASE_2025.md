# Roadmap Firebase 2025: Modernização e Governança
>
> Baseado no "Padrão Ouro" de desenvolvimento Android Moderno (2025)

Este documento define o plano estratégico para a infraestrutura Firebase do projeto "Futeba dos Parças", com foco inicial em **Organização, Permissões e Multi-ambiente**, seguidos por Observabilidade e CI/CD.

---

## 📅 Resumo do Roadmap

| Fase | Foco | Status |
|------|------|--------|
| **Fase 0** | **Setup Windows & CLI** (Padronização do Ambiente Local) | 🚀 Prioridade Imediata |
| **Fase 1** | **Multi-ambiente & Governança** (Dev/Stg/Prod) | 🚀 Prioridade Imediata |
| **Fase 2** | **Segurança "Nível Banco"** (Rules, IAM, App Check) | 🚧 Planejado |
| **Fase 3** | **Modelagem & Performance** (Índices, Offline, Cache) | 🚧 Planejado |
| **Fase 4** | **Observabilidade & Qualidade** (Crashlytics, Perf, Analytics) | 🚧 Planejado |
| **Fase 5** | **CI/CD Automatizado** (GitHub Actions) | 🚧 Planejado |

---

## 🛠️ Fase 0: Setup & Organização (Local Environment)

**Objetivo**: Garantir que todo desenvolvedor no Windows consiga rodar o backend localmente sem "gambiarras".

### 1.1 Pré-requisitos (Windows 10/11)

- [ ] **Node.js LTS** (v20+): `node --version`
- [ ] **Java JDK 17+** (para Emuladores): `java --version`
- [ ] **PowerShell Core** (recomendado) ou Terminal Padrão.

### 1.2 Guia de Comandos Firebase CLI

Passo a passo para setup limpo no Windows:

```powershell
# 1. Instalar Firebase Tools globalmente
npm install -g firebase-tools

# 2. Login (abre navegador)
firebase login

# 3. Listar projetos e verificar acesso
firebase projects:list

# 4. Inicialização no diretório do projeto (se já não existir)
# Selecionar: Firestore, Functions, Storage, Emulators, Remote Config
firebase init

# 5. Adicionar Alias de Projetos (Essencial para Multi-ambiente)
# Associa o projeto 'futeba-dev-123' ao alias 'dev'
firebase use --add futeba-dev-123 --alias dev
firebase use --add futeba-stg-123 --alias staging
firebase use --add futebadosparcas --alias prod
```

### 1.3 Emuladores Locais

Para não sujar o banco de produção durante o desenvolvimento:

```powershell
# Iniciar emuladores (Firestore, Auth, Functions)
firebase emulators:start

# DICA: Use --import e --export para persistir dados locais
firebase emulators:start --import=./firebase-data --export-on-exit
```

**Definition of Done (DoD):**

- [ ] `firebase-tools` atualizado na máquina de dev.
- [ ] `firebase emulators:start` roda sem erros de porta ou Java.
- [ ] App Android conecta em `10.0.2.2` (emulador) e funciona offline.

---

## 🔐 Fase 1: Multi-ambiente & Governança

**Objetivo**: "Ninguém deploya em produção sem pipeline". Separar dados de teste dos dados reais dos usuários.

### 2.1 Estrutura de Projetos (Recomendada)

Usaremos 3 projetos Firebase distintos, gerenciados pelo `.firebaserc`.

| Ambiente | Alias CLI | ID do Projeto (Exemplo) | Propósito |
|----------|-----------|--------------------------|-----------|
| **Local** | `default` | (Emuladores) | Desenvolvimento diário na máquina local. |
| **Dev** | `dev` | `futeba-dev` | Deploy manual para testes rápidos de integração. |
| **Staging**| `staging` | `futeba-stg` | Réplica de Prod. Onde o QA aprova a versão. |
| **Prod** | `prod` | `futebadosparcas` | **Somente via CI/CD**. Dados reais. |

### 2.2 Configuração por Ambiente (.firebaserc)

A configuração atual (`.firebaserc`) deve ser expandida:

```json
{
  "projects": {
    "dev": "futeba-dev",
    "staging": "futeba-stg",
    "prod": "futebadosparcas"
  }
}
```

### 2.3 Workflow de Deploy Seguro

Nunca usar `firebase deploy` sem argumentos em produção.

```powershell
# ✅ CERTO no dia-a-dia (aponta para dev)
firebase use dev
firebase deploy

# ❌ PROIBIDO (direto em prod)
firebase use prod
firebase deploy
```

**Definition of Done (DoD):**

- [ ] Projetos Dev e Staging criados no Console Firebase.
- [ ] `.firebaserc` atualizado com os aliases.
- [ ] `google-services.json` separado por Build Type (flavors) no Android.

---

## 🛡️ Fase 2: Segurança "Nível Banco"

**Objetivo**: Proteger dados de usuários e evitar custos por abuso.

### 3.1 App Check & Play Integrity

Obrigatório para impedir chamadas de API fora do app oficial.

- [ ] Ativar **App Check** no Console.
- [ ] Implementar SDK no Android (`play-integrity` provider).
- [ ] Configurar regras de Firestore/Storage para rejeitar tráfego sem token válido (após período de monitoramento).

### 3.2 Firestore Security Rules (Checklist)

Refatorar `firestore.rules` seguindo boas práticas:

- [ ] **Schema Validation**: Validar tipos de dados (`is String`, `size() < 100`).
- [ ] **Role-based Access**: Funções auxiliares `isAdmin()`, `isOwner(userId)`.
- [ ] **Imutabilidade**: Bloquear alteração de campos críticos (`createdAt`, `createdBy`).
- [ ] **Testes de Regras**: Criar testes unitários para o arquivo de regras.

Exemplo de estrutura:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() { return request.auth != null; }
    
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if request.auth.uid == userId; // Só o dono edita
    }
  }
}
```

### 3.3 IAM (Identity Access Management)

- [ ] Remover permissão de "Editor" de todos os desenvolvedores no projeto de Produção.
- [ ] Usar Service Accounts separadas para o CI/CD.

---

## 📊 Fase 3: Modelagem & Performance

**Objetivo**: Escalabilidade e custo baixo.

- [ ] **Auditoria de Índices**: Remover índices compostos não usados.
- [ ] **Desnormalização**: Avaliar necessidade de replicar dados (ex: `userName` dentro de `games`) para economizar leituras.
- [ ] **Atomicidade**: Revisar transações (como contadores de jogadores) para evitar race conditions.

---

## 📉 Fase 4: Custos & Escalabilidade

**Guia "Anti-Susto":**

1. **Cotas de Uso**: Configurar alertas de orçamento no GCP (ex: R$ 50/mês, R$ 200/mês).
2. **Kill Switch via Remote Config**: Criar flag `maintenance_mode` que bloqueia leituras no Android instantaneamente em caso de erro crítico.
3. **TTL (Time To Live)**: Configurar deleção automática de logs e notificações antigas.

---

## 🚀 Fase 5: CI/CD & Automação

**Stack Sugerida**: GitHub Actions.

Pipeline de referência (`deploy-prod.yml`):

1. **Check**: Lint + Unit Tests.
2. **Build**: Gerar APK/AAB de Release.
3. **Deploy Firebase**:
   - Atualizar Rules (`firestore.rules`, `storage.rules`).
   - Atualizar Indexes.
   - Deploy de Functions (se houver).
   - *Somente se build passar e for na branch main.*

---
**Documento gerado em**: 27/12/2024
**Status**: Fase 0 e 1 iniciadas.
