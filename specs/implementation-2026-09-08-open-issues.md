# Implementação das 14 issues abertas — 2026-09-08

Pedido: desenvolver todas as issues abertas de TechFernandesLTDA/futeba-dos-parcas.
Base: master e0d1bfaa. Branch: codex/all-open-issues-20260908.
Checkout: /Users/renanlocatizfernandes/.codex/worktrees/futeba-issues-20260908.
Runner original preservado. PR #4116 (estabilização CI) já estava aberto e tem escopo separado.

## Distribuição e estado da implementação

| Issues | Responsável | Estado |
|---|---|---|
| #4100, #4112, #4113 | account_integrity (Sol/high) | Implementado e revisado; 55 regressões focadas aprovadas |
| #4107, #4110, #4111 | billing_integrity (Terra/high) | Implementado; 89 Jest aprovados e testes web integrados à suíte completa |
| #4096, #4097, #4098, #4109 | ios_parity (Terra/medium) | Implementado; código/testes compilam; link de testes bloqueado por FirebaseCore |
| #4099, #4108, #4114, #4115 | coordenador | Implementado; build Android, matriz de contraste, browser e motion aprovados |

## Evidências já obtidas

- Instalação `npm ci` própria de web/functions concluída com Node 22.23.1.
- Motion: `node --test scripts/check-design-tokens-motion.test.js`: 15 testes aprovados, incluindo swaps de easing/duração e declarações falsas em comentários nas três plataformas. Gate de paridade aprovado.
- Web nativo: `node --test scripts/test-web-native-color-scheme.cjs`: 3 cenários aprovados no Chromium, light/dark/OLED, override da landing e pixels dos ícones com contraste >=3:1.
- ThemeContext e LaunchPage: 16 testes Vitest aprovados (avisos conhecidos do parser CSS jsdom).
- Suíte web completa: 1.561 testes aprovados, 15 pendentes existentes, zero falhas. Build e lint aprovados com Node 22.
- Android `compileDebugKotlin` e `DivisionColorsTest`: aprovados, incluindo badge sólido e todos os fundos translúcidos em NORMAL/HIGH.
- Framework iOS debug simulator: compilação baseline e pós-alteração aprovada. Medição informada pelo agente: 189.228 → 189.236 KB; não afirmar redução de tamanho sem medir o bundle de recursos correspondente.
- Android: SDK local exige ANDROID_HOME=/Users/renanlocatizfernandes/Library/Android/sdk; google-services.json de exemplo copiado para configuração de teste ignorada pelo Git. Não há emulador/imagem Android instalado ou dispositivo conectado nesta verificação.
- Compilação de toda a suíte instrumentada Android encontra APIs antigas em HomeScreenTest, LocationFlowTest, ProfileScreenTest e RankingScreenTest. O teste novo de fonte ampliada não foi executado em dispositivo.
- O teste novo de fonte ampliada compilou isoladamente com um init Gradle temporário limitando o source set AndroidTest; nenhum teste legado foi removido ou alterado. 84 testes da matriz de contraste aprovados.
- iOS: fontes de produção e teste compiladas após o último refactor; execução nativa de testes interrompida no link por `framework FirebaseCore not found`. Nenhuma asserção iOS foi executada.
- Release preparada (não publicada): web 1.56.10, Android 1.39.6/81, iOS 1.8.0/24, Functions 1.12.7. Versões nativas/locks, notas, changelog e bundles alinhados; `release-notes validate` aprovado.

## Entrega e rollout

Implementações e decisões consolidadas. Build/lint web e Functions aprovados. Após reparar a dependência local FFmpeg, suíte completa Functions aprovada: 1.841 testes passaram, 13 pendentes existentes, zero falhas. O PR reúne as 14 referências e as limitações mobile acima. Acompanhar os gates remotos antes de merge.

Nenhum deploy/merge foi feito. Publicar `members.user_id` collection-group e aguardar READY antes das Functions. Tags e GitHub Releases permanecem para a etapa de publicação; as notas estão com `published: false`.

## Operação local

GitHub: a conta global ativa não acessa o repo; conta renanlocatizfernandes tem acesso. Helper `/tmp/futeba-gh-account.py` usa o token do keyring só no processo, sem imprimi-lo. Exemplos: `python3 /tmp/futeba-gh-account.py issue view 4113 --repo TechFernandesLTDA/futeba-dos-parcas --json body`; para git: `python3 /tmp/futeba-gh-account.py git fetch origin master`.

Builds Gradle são serializados. O coordenador recebeu o slot após o último build iOS. Consultas/modelos externos pagos não foram acionados neste trabalho.
