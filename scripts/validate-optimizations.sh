#!/bin/bash

# validate-optimizations.sh
# Script para validar otimizações de performance implementadas

set -e

echo "============================================="
echo "  Performance Optimizations Validator"
echo "============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
WARN=0

# Function to check status
check() {
    local name=$1
    local result=$2

    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $name"
        ((FAIL++))
    fi
}

warn() {
    local message=$1
    echo -e "${YELLOW}⚠${NC} $message"
    ((WARN++))
}

echo "1. Verificando LazyColumn keys..."
# Buscar LazyColumn.items sem key
MISSING_KEYS=$(grep -r "items(" app/src/main/java/com/futebadosparcas/ui --include="*.kt" | grep -v "key = " | grep -v "// key" | wc -l || true)
if [ "$MISSING_KEYS" -eq 0 ]; then
    check "Todos os items() possuem key" 0
else
    check "FALTAM $MISSING_KEYS items() com key" 1
fi
echo ""

echo "2. Verificando remember em Composables..."
# Buscar remember em screens principais
HOME_REMEMBER=$(grep -c "remember(" app/src/main/java/com/futebadosparcas/ui/home/HomeScreen.kt || true)
if [ "$HOME_REMEMBER" -gt 5 ]; then
    check "HomeScreen usa remember (encontrados: $HOME_REMEMBER)" 0
else
    warn "HomeScreen pode ter poucos remember() (apenas $HOME_REMEMBER)"
fi
echo ""

echo "3. Verificando BaseViewModel usage..."
# Buscar ViewModels que estendem BaseViewModel
BASE_VM_USAGE=$(grep -r "BaseViewModel" app/src/main/java/com/futebadosparcas/ui --include="*ViewModel.kt" | wc -l || true)
if [ "$BASE_VM_USAGE" -gt 0 ]; then
    check "BaseViewModel em uso ($BASE_VM_USAGE ViewModels)" 0
else
    warn "Nenhum ViewModel usa BaseViewModel ainda"
fi
echo ""

echo "4. Verificando configuração do Coil..."
# Verificar se ImageModule.kt existe
if [ -f "app/src/main/java/com/futebadosparcas/di/ImageModule.kt" ]; then
    # Verificar configurações otimizadas
    HAS_DISK_CACHE=$(grep -c "diskCache" app/src/main/java/com/futebadosparcas/di/ImageModule.kt || true)
    HAS_MEMORY_CACHE=$(grep -c "memoryCache" app/src/main/java/com/futebadosparcas/di/ImageModule.kt || true)
    HAS_HARDWARE=$(grep -c "allowHardware" app/src/main/java/com/futebadosparcas/di/ImageModule.kt || true)

    if [ "$HAS_DISK_CACHE" -gt 0 ] && [ "$HAS_MEMORY_CACHE" -gt 0 ] && [ "$HAS_HARDWARE" -gt 0 ]; then
        check "Coil configurado com otimizações" 0
    else
        warn "Coil pode não ter todas as otimizações"
    fi
else
    check "ImageModule.kt não encontrado" 1
fi
echo ""

echo "5. Verificando Baseline Profile..."
# Verificar se BaselineProfileGenerator existe
if [ -f "baselineprofile/src/main/java/com/futebadosparcas/baselineprofile/BaselineProfileGenerator.kt" ]; then
    HAS_HOME_SCROLL=$(grep -c "scrollHomeScreen" baselineprofile/src/main/java/com/futebadosparcas/baselineprofile/BaselineProfileGenerator.kt || true)
    HAS_GAME_CLICK=$(grep -c "game_card" baselineprofile/src/main/java/com/futebadosparcas/baselineprofile/BaselineProfileGenerator.kt || true)

    if [ "$HAS_HOME_SCROLL" -gt 0 ] && [ "$HAS_GAME_CLICK" -gt 0 ]; then
        check "Baseline Profile otimizado" 0
    else
        warn "Baseline Profile pode não cobrir fluxos críticos"
    fi
else
    check "BaselineProfileGenerator.kt não encontrado" 1
fi
echo ""

echo "6. Verificando Shimmer Loading..."
# Verificar se ShimmerLoading.kt existe
if [ -f "app/src/main/java/com/futebadosparcas/ui/components/modern/ShimmerLoading.kt" ]; then
    check "ShimmerLoading component existe" 0

    # Verificar uso em HomeScreen
    HOME_SHIMMER=$(grep -c "ShimmerBox\|ShimmerGameCard\|ShimmerGamesList" app/src/main/java/com/futebadosparcas/ui/home/HomeScreen.kt || true)
    if [ "$HOME_SHIMMER" -gt 0 ]; then
        check "HomeScreen usa Shimmer" 0
    else
        warn "HomeScreen pode não estar usando Shimmer"
    fi
else
    check "ShimmerLoading.kt não encontrado" 1
fi
echo ""

echo "7. Verificando FlowExtensions..."
# Verificar se FlowExtensions.kt existe
if [ -f "app/src/main/java/com/futebadosparcas/util/FlowExtensions.kt" ]; then
    HAS_DEBOUNCE=$(grep -c "debounceClick" app/src/main/java/com/futebadosparcas/util/FlowExtensions.kt || true)
    HAS_THROTTLE=$(grep -c "throttleFirst" app/src/main/java/com/futebadosparcas/util/FlowExtensions.kt || true)

    if [ "$HAS_DEBOUNCE" -gt 0 ] && [ "$HAS_THROTTLE" -gt 0 ]; then
        check "FlowExtensions com debouncing" 0
    else
        warn "FlowExtensions pode estar incompleto"
    fi
else
    check "FlowExtensions.kt não encontrado" 1
fi
echo ""

echo "8. Verificando ComposeOptimizations..."
# Verificar se ComposeOptimizations.kt existe
if [ -f "app/src/main/java/com/futebadosparcas/ui/util/ComposeOptimizations.kt" ]; then
    HAS_DATE_CACHE=$(grep -c "getCachedDateFormat" app/src/main/java/com/futebadosparcas/ui/util/ComposeOptimizations.kt || true)
    HAS_REMEMBER_DATE=$(grep -c "rememberFormattedDate" app/src/main/java/com/futebadosparcas/ui/util/ComposeOptimizations.kt || true)

    if [ "$HAS_DATE_CACHE" -gt 0 ] && [ "$HAS_REMEMBER_DATE" -gt 0 ]; then
        check "ComposeOptimizations com date caching" 0
    else
        warn "ComposeOptimizations pode estar incompleto"
    fi
else
    check "ComposeOptimizations.kt não encontrado" 1
fi
echo ""

echo "9. Verificando job cleanup em ViewModels..."
# Verificar se ViewModels limpam jobs em onCleared
VIEWMODELS_WITH_JOBS=$(grep -l "private var.*Job" app/src/main/java/com/futebadosparcas/ui/**/*ViewModel.kt || true)
VIEWMODELS_WITH_ONCLEARED=$(echo "$VIEWMODELS_WITH_JOBS" | xargs grep -l "onCleared()" || true)

VM_JOBS_COUNT=$(echo "$VIEWMODELS_WITH_JOBS" | wc -l || true)
VM_CLEANUP_COUNT=$(echo "$VIEWMODELS_WITH_ONCLEARED" | wc -l || true)

if [ "$VM_JOBS_COUNT" -gt 0 ] && [ "$VM_CLEANUP_COUNT" -eq "$VM_JOBS_COUNT" ]; then
    check "Todos ViewModels com Jobs fazem cleanup ($VM_CLEANUP_COUNT/$VM_JOBS_COUNT)" 0
elif [ "$VM_CLEANUP_COUNT" -gt 0 ]; then
    warn "Alguns ViewModels podem não limpar Jobs ($VM_CLEANUP_COUNT/$VM_JOBS_COUNT)"
else
    warn "ViewModels podem não estar fazendo cleanup"
fi
echo ""

echo "10. Verificando hardcoded colors em Compose..."
# Buscar Color.Black, Color.White, Color(0x...) em screens
HARDCODED_COLORS=$(grep -r "Color\.Black\|Color\.White\|Color(0x" app/src/main/java/com/futebadosparcas/ui --include="*Screen.kt" | grep -v "GamificationColors" | wc -l || true)
if [ "$HARDCODED_COLORS" -eq 0 ]; then
    check "Nenhuma cor hardcoded em Screens" 0
else
    warn "Encontradas $HARDCODED_COLORS cores hardcoded em Screens"
fi
echo ""

# Summary
echo "============================================="
echo "  Resumo da Validação"
echo "============================================="
echo -e "${GREEN}✓ Passou:${NC} $PASS"
echo -e "${YELLOW}⚠ Avisos:${NC} $WARN"
echo -e "${RED}✗ Falhou:${NC} $FAIL"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}✅ Todas as verificações críticas passaram!${NC}"
    exit 0
else
    echo -e "${RED}❌ Algumas verificações falharam. Revisar otimizações.${NC}"
    exit 1
fi
