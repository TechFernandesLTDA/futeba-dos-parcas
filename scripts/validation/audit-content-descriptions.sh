#!/bin/bash
# #073 - Content Description Audit
# Finds Icon/Image components without contentDescription for accessibility

set -e

echo "🔍 Auditing Content Descriptions..."
echo "=================================="

COMPOSE_DIR="app/src/main/java"

# Find Icon() without contentDescription
echo ""
echo "📍 Icons without contentDescription:"
echo "-------------------------------------"
ICON_COUNT=$(grep -rn 'Icon(' "$COMPOSE_DIR" --include="*.kt" | grep -v 'contentDescription' | grep -v 'IconButton' | grep -v 'fun.*Icon' | grep -v '//.*Icon' | wc -l)
if [ "$ICON_COUNT" -gt 0 ]; then
    grep -rn 'Icon(' "$COMPOSE_DIR" --include="*.kt" | grep -v 'contentDescription' | grep -v 'IconButton' | grep -v 'fun.*Icon' | grep -v '//.*Icon' | head -20
    echo ""
    echo "Total: $ICON_COUNT icons without contentDescription"
else
    echo "✅ All icons have contentDescription"
fi

# Find Image() without contentDescription
echo ""
echo "🖼️  Images without contentDescription:"
echo "--------------------------------------"
IMAGE_COUNT=$(grep -rn 'Image(' "$COMPOSE_DIR" --include="*.kt" | grep -v 'contentDescription' | grep -v 'AsyncImage' | grep -v 'fun.*Image' | grep -v '//.*Image' | wc -l)
if [ "$IMAGE_COUNT" -gt 0 ]; then
    grep -rn 'Image(' "$COMPOSE_DIR" --include="*.kt" | grep -v 'contentDescription' | grep -v 'AsyncImage' | grep -v 'fun.*Image' | grep -v '//.*Image' | head -20
    echo ""
    echo "Total: $IMAGE_COUNT images without contentDescription"
else
    echo "✅ All images have contentDescription"
fi

# Find clickable without role/semantics
echo ""
echo "🖱️  Clickable elements without semantics:"
echo "---------------------------------------"
CLICKABLE_COUNT=$(grep -rn '\.clickable' "$COMPOSE_DIR" --include="*.kt" | grep -v 'role =' | grep -v 'semantics' | grep -v '//.*clickable' | wc -l)
if [ "$CLICKABLE_COUNT" -gt 0 ]; then
    grep -rn '\.clickable' "$COMPOSE_DIR" --include="*.kt" | grep -v 'role =' | grep -v 'semantics' | grep -v '//.*clickable' | head -10
    echo ""
    echo "Total: $CLICKABLE_COUNT clickable elements without accessibility semantics"
else
    echo "✅ All clickable elements have proper semantics"
fi

echo ""
echo "=================================="
echo "📊 Summary:"
echo "  - Icons: $ICON_COUNT issues"
echo "  - Images: $IMAGE_COUNT issues"
echo "  - Clickables: $CLICKABLE_COUNT issues"
echo ""

TOTAL=$((ICON_COUNT + IMAGE_COUNT + CLICKABLE_COUNT))
if [ "$TOTAL" -eq 0 ]; then
    echo "✅ No accessibility issues found!"
    exit 0
else
    echo "⚠️  Found $TOTAL accessibility issues"
    echo "📖 Fix guide: https://developer.android.com/jetpack/compose/accessibility"
    exit 0  # Don't fail, just report
fi
