#!/bin/bash

echo "=== Netlify SPA Routing Configuration Verification ==="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

# Check 1: netlify.toml exists
echo -e "${YELLOW}Check 1: netlify.toml configuration${NC}"
if [ -f "netlify.toml" ]; then
  echo -e "${GREEN}✓${NC} netlify.toml exists in project root"
  ((PASS++))
  
  if grep -q "command = \"bun run build\"" netlify.toml; then
    echo -e "${GREEN}✓${NC} Build command: bun run build"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} Build command not found or incorrect"
    ((FAIL++))
  fi
  
  if grep -q "publish = \"dist\"" netlify.toml; then
    echo -e "${GREEN}✓${NC} Publish directory: dist"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} Publish directory incorrect"
    ((FAIL++))
  fi
else
  echo -e "${RED}✗${NC} netlify.toml not found"
  ((FAIL++))
fi

echo ""

# Check 2: public/_redirects exists
echo -e "${YELLOW}Check 2: public/_redirects file${NC}"
if [ -f "public/_redirects" ]; then
  echo -e "${GREEN}✓${NC} public/_redirects exists"
  ((PASS++))
  
  if grep -q "/*  /index.html  200" public/_redirects; then
    echo -e "${GREEN}✓${NC} SPA routing rule correct (/* -> /index.html 200)"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} SPA routing rule missing or incorrect"
    ((FAIL++))
  fi
else
  echo -e "${RED}✗${NC} public/_redirects not found"
  ((FAIL++))
fi

echo ""

# Check 3: dist/_redirects exists (built version)
echo -e "${YELLOW}Check 3: dist/_redirects in build output${NC}"
if [ -f "dist/_redirects" ]; then
  echo -e "${GREEN}✓${NC} dist/_redirects exists (copied during build)"
  ((PASS++))
  
  if grep -q "/*  /index.html  200" dist/_redirects; then
    echo -e "${GREEN}✓${NC} SPA routing rule in build output is correct"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} SPA routing rule in build output incorrect"
    ((FAIL++))
  fi
else
  echo -e "${RED}✗${NC} dist/_redirects not found - won't be deployed!"
  ((FAIL++))
fi

echo ""

# Check 4: vite.config settings
echo -e "${YELLOW}Check 4: vite.config.ts SPA settings${NC}"
if grep -q "appType.*spa" vite.config.ts; then
  echo -e "${GREEN}✓${NC} appType set to 'spa'"
  ((PASS++))
else
  echo -e "${RED}✗${NC} appType not set to 'spa'"
  ((FAIL++))
fi

if grep -q 'base.*"./"' vite.config.ts; then
  echo -e "${GREEN}✓${NC} base set to './' (relative paths)"
  ((PASS++))
else
  echo -e "${RED}✗${NC} base not set to './' or incorrect"
  ((FAIL++))
fi

echo ""

# Check 5: dist files needed for deployment
echo -e "${YELLOW}Check 5: Build output files${NC}"
required_files=(
  "dist/index.html"
  "dist/manifest.webmanifest"
  "dist/_redirects"
  "dist/assets/index-CTxQfp7N.js"
)

all_exist=true
for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
  else
    echo -e "${RED}✗${NC} $file missing"
    all_exist=false
  fi
done

if [ "$all_exist" = true ]; then
  ((PASS++))
else
  ((FAIL++))
fi

echo ""
echo "=== Summary ==="
echo -e "Passed: ${GREEN}${PASS}${NC}"
echo -e "Failed: ${RED}${FAIL}${NC}"

if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}✓ All Netlify SPA routing checks passed!${NC}"
  echo -e "\nConfiguration summary:"
  echo "  • netlify.toml: Exists with correct build config"
  echo "  • public/_redirects: SPA routing rule configured"
  echo "  • dist/_redirects: Will be deployed with build"
  echo "  • vite.config.ts: SPA mode enabled"
  echo -e "\nDeployment ready:"
  echo "  1. Commit changes: git add . && git commit -m 'Netlify config'"
  echo "  2. Push to main: git push origin main"
  echo "  3. Netlify auto-deploys"
  echo -e "\nTest after deploy:"
  echo "  • Navigate to /guest and reload (F5)"
  echo "  • Navigate to /guest/123 and reload (F5)"
  echo "  • Check DevTools Network - all assets should show 200"
  exit 0
else
  echo -e "\n${RED}Some checks failed${NC}"
  exit 1
fi
