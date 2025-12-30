# Regras de Desenvolvimento e Comportamento do Agente

## 1. Edição de Arquivos

- **PREFERÊNCIA**: Ao editar arquivos logicamente estruturados (XML, Classes Kotlin completas), prefira usar a ferramenta `write_to_file` para reescrever o arquivo inteiro com as modificações aplicadas.
  - *Motivo*: A ferramenta `replace_file_content` frequentemente falha em aplicar patches pequenos em arquivos com indentação complexa ou código repetitivo.
- **Evitar Loops**: Se uma edição falhar duas vezes, PARE. Leia o arquivo novamente e use `write_to_file`.

## 2. Padrões de Código

- **Idioma**: Comentários, Strings de UI e documentação devem ser em **Português (PT-BR)**. Nomes de variáveis/classes em Inglês (padrão tech).
- **Arquitetura**: Seguir MVVM com Clean Architecture simplificada.
  - UI -> ViewModel -> Repository -> DataSource/Firebase.
- **Injeção de Dependência**: Usar Hilt (@HiltViewModel, @AndroidEntryPoint, @Inject).
- **Assincronismo**: Usar Coroutines e Flow. Evitar Callbacks aninhados.

## 3. Segurança e Robustez

- **Não Quebrar Builds**: Verificar imports, chaves de fechamento e referências de recursos (R.id.*) antes de aplicar.
- **Null Safety**: Em Kotlin, abusar de `?`, `let`, `run` para evitar NullPointerException. Não usar `!!` a menos que tenha 100% de certeza (e mesmo assim, prefira elvis operator `?:`).

## 4. Comunicação

- Ser direto e técnico.
- Se encontrar inconsistências no projeto (ex: docs dizendo Node.js mas código usando Firebase), alertar o usuário mas seguir o padrão do CÓDIGO.
