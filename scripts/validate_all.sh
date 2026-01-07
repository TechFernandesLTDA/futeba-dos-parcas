#!/bin/bash

echo "================================================"
echo "🔍 FUTEBA DOS PARÇAS - VALIDAÇÃO COMPLETA"
echo "================================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

# 1. Build Debug
echo -e "${BLUE}📦 1. Testando build debug...${NC}"
if ./gradlew assembleDebug --quiet 2>/dev/null; then
    echo -e "${GREEN}✅ Build debug OK${NC}"
else
    echo -e "${RED}❌ Build debug FALHOU${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Lint Check
echo -e "${BLUE}🔍 2. Executando lint...${NC}"
if ./gradlew lint --quiet 2>/dev/null; then
    echo -e "${GREEN}✅ Lint OK${NC}"
else
    echo -e "${YELLOW}⚠️  Lint com warnings${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 3. Procurar strings hardcoded
echo -e "${BLUE}📝 3. Procurando strings hardcoded...${NC}"
if command -v grep &> /dev/null; then
    HARDCODED=$(find app/src/main/java -name "*.kt" 2>/dev/null | xargs grep -l "Text(\"" 2>/dev/null | wc -l || echo "0")
    if [ "$HARDCODED" -eq 0 ]; then
        echo -e "${GREEN}✅ Sem strings hardcoded detectadas${NC}"
    else
        echo -e "${YELLOW}⚠️  ~$HARDCODED arquivos com possíveis strings hardcoded${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  grep não disponível${NC}"
fi
echo ""

# 4. Verificar adapters deletados
echo -e "${BLUE}🔍 4. Verificando referências a adapters deletados...${NC}"
DELETED_REFS=0
for adapter in "ConfirmationsAdapter" "GamesAdapter" "FieldAdapter"; do
    if find app/src/main/java -name "*.kt" 2>/dev/null | xargs grep -l "$adapter" &>/dev/null; then
        echo -e "${RED}   ❌ $adapter ainda referenciado${NC}"
        DELETED_REFS=$((DELETED_REFS + 1))
    fi
done

if [ "$DELETED_REFS" -gt 0 ]; then
    echo -e "${RED}❌ $DELETED_REFS adapter(s) deletado(s) ainda referenciado(s)${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Sem referências a adapters deletados${NC}"
fi
echo ""

# 5. Firebase configuration
echo -e "${BLUE}🔥 5. Validando configuração Firebase...${NC}"
FIREBASE_OK=true

if [ -f "google-services.json" ]; then
    echo -e "${GREEN}   ✅ google-services.json${NC}"
else
    echo -e "${RED}   ❌ google-services.json NÃO encontrado${NC}"
    ERRORS=$((ERRORS + 1))
    FIREBASE_OK=false
fi

if [ -f "firestore.rules" ]; then
    echo -e "${GREEN}   ✅ firestore.rules${NC}"
else
    echo -e "${RED}   ❌ firestore.rules NÃO encontrado${NC}"
    ERRORS=$((ERRORS + 1))
    FIREBASE_OK=false
fi

if [ -f "storage.rules" ]; then
    echo -e "${GREEN}   ✅ storage.rules${NC}"
else
    echo -e "${YELLOW}   ⚠️  storage.rules NÃO encontrado${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -d "functions" ]; then
    echo -e "${GREEN}   ✅ functions/${NC}"
else
    echo -e "${RED}   ❌ functions/ NÃO encontrado${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 6. Tamanho do APK
echo -e "${BLUE}📏 6. Verificando tamanho do APK...${NC}"
APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    if command -v du &> /dev/null; then
        APK_SIZE_MB=$(du -m "$APK_PATH" 2>/dev/null | cut -f1)
        APK_SIZE_H=$(du -h "$APK_PATH" 2>/dev/null | cut -f1)
        echo "   Tamanho: $APK_SIZE_H"
        
        if [ "$APK_SIZE_MB" -lt 50 ]; then
            echo -e "${GREEN}✅ Tamanho OK (< 50MB)${NC}"
        else
            echo -e "${YELLOW}⚠️  APK grande (>= 50MB)${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
else
    echo -e "${YELLOW}⚠️  APK não encontrado (execute build primeiro)${NC}"
fi
echo ""

# Resultado final
echo "================================================"
if [ "$ERRORS" -eq 0 ]; then
    echo -e "${GREEN}✅ VALIDAÇÃO COMPLETA${NC}"
    if [ "$WARNINGS" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s)${NC}"
    fi
    echo "================================================"
    exit 0
else
    echo -e "${RED}❌ VALIDAÇÃO FALHOU${NC}"
    echo -e "${RED}   $ERRORS erro(s) crítico(s)${NC}"
    if [ "$WARNINGS" -gt 0 ]; then
        echo -e "${YELLOW}   $WARNINGS warning(s)${NC}"
    fi
    echo "================================================"
    exit 1
fi
