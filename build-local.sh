#!/bin/bash
# Build TaskFlow APK locally on macOS

echo "TaskFlow Local Build Script"
echo "==========================="
echo ""

# Check Java version
JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2)
echo "Found Java: $JAVA_VERSION"

# Find Java 17
JAVA_17_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null)

if [ -z "$JAVA_17_HOME" ]; then
    echo "ERROR: Java 17 not found!"
    echo "Install it with: brew install --cask temurin@17"
    exit 1
fi

echo "Using Java 17 at: $JAVA_17_HOME"
echo ""

# Set Java home
export JAVA_HOME=$JAVA_17_HOME

# Clean and build
echo "Building APK..."
cd "$(dirname "$0")/android"

# Clean previous builds
rm -rf app/build/outputs/apk/

# Build debug APK
./gradlew assembleDebug

# Check if build succeeded
if [ -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
    echo ""
    echo "SUCCESS! APK built at:"
    echo "  android/app/build/outputs/apk/debug/app-debug.apk"
    echo ""
    echo "Install on your Android device:"
    echo "  adb install android/app/build/outputs/apk/debug/app-debug.apk"
else
    echo "ERROR: Build failed!"
    exit 1
fi
