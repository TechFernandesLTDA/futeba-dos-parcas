#!/bin/bash

# Script para instalar dependências de infraestrutura
# Usado para configuração inicial ou após npm clean

set -e

echo "========================================="
echo "Installing Infrastructure Dependencies"
echo "========================================="

# Instalar dependências principais
echo "📦 Installing main dependencies..."
npm install

# Instalar sharp com opções específicas para Cloud Functions
# IMPORTANTE: Sharp precisa ser instalado para plataforma Linux (Cloud Functions roda em Linux)
echo "🖼️  Installing sharp (image processing)..."
npm install sharp --platform=linux --arch=x64

# Instalar @google-cloud/storage
echo "☁️  Installing @google-cloud/storage..."
npm install @google-cloud/storage

echo ""
echo "✅ Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Build functions: npm run build"
echo "2. Test locally: firebase emulators:start"
echo "3. Deploy: firebase deploy --only functions"
echo ""
