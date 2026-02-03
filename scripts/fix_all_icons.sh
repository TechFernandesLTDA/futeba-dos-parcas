#!/bin/bash
# Script para adicionar contentDescription = null em TODOS os Icons
# Este é o approach mais simples - adicionar null onde não tem contentDescription

set -e

COUNTER=0

# Encontra todos os arquivos Kotlin em ui/
find app/src/main/java/com/futebadosparcas/ui -name "*.kt" | while read file; do
    # Backup
    cp "$file" "$file.bak"

    # Pattern 1: Icon(Icons.xxx) -> Icon(Icons.xxx, contentDescription = null)
    sed -i 's/Icon(Icons\.\([A-Za-z.]*\))/Icon(Icons.\1, contentDescription = null)/g' "$file"

    # Pattern 2: Icon(\n    imageVector = Icons.xxx\n) -> adiciona contentDescription na proxima linha
    # Usa perl para multiline
    perl -i -p0e 's/Icon\s*\(\s*imageVector\s*=\s*(Icons\.[A-Za-z.]+),\s*\n/Icon(\n    imageVector = $1,\n    contentDescription = null,\n/gs' "$file"

    # Check if modified
    if ! diff -q "$file" "$file.bak" > /dev/null 2>&1; then
        echo "Modified: $file"
        ((COUNTER++))
    fi

    # Remove backup
    rm "$file.bak"
done

echo ""
echo "====================================="
echo "Modified $COUNTER files"
echo "====================================="
