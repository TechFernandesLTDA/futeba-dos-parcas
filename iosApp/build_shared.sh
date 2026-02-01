#!/bin/bash
set -e

echo "Building shared framework for iOS..."

cd "$(dirname "$0")/.."

# Build for simulator (M1/M2 Macs)
echo "Building for iOS Simulator (Arm64)..."
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64

# Build for device
echo "Building for iOS Device (Arm64)..."
./gradlew :shared:linkDebugFrameworkIosArm64

echo ""
echo "✅ Shared frameworks built successfully!"
echo ""
echo "Simulator: shared/build/bin/iosSimulatorArm64/debugFramework/shared.framework"
echo "Device: shared/build/bin/iosArm64/debugFramework/shared.framework"
echo ""
echo "Next steps:"
echo "1. Open iosApp.xcworkspace in Xcode"
echo "2. Select a simulator or device"
echo "3. Build and run (⌘R)"
