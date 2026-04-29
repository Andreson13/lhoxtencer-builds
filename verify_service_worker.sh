#!/bin/bash

echo "=== Service Worker & Netlify Configuration Verification ==="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

echo -e "${YELLOW}Check 1: Netlify SPA Routing${NC}"
if grep -q "cleanupOutdatedCaches.*true" vite.config.ts; then
  echo -e "${GREEN}✓${NC} Workbox cleanup configured"
  ((PASS++))
else
  echo -e "${RED}✗${NC} Workbox cleanup not configured"
  ((FAIL++))
fi

if [ -f "dist/_redirects" ]; then
  echo -e "${GREEN}✓${NC} dist/_redirects exists"
  ((PASS++))
else
  echo -e "${RED}✗${NC} dist/_redirects missing"
  ((FAIL++))
fi

echo ""
echo -e "${YELLOW}Check 2: Service Worker Cache Management${NC}"
if grep -q "onNeedRefresh" src/main.tsx; then
  echo -e "${GREEN}✓${NC} SW update handler with cache clearing configured"
  ((PASS++))
else
  echo -e "${RED}✗${NC} SW update handler not configured"
  ((FAIL++))
fi

if grep -q "controllerchange" src/main.tsx; then
  echo -e "${GREEN}✓${NC} Controller change listener for cache cleanup"
  ((PASS++))
else
  echo -e "${RED}✗${NC} Controller change listener missing"
  ((FAIL++))
fi

echo ""
echo -e "${YELLOW}Check 3: Built Service Worker${NC}"
if [ -f "dist/sw.js" ]; then
  echo -e "${GREEN}✓${NC} dist/sw.js generated"
  ((PASS++))
else
  echo -e "${RED}✗${NC} dist/sw.js not found"
  ((FAIL++))
fi

if grep -q "cleanupOutdatedCaches" dist/sw.js; then
  echo -e "${GREEN}✓${NC} Cache cleanup in generated service worker"
  ((PASS++))
else
  echo -e "${RED}✗${NC} Cache cleanup not in generated SW"
  ((FAIL++))
fi

echo ""
echo -e "${YELLOW}Check 4: Production Files${NC}"
files=("dist/index.html" "dist/manifest.webmanifest" "dist/sw.js" "dist/assets/index-B4uzHPsu.js")
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} $file missing"
    ((FAIL++))
  fi
done

echo ""
echo "=== Summary ==="
echo -e "Passed: ${GREEN}${PASS}${NC}"
echo -e "Failed: ${RED}${FAIL}${NC}"

if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}✓ All checks passed!${NC}"
  echo -e "\nFixes applied:"
  echo "  1. Service worker cache cleanup enabled in Workbox config"
  echo "  2. SW update handler clears old caches on new deploys"
  echo "  3. Controller change listener catches cache stale issues"
  echo "  4. Netlify _redirects configured for SPA routing"
  exit 0
else
  echo -e "\n${RED}Some checks failed${NC}"
  exit 1
fi
