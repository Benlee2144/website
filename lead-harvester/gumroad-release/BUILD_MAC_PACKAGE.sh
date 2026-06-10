#!/bin/bash

# ========================================
# LeadHarvester macOS Build Script
# Run this script on your Mac to create
# the Gumroad-ready Mac package
# ========================================

set -e

echo "========================================="
echo "  LeadHarvester macOS Package Builder"
echo "========================================="
echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "Project directory: $PROJECT_DIR"
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "ERROR: This script must be run on macOS"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR"

echo "Step 1: Installing dependencies..."
npm install

echo ""
echo "Step 2: Building the application..."
npm run build

echo ""
echo "Step 3: Packaging for macOS..."
npm run package:mac

echo ""
echo "Step 4: Preparing Gumroad package..."

# Find the DMG file(s)
DMG_FILES=$(find release -name "*.dmg" -type f 2>/dev/null)

if [ -z "$DMG_FILES" ]; then
    echo "ERROR: No DMG files found in release folder"
    exit 1
fi

# Copy DMG and README to mac folder
mkdir -p "$SCRIPT_DIR/mac"

for dmg in $DMG_FILES; do
    echo "Copying: $dmg"
    cp "$dmg" "$SCRIPT_DIR/mac/"
done

# Copy README if it exists
if [ -f "$SCRIPT_DIR/mac/README.txt" ]; then
    echo "README.txt already exists"
else
    echo "Creating README.txt..."
fi

# Create the ZIP
echo ""
echo "Step 5: Creating ZIP file..."
cd "$SCRIPT_DIR"
zip -r LeadHarvester-Mac-v1.0.0.zip mac/

echo ""
echo "========================================="
echo "  BUILD COMPLETE!"
echo "========================================="
echo ""
echo "Your Gumroad-ready package is at:"
echo "$SCRIPT_DIR/LeadHarvester-Mac-v1.0.0.zip"
echo ""
echo "Contents:"
ls -la "$SCRIPT_DIR/mac/"
echo ""
echo "You can now upload this ZIP to Gumroad!"
echo "========================================="
