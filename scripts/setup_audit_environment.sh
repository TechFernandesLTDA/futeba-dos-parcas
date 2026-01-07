#!/bin/bash

echo "================================================"
echo "FUTEBA DOS PARCAS - SETUP AMBIENTE DE AUDITORIA"
echo "================================================"
echo ""

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Verificar Node.js
echo -e "${BLUE}1. Verificando Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}   ✅ Node.js $NODE_VERSION instalado${NC}"
else
    echo "   ❌ Node.js nao encontrado. Instale Node.js 18+"
    exit 1
fi

# 2. Verificar Firebase CLI
echo -e "${BLUE}2. Verificando Firebase CLI...${NC}"
if command -v firebase &> /dev/null; then
    FIREBASE_VERSION=$(firebase --version)
    echo -e "${GREEN}   ✅ Firebase CLI $FIREBASE_VERSION instalado${NC}"
else
    echo "   Installing Firebase CLI..."
    npm install -g firebase-tools
fi

# 3. Instalar dependencias dos scripts
echo -e "${BLUE}3. Instalando dependencias dos scripts de teste...${NC}"
if [ -f "package.json" ]; then
    npm install
else
    echo "   Criando package.json..."
    cat > package.json << 'EOFPKG'
{
  "name": "futeba-audit-scripts",
  "version": "1.0.0",
  "scripts": {
    "test:rules": "node scripts/test_firestore_rules.js"
  },
  "dependencies": {
    "firebase-admin": "^11.0.0"
  }
}
EOFPKG
    npm install
fi

# 4. Verificar serviceAccountKey.json
echo -e "${BLUE}4. Verificando service account key...${NC}"
if [ -f "serviceAccountKey.json" ]; then
    echo -e "${GREEN}   ✅ serviceAccountKey.json encontrado${NC}"
else
    echo "   ⚠️  serviceAccountKey.json NAO encontrado"
    echo "   Baixe de: Firebase Console > Settings > Service Accounts"
fi

# 5. Listar documentacao criada
echo -e "${BLUE}5. Documentacao de auditoria criada:${NC}"
for doc in SECURITY_AUDIT_REPORT.md QUICK_FIX_GUIDE.md ARCHITECTURE.md CI_CD_SETUP.md AUDIT_INDEX.md AUDITORIA_COMPLETA_README.md; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}   ✅ $doc${NC}"
    else
        echo "   ❌ $doc (faltando)"
    fi
done

# 6. Verificar scripts
echo -e "${BLUE}6. Scripts de validacao:${NC}"
for script in scripts/validate_all.sh scripts/test_firestore_rules.js; do
    if [ -f "$script" ]; then
        echo -e "${GREEN}   ✅ $script${NC}"
    else
        echo "   ❌ $script (faltando)"
    fi
done

echo ""
echo "================================================"
echo -e "${GREEN}SETUP COMPLETO!${NC}"
echo ""
echo "Proximos passos:"
echo "1. Ler QUICK_FIX_GUIDE.md"
echo "2. Executar: ./scripts/validate_all.sh"
echo "3. Executar: npm run test:rules"
echo "================================================"
