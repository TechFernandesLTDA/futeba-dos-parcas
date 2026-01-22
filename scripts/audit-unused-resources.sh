#!/bin/bash
# Unused Resources Audit
# Finds unused drawables, strings, and other resources

set -e

echo "🔍 Auditing Unused Resources..."
echo "==============================="

echo ""
echo "Running Android Lint for unused resources..."
echo "This may take a few minutes..."
echo ""

# Run lint with focus on unused resources
./gradlew lintDebug -PandroidLintCheck=UnusedResources --quiet

echo ""
echo "📊 Lint report generated at:"
echo "   app/build/reports/lint-results-debug.html"
echo ""
echo "Open it in a browser to see detailed unused resources."
echo ""
echo "Alternatively, run R8 with resource shrinking enabled:"
echo "   ./gradlew assembleRelease"
echo ""
echo "Then check build/outputs/mapping/release/resources.txt"
