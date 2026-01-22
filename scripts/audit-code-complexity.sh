#!/bin/bash
# Code Complexity Audit
# Analyzes code for complexity issues using Detekt

set -e

echo "🔍 Running Code Complexity Analysis..."
echo "======================================"

echo ""
echo "📊 Detekt Static Analysis"
echo "--------------------------"

# Run detekt with detailed output
./gradlew detekt --quiet || {
    echo "⚠️  Detekt found issues. Check the report:"
    echo "   build/reports/detekt/detekt.html"
    echo ""
}

echo ""
echo "📈 Metrics Summary"
echo "------------------"

# Count files
KOTLIN_FILES=$(find app/src/main/java -name "*.kt" | wc -l)
echo "  - Kotlin files: $KOTLIN_FILES"

# Count lines of code (excluding comments and blanks)
LOC=$(find app/src/main/java -name "*.kt" -exec cat {} \; | grep -v '^\s*//' | grep -v '^\s*$' | wc -l)
echo "  - Lines of code: $LOC"

# Find large files (>500 lines)
echo ""
echo "🐘 Large files (>500 lines):"
find app/src/main/java -name "*.kt" -exec wc -l {} \; | awk '$1 > 500 {print $1 " lines: " $2}' | sort -rn | head -10

# Find long functions (approximation)
echo ""
echo "🔧 Long functions (>60 lines - approximation):"
echo "(Check Detekt report for accurate analysis)"

# Count complexity using grep (rough approximation)
COMPLEX_FILES=$(grep -r 'if\|when\|for\|while' app/src/main/java --include="*.kt" | wc -l)
echo ""
echo "  - Control flow statements: $COMPLEX_FILES"

echo ""
echo "======================================"
echo "✅ Analysis complete!"
echo ""
echo "📖 Detailed reports:"
echo "   - Detekt: build/reports/detekt/detekt.html"
echo "   - Lint: app/build/reports/lint-results-debug.html"
