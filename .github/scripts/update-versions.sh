#!/bin/bash

# Update Android and iOS version numbers
# Usage: ./update-versions.sh <marketing_version> <build_number>
# Example: ./update-versions.sh 1.0.0 1029


set -e

if [ $# -ne 2 ]; then
    echo "Usage: $0 <marketing_version> <build_number>"
    echo "Example: $0 1.0.0 1029"
    exit 1
fi

MARKETING_VERSION="$1"
BUILD_NUMBER="$2"

echo "   Updating versions..."
echo "   Version: $MARKETING_VERSION"
echo "   Build number: $BUILD_NUMBER"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    SED_INPLACE=(-i '')
else
    # Linux
    SED_INPLACE=(-i)
fi

# Android
echo "   Updating Android..."
sed "${SED_INPLACE[@]}" "s/versionCode 999/versionCode $BUILD_NUMBER/" android/app/build.gradle
sed "${SED_INPLACE[@]}" 's/versionName "dev"/versionName "'"$MARKETING_VERSION"'"/' android/app/build.gradle
echo "Android updated"

# iOS
echo "   Updating iOS..."
sed "${SED_INPLACE[@]}" "s/CURRENT_PROJECT_VERSION = 999;/CURRENT_PROJECT_VERSION = $BUILD_NUMBER;/g" ios/BIMWallet.xcodeproj/project.pbxproj
sed "${SED_INPLACE[@]}" "s/MARKETING_VERSION = dev;/MARKETING_VERSION = $MARKETING_VERSION;/g" ios/BIMWallet.xcodeproj/project.pbxproj
echo "iOS updated"


echo "Version update completed!"
echo "Android: versionName=\"$MARKETING_VERSION\" versionCode=$BUILD_NUMBER"
echo "iOS: MARKETING_VERSION=$MARKETING_VERSION CURRENT_PROJECT_VERSION=$BUILD_NUMBER"

# Output to GitHub Actions Summary
if [ -n "$GITHUB_STEP_SUMMARY" ]; then
    cat >> "$GITHUB_STEP_SUMMARY" << EOF
## Version Update Summary

| Platform | Marketing Version  | Build Number  |
|----------|--------------------|---------------|
| Android  | $MARKETING_VERSION | $BUILD_NUMBER |
| iOS      | $MARKETING_VERSION | $BUILD_NUMBER |

### Details
- **Android**: \`versionName="$MARKETING_VERSION"\` \`versionCode=$BUILD_NUMBER\`
- **iOS**: \`MARKETING_VERSION=$MARKETING_VERSION\` \`CURRENT_PROJECT_VERSION=$BUILD_NUMBER\`

EOF
fi