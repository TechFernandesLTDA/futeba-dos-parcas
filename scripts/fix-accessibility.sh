#!/bin/bash

# Script para corrigir accessibility issues gradualmente
# Uso: ./scripts/fix-accessibility.sh [--dry-run]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN=false

if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - Nenhuma alteração será feita"
fi

echo "🎯 Futeba dos Parças - Accessibility Fixer"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de fixes
TOTAL_FIXED=0
TOTAL_ERRORS=0

# Função para adicionar contentDescription genérico
fix_icon_accessibility() {
    local file=$1
    local icon_name=$2
    local line_number=$3

    # Extrair nome do ícone para gerar contentDescription
    local icon_simple=$(echo "$icon_name" | sed 's/Icons\.Default\.//g' | sed 's/Icons\.Filled\.//g')
    local cd_name="cd_$(echo $icon_simple | tr '[:upper:]' '[:lower:]' | tr '.' '_')"

    echo "  📝 Fixing: $file:$line_number ($icon_simple)"

    if [[ "$DRY_RUN" == false ]]; then
        # Adicionar string no strings.xml se não existir
        if ! grep -q "name=\"$cd_name\"" "$PROJECT_ROOT/app/src/main/res/values/strings.xml"; then
            # Inserir antes do </resources>
            sed -i "/<\/resources>/i \    <string name=\"$cd_name\">$icon_simple</string>" \
                "$PROJECT_ROOT/app/src/main/res/values/strings.xml"
        fi

        # Adicionar contentDescription no código
        # TODO: Implementar lógica de adição no código Kotlin
        # Requer parsing mais sofisticado do Kotlin

        ((TOTAL_FIXED++))
    fi
}

echo "📊 Escaneando arquivos Kotlin..."
echo ""

# Encontrar todos os Icons sem contentDescription
# Padrão: Icon(Icons.Default.* ou Icons.Filled.* sem contentDescription)

ICON_FILES=$(find "$PROJECT_ROOT/app/src/main/java" -name "*.kt" -type f)

for file in $ICON_FILES; do
    # Buscar Icons sem contentDescription na mesma linha ou próximas linhas
    while IFS= read -r line; do
        if echo "$line" | grep -qE "Icon\s*\(\s*Icons\.(Default|Filled)\." && \
           ! echo "$line" | grep -q "contentDescription"; then

            # Extrair nome do ícone
            icon_name=$(echo "$line" | grep -oE "Icons\.(Default|Filled)\.[A-Za-z]+" | head -1)
            line_number=$(grep -n "$line" "$file" | cut -d: -f1 | head -1)

            if [[ -n "$icon_name" ]]; then
                fix_icon_accessibility "$file" "$icon_name" "$line_number"
            fi
        fi
    done < "$file"
done

echo ""
echo "=========================================="
echo "✅ Scan completo!"
echo "   Fixes aplicados: ${GREEN}$TOTAL_FIXED${NC}"
echo "   Erros: ${RED}$TOTAL_ERRORS${NC}"
echo ""

if [[ "$DRY_RUN" == true ]]; then
    echo "⚠️  DRY RUN MODE - Execute sem --dry-run para aplicar mudanças"
else
    echo "✅ Mudanças aplicadas em strings.xml"
    echo ""
    echo "📋 PRÓXIMOS PASSOS MANUAIS:"
    echo "   1. Revisar strings.xml gerado"
    echo "   2. Adicionar imports: import androidx.compose.ui.res.stringResource"
    echo "   3. Substituir Icons por:"
    echo "      Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.cd_settings))"
    echo "   4. Executar: ./gradlew compileDebugKotlin"
fi

echo ""
echo "📊 Para ver issues restantes:"
echo "   grep -r 'Icon(Icons' app/src/main/java --include='*.kt' | grep -v contentDescription"
