#!/bin/bash

echo "=== Hotel Harmony Production Build Verification ==="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

echo -e "${YELLOW}Test 1: Checking dist folder structure${NC}"
files_to_check=(
  "dist/index.html"
  "dist/manifest.webmanifest"
  "dist/sw.js"
  "dist/assets/index-CTxQfp7N.js"
  "dist/assets/index-DYe7cC4y.css"
  "dist/pwa-192.svg"
  "dist/pwa-512.svg"
)

for file in "${files_to_check[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} $file missing"
    ((FAIL++))
  fi
done

echo ""
echo -e "${YELLOW}Test 2: Checking index.html has correct references${NC}"
if grep -q './manifest.webmanifest' dist/index.html && grep -q './assets/' dist/index.html; then
  echo -e "${GREEN}✓${NC} HTML references are relative paths"
  ((PASS++))
else
  echo -e "${RED}✗${NC} HTML references incorrect"
  ((FAIL++))
fi

echo ""
echo -e "${YELLOW}Test 3: Checking electron/main.mjs has pathToFileURL fix${NC}"
if grep -q 'pathToFileURL' electron/main.mjs && grep -q 'const fileUrl = pathToFileURL' electron/main.mjs; then
  echo -e "${GREEN}✓${NC} loadFile() replaced with loadURL(pathToFileURL())"
  ((PASS++))
else
  echo -e "${RED}✗${NC} electron/main.mjs fix missing"
  ((FAIL++))
fi

echo ""
echo -e "${YELLOW}Test 4: Checking src/main.tsx has Electron detection${NC}"
if grep -q 'electronApp?.isDesktop' src/main.tsx && grep -q '!isElectron' src/main.tsx; then
  echo -e "${GREEN}✓${NC} Service worker disabled in Electron context"
  ((PASS++))
else
  echo -e "${RED}✗${NC} src/main.tsx fix missing"
  ((FAIL++))
fi

echo ""
echo "=== Summary ==="
echo -e "Passed: ${GREEN}${PASS}${NC}"
echo -e "Failed: ${RED}${FAIL}${NC}"

if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}✓ All checks passed!${NC}"
  echo -e "\nFixes applied:"
  echo "  1. electron/main.mjs: Uses pathToFileURL() for proper file:// URLs"
  echo "  2. src/main.tsx: Detects Electron and disables service worker"
  echo -e "\nTo test: npx electron . (after build)"
  exit 0
else
  exit 1
fi
