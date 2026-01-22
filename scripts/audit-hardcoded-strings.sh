#!/bin/bash
# #081 - Hardcoded Strings Audit
# Finds hardcoded strings in Kotlin/Compose code that should use string resources

set -e

echo "🔍 Auditing Hardcoded Strings..."
echo "================================"

COMPOSE_DIR="app/src/main/java"

# Find Text() with hardcoded strings
echo ""
echo "📝 Text() with hardcoded strings:"
echo "---------------------------------"
TEXT_COUNT=$(grep -rn 'Text\s*(\s*text\s*=\s*"' "$COMPOSE_DIR" --include="*.kt" | grep -v '@string/' | grep -v 'stringResource' | grep -v '//.*Text' | wc -l)
if [ "$TEXT_COUNT" -gt 0 ]; then
    grep -rn 'Text\s*(\s*text\s*=\s*"' "$COMPOSE_DIR" --include="*.kt" | grep -v '@string/' | grep -v 'stringResource' | grep -v '//.*Text' | head -20
    echo ""
    echo "Total: $TEXT_COUNT Text components with hardcoded strings"
else
    echo "✅ All Text components use string resources"
fi

# Find Button() with hardcoded text
echo ""
echo "🔘 Buttons with hardcoded text:"
echo "-------------------------------"
BUTTON_COUNT=$(grep -rn 'Button.*{.*Text.*"' "$COMPOSE_DIR" --include="*.kt" -A 2 | grep 'Text\s*(\s*"' | grep -v 'stringResource' | wc -l)
if [ "$BUTTON_COUNT" -gt 0 ]; then
    grep -rn 'Button.*{.*Text.*"' "$COMPOSE_DIR" --include="*.kt" -A 2 | grep 'Text\s*(\s*"' | grep -v 'stringResource' | head -10
    echo ""
    echo "Total: $BUTTON_COUNT buttons with hardcoded text"
else
    echo "✅ All buttons use string resources"
fi

# Find hardcoded log messages
echo ""
echo "📋 Log messages (should be English for debugging):"
echo "------------------------------------------------"
LOG_COUNT=$(grep -rn 'Log\.[edwi](' "$COMPOSE_DIR" --include="*.kt" | grep '"' | wc -l)
echo "Found $LOG_COUNT log statements"

# Find hardcoded Toast messages
echo ""
echo "🍞 Toast messages with hardcoded strings:"
echo "-----------------------------------------"
TOAST_COUNT=$(grep -rn 'Toast\.makeText' "$COMPOSE_DIR" --include="*.kt" | grep '"' | grep -v 'R.string.' | wc -l)
if [ "$TOAST_COUNT" -gt 0 ]; then
    grep -rn 'Toast\.makeText' "$COMPOSE_DIR" --include="*.kt" | grep '"' | grep -v 'R.string.' | head -10
    echo ""
    echo "Total: $TOAST_COUNT Toast messages with hardcoded strings"
else
    echo "✅ All Toast messages use string resources"
fi

# Find hardcoded contentDescription
echo ""
echo "♿ Content descriptions with hardcoded strings:"
echo "---------------------------------------------"
CD_COUNT=$(grep -rn 'contentDescription\s*=\s*"' "$COMPOSE_DIR" --include="*.kt" | grep -v 'stringResource' | wc -l)
if [ "$CD_COUNT" -gt 0 ]; then
    grep -rn 'contentDescription\s*=\s*"' "$COMPOSE_DIR" --include="*.kt" | grep -v 'stringResource' | head -10
    echo ""
    echo "Total: $CD_COUNT content descriptions with hardcoded strings"
else
    echo "✅ All content descriptions use string resources"
fi

echo ""
echo "================================"
echo "📊 Summary:"
echo "  - Text(): $TEXT_COUNT issues"
echo "  - Buttons: $BUTTON_COUNT issues"
echo "  - Toasts: $TOAST_COUNT issues"
echo "  - Content Descriptions: $CD_COUNT issues"
echo "  - Log statements: $LOG_COUNT (OK if English)"
echo ""

TOTAL=$((TEXT_COUNT + BUTTON_COUNT + TOAST_COUNT + CD_COUNT))
if [ "$TOTAL" -eq 0 ]; then
    echo "✅ No hardcoded string issues found!"
    exit 0
else
    echo "⚠️  Found $TOTAL hardcoded string issues"
    echo "📖 Fix guide: Use stringResource(R.string.key) in Compose"
    exit 0  # Don't fail, just report
fi
