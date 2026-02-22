# Web Troubleshooting - Futeba dos Parças

Guia de solução de problemas comuns durante desenvolvimento e deploy da versão web (WasmJs).

---

## Erros de Build

### `Unresolved reference: compose` / `Unresolved reference: wasmJs`

**Causa**: Gradle não sincronizou corretamente ou versões incompatíveis.

**Solução**:
```bash
# Limpar caches do Gradle
./gradlew clean --no-daemon
rm -rf ~/.gradle/caches/

# Invalidar caches do IDE (Android Studio/IntelliJ)
# File > Invalidate Caches > Invalidate and Restart

# Sincronizar novamente
./gradlew --refresh-dependencies
```

---

### `Kotlin stdlib version mismatch`

**Causa**: Compose Multiplatform 1.10.0 puxa Kotlin 2.2.21, mas o projeto usa 2.2.10.

**Solução**: Forçar versão no `build.gradle.kts` (já implementado):
```kotlin
configurations.all {
    resolutionStrategy {
        force("org.jetbrains.kotlin:kotlin-stdlib:2.2.10")
        force("org.jetbrains.kotlin:kotlin-stdlib-common:2.2.10")
        force("org.jetbrains.kotlin:kotlin-stdlib-wasm-js:2.2.10")
    }
}
```

---

### `wasmJsBrowserDevelopmentRun` falha com "port already in use"

**Causa**: Porta 8080 já está em uso por outro processo.

**Solução**:
```bash
# Encontrar processo usando a porta (Linux/Mac)
lsof -i :8080

# Matar processo
kill -9 <PID>

# Ou usar porta diferente - adicionar no build.gradle.kts:
commonWebpackConfig {
    devServer = (devServer ?: KotlinWebpackConfig.DevServer()).apply {
        port = 3000
    }
}
```

---

### `OutOfMemoryError: Java heap space` durante build

**Causa**: Build wasm requer mais memória.

**Solução**: Aumentar heap no `gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4g -XX:+HeapDumpOnOutOfMemoryError
org.gradle.parallel=true
org.gradle.caching=true
```

---

## Erros de Runtime

### Tela branca ao carregar

**Causas possíveis**:

1. **JavaScript desabilitado**
   - Habilitar JavaScript no browser

2. **WASM não carregou**
   ```javascript
   // Verificar no console do browser:
   // Erro comum: "CompileError: WebAssembly.instantiate()"
   ```
   
3. **Cache corrompido**
   ```bash
   # Limpar cache do browser (Ctrl+Shift+Delete)
   # Ou hard refresh (Ctrl+Shift+R)
   ```

**Debug**:
```javascript
// Console do browser - verificar se wasm carregou
console.log(typeof WebAssembly); // deve retornar "object"
```

---

### `TypeError: firebase.auth is not a function`

**Causa**: Firebase SDK não carregou antes do código Kotlin executar.

**Solução**: Verificar ordem dos scripts no `index.html`:
```html
<!-- Firebase DEVE vir antes do composeApp.js -->
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>

<script src="skiko.js"></script>
<script src="composeApp.js"></script>
```

---

### `ReferenceError: window is not defined`

**Causa**: Código tentando acessar `window` em contexto onde não existe (SSR, tests).

**Solução**: Verificar se está em contexto browser:
```kotlin
// Em código Kotlin/Wasm
if (jsTypeOf(js("window")) != "undefined") {
    // Código que usa window
}
```

---

### Navegação não funciona (URLs não mudam)

**Causa**: History API não inicializada ou listener não registrado.

**Solução**: Verificar inicialização:
```kotlin
// Verificar se jsInitPopStateListener foi chamado
// Console do browser:
window.jsInitPopStateListener { path -> 
    console.log("Navigation to: $path")
}
```

---

### PWA não instala / botão não aparece

**Causas possíveis**:

1. **Já instalado**
   ```javascript
   // Console
   console.log(window.pwaIsInstalled); // true se já instalado
   ```

2. **Não atendeu critérios PWA**
   - HTTPS obrigatório
   - manifest.json válido
   - Service Worker registrado
   - Ícones presentes

3. **beforeinstallprompt não disparou**
   ```javascript
   // Verificar se o evento foi capturado
   console.log(window.pwaCanInstall); // deve ser true
   ```

**Debug**:
```javascript
// Console do browser
navigator.serviceWorker.getRegistrations().then(regs => {
    console.log('SW registrations:', regs.length);
});
```

---

### Firebase Auth não persiste após refresh

**Causa**: Auth state não está sendo restaurado corretamente.

**Solução**: Verificar listener de auth state:
```kotlin
// Código Kotlin
fun setupAuthListener() {
    js("firebase.auth().onAuthStateChanged(function(user) { ... })")
}
```

**Debug**:
```javascript
// Console do browser
firebase.auth().onAuthStateChanged(user => {
    console.log('Auth state:', user ? user.email : 'null');
});
```

---

## Erros de Deploy

### `firebase deploy` falha com "permission denied"

**Causa**: Usuário não tem permissão no projeto Firebase.

**Solução**:
```bash
# Verificar login atual
firebase login:ci

# Relogar
firebase logout
firebase login

# Verificar projeto
firebase use --add
```

---

### Build funciona localmente mas falha no CI

**Causas comuns**:

1. **Versão diferente do Java**
   ```yaml
   # GitHub Actions - especificar versão
   - uses: actions/setup-java@v4
     with:
       java-version: '21'
   ```

2. **Cache do Gradle corrompido**
   ```yaml
   # Limpar cache no CI
   - name: Clean Gradle Cache
     run: rm -rf ~/.gradle/caches/
   ```

3. **Memória insuficiente**
   ```yaml
   - name: Build
     run: ./gradlew :composeApp:wasmJsBrowserProductionWebpack
     env:
       JAVA_OPTS: "-Xmx4g"
   ```

---

### `404 Not Found` após deploy

**Causa**: Servidor não configurado para SPA (Single Page Application).

**Solução**: Configurar redirecionamento para `index.html`:

**Firebase Hosting** (`firebase.json`):
```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**Netlify** (`_redirects`):
```
/*    /index.html   200
```

**Vercel** (`vercel.json`):
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## Debug Tips

### Console Logging

```kotlin
// Em Kotlin/Wasm
println("Debug message") // Vai para console do browser

// Ou usar console diretamente
js("console.log('Direct JS log')")
```

### Verificar Tamanho do Bundle

```bash
# Após build de produção
ls -lh composeApp/build/dist/wasmJs/productionExecutable/

# Tamanho esperado:
# composeApp.js:  ~500KB - 2MB
# composeApp.wasm: ~5MB - 15MB
```

### Debug Service Worker

```javascript
// Chrome DevTools > Application > Service Workers
// Verificar status, update, unregister

// Forçar update
navigator.serviceWorker.getRegistration().then(reg => {
    reg?.update();
});
```

### Debug Firebase

```javascript
// Habilitar debug do Firebase
firebase.firestore.setLogLevel('debug');

// Verificar conexão
firebase.firestore().collection('test').get()
    .then(() => console.log('Firestore OK'))
    .catch(err => console.error('Firestore Error:', err));
```

### Performance Profiling

```javascript
// Chrome DevTools > Performance > Record
// Medir tempo de:
// - Download do WASM
// - Inicialização do Skiko
// - First paint do Compose
```

---

## Browser Compatibility

### Safari Específico

| Problema | Solução |
|----------|---------|
| WebAssembly SIMD não suportado | Safari 15.4+ necessário |
| PWA install não aparece | Safari não suporta install prompt nativo |
| Push Notifications | Não suportado no iOS |
| IndexedDB quota baixa | Safari tem limite de 1GB |

### Firefox Específico

| Problema | Solução |
|----------|---------|
| `dom.moduleScripts.enabled` | Firefox 89+ não precisa |
| Service Worker em localhost | Funciona, mas requer HTTPS em produção |

### Chrome Específico

| Problema | Solução |
|----------|---------|
| `chrome://flags/#enable-webassembly` | Habilitar se WASM não funcionar |
| CORS errors | Usar servidor local, não file:// |

---

## Checklist de Debug

Quando algo não funcionar:

- [ ] Browser suporta WebAssembly? (`typeof WebAssembly`)
- [ ] Console do browser tem erros?
- [ ] Service Worker registrado? (DevTools > Application)
- [ ] Firebase inicializado? (`firebase.app()` no console)
- [ ] Manifest.json válido? (DevTools > Application > Manifest)
- [ ] HTTPS em produção? (obrigatório para PWA)
- [ ] Cache limpo? (Ctrl+Shift+R / hard refresh)
- [ ] Versões do Gradle/Kotlin compatíveis?

---

## Contato e Suporte

- **Issues**: [GitHub Issues](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues)
- **Documentação**: [docs/](./)
- **CLAUDE.md**: Instruções para desenvolvimento com IA

---

**Última atualização**: Fevereiro 2026
