# Futeba dos Parças - Web (WasmJs)

Documentação completa para desenvolvimento, build e deploy da versão web do aplicativo usando Kotlin/Wasm com Compose Multiplatform.

---

## Visão Geral

A versão web do **Futeba dos Parças** é construída com **Kotlin/Wasm** (WebAssembly) e **Compose Multiplatform**, permitindo compartilhar código entre Android, iOS e Web.

### Stack Tecnológica

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Kotlin | 2.2.10 | Linguagem principal |
| Compose Multiplatform | 1.10.0 | UI declarativa multiplataforma |
| Skiko | (via CMP) | Renderização Canvas para Web |
| Firebase JS SDK | 8.10.1 | Auth, Firestore (via interop JS) |
| Service Worker | - | PWA, cache offline |

---

## Como Rodar Localmente

### Pré-requisitos

- **JDK 17+** (recomendado JDK 21)
- **Node.js 18+** (para servir arquivos estáticos)
- **Browser moderno** com suporte a WebAssembly (Chrome, Firefox, Edge, Safari 14+)

### Desenvolvimento

```bash
# Clonar o repositório
git clone https://github.com/TechFernandesLTDA/futeba-dos-parcas.git
cd futeba-dos-parcas

# Rodar em modo desenvolvimento (hot reload)
./gradlew :composeApp:wasmJsBrowserDevelopmentRun

# Ou no Windows:
gradlew.bat :composeApp:wasmJsBrowserDevelopmentRun
```

O servidor de desenvolvimento iniciará em `http://localhost:8080` (ou porta disponível próxima).

### Parar o Servidor

Pressione `Ctrl+C` no terminal.

---

## Como Fazer Build de Produção

### Build Completo

```bash
# Gerar artefatos otimizados de produção
./gradlew :composeApp:wasmJsBrowserProductionWebpack

# Ou no Windows:
gradlew.bat :composeApp:wasmJsBrowserProductionWebpack
```

### Localização dos Artefatos

Após o build, os arquivos de produção ficam em:

```
composeApp/build/dist/wasmJs/productionExecutable/
├── composeApp.js          # Bundle JavaScript principal
├── composeApp.wasm        # Binary WebAssembly
├── skiko.js               # Runtime Skiko para Canvas
├── index.html             # Página principal
├── manifest.json          # PWA manifest
├── sw.js                  # Service Worker
└── icons/                 # Ícones PWA
```

### Testar Build de Produção Localmente

```bash
# Instalar servidor estático (uma vez)
npm install -g serve

# Servir arquivos de produção
serve -s composeApp/build/dist/wasmJs/productionExecutable -l 3000
```

Acesse `http://localhost:3000`.

---

## Como Fazer Deploy

### Firebase Hosting (Recomendado)

#### Configuração Inicial (uma vez)

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar hosting no projeto
firebase init hosting
```

Quando perguntado:
- **Public directory**: `composeApp/build/dist/wasmJs/productionExecutable`
- **Single-page app**: Yes
- **Overwrite index.html**: No

#### Deploy

```bash
# Build de produção
./gradlew :composeApp:wasmJsBrowserProductionWebpack

# Deploy para Firebase Hosting
firebase deploy --only hosting
```

URL de produção: `https://futebadosparcas.web.app`

### GitHub Pages

1. Adicionar workflow em `.github/workflows/deploy-web.yml`:

```yaml
name: Deploy Web to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
      
      - name: Build Web
        run: ./gradlew :composeApp:wasmJsBrowserProductionWebpack
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: composeApp/build/dist/wasmJs/productionExecutable

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

2. Habilitar GitHub Pages nas configurações do repositório (Source: GitHub Actions)

### Vercel / Netlify

1. Conectar repositório à plataforma
2. **Build command**: `./gradlew :composeApp:wasmJsBrowserProductionWebpack`
3. **Output directory**: `composeApp/build/dist/wasmJs/productionExecutable`
4. Deploy automático a cada push

---

## Estrutura de Pastas

```
composeApp/
├── src/
│   ├── commonMain/           # Código compartilhado (Android/iOS/Web)
│   │   └── kotlin/com/futebadosparcas/
│   │       ├── ui/           # Telas e componentes UI
│   │       ├── navigation/   # Navegação
│   │       └── ...
│   │
│   ├── androidMain/          # Código específico Android
│   │
│   ├── iosMain/              # Código específico iOS
│   │
│   └── wasmJsMain/           # ⭐ Código específico Web
│       ├── kotlin/com/futebadosparcas/
│       │   ├── compose/      # Entry point Compose
│       │   ├── firebase/     # Interop Firebase JS
│       │   ├── navigation/   # Navegação browser history
│       │   ├── pwa/          # PWA install helpers
│       │   ├── ui/           # UI específica web
│       │   └── util/         # Utilitários JS interop
│       │
│       └── resources/        # Assets web
│           ├── index.html    # Página principal
│           ├── manifest.json # PWA manifest
│           ├── sw.js         # Service Worker
│           └── icons/        # Ícones PWA
│
└── build.gradle.kts          # Configuração wasmJs
```

---

## Dependências e Versões

### Gradle (build.gradle.kts)

```kotlin
kotlin {
    wasmJs {
        browser {
            commonWebpackConfig {
                outputFileName = "composeApp.js"
            }
        }
        binaries.executable()
    }

    sourceSets {
        wasmJsMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
        }
    }
}
```

### Dependências Principais

| Dependência | Versão | Notas |
|-------------|--------|-------|
| Compose Multiplatform | 1.10.0 | BOM gerenciado |
| Navigation Compose | 2.9.1 | Navegação multiplataforma |
| Lifecycle ViewModel | 2.9.6 | ViewModels compartilhados |
| Coil 3 | 3.0.4 | Image loading (multiplatform) |
| Kotlin stdlib | 2.2.10 | Forçado para compatibilidade |

### Firebase JS SDK (index.html)

```html
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
```

> **Nota**: Usamos Firebase SDK v8 (compat mode) para interop com Kotlin/Wasm. Migração para v9 modular planejada.

---

## PWA (Progressive Web App)

### Funcionalidades Implementadas

- ✅ **Installável**: Pode ser instalado como app nativo
- ✅ **Offline**: Cache de assets estáticos via Service Worker
- ✅ **Splash Screen**: Loading animado enquanto wasm carrega
- ✅ **Manifest**: Configuração completa de PWA

### Arquivos PWA

| Arquivo | Propósito |
|---------|-----------|
| `manifest.json` | Metadados do app, ícones, cores |
| `sw.js` | Service Worker, estratégias de cache |
| `icons/` | Ícones 192x192 e 512x512 (PNG e SVG) |

### Estratégias de Cache

1. **Cache First**: `.wasm`, `.js`, `.css`, imagens (assets estáticos)
2. **Network First**: Firebase (auth, firestore) - dados sempre atualizados
3. **Stale While Revalidate**: HTML e outros recursos

---

## Comandos Úteis

```bash
# Limpar build
./gradlew clean

# Compilar sem rodar (verificar erros)
./gradlew :composeApp:compileKotlinWasmJs

# Build completo
./gradlew :composeApp:wasmJsBrowserProductionWebpack

# Rodar testes (se houver)
./gradlew :composeApp:wasmJsTest

# Verificar tasks disponíveis
./gradlew :composeApp:tasks --group="web application"
```

---

## Browser Suportados

| Browser | Versão Mínima | Status |
|---------|---------------|--------|
| Chrome | 90+ | ✅ Totalmente suportado |
| Firefox | 89+ | ✅ Totalmente suportado |
| Edge | 90+ | ✅ Totalmente suportado |
| Safari | 15+ | ⚠️ Testar (WebAssembly limitações) |
| Opera | 76+ | ✅ Totalmente suportado |

> **Nota**: Safari pode ter limitações com WebAssembly SIMD e algumas APIs de PWA.

---

## Troubleshooting

Consulte [WEB_TROUBLESHOOTING.md](./WEB_TROUBLESHOOTING.md) para:
- Erros comuns e soluções
- Debug tips
- Browser compatibility issues

---

## Próximos Passos

1. [ ] Adicionar testes automatizados para Web
2. [ ] Migrar Firebase SDK v8 → v9 (modular)
3. [ ] Implementar push notifications web
4. [ ] Otimizar tamanho do bundle wasm
5. [ ] Adicionar suporte a dark/light theme toggle

---

## Referências

- [Compose Multiplatform Docs](https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-multiplatform-getting-started.html)
- [Kotlin/Wasm Docs](https://kotl.in/wasm-help)
- [Firebase Web Docs](https://firebase.google.com/docs/web/setup)
- [PWA Guidelines](https://web.dev/progressive-web-apps/)

---

**Dúvidas?** Abra uma issue ou consulte a equipe de desenvolvimento.
