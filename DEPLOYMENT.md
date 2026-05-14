# Lhoxtencer - Universal Deployment Guide

This guide explains how to deploy Lhoxtencer to any hosting platform and fix the QR code/asset loading issues.

## The Problem

When deploying a Single Page Application (SPA), the server must:
1. **Serve static assets** (`.js`, `.css`, `.webmanifest`, etc.) with correct MIME types
2. **Only fall back to `index.html`** for actual routes (not for missing files)

If these aren't configured correctly, you get errors like:
- `Failed to load module script: Expected a JavaScript module but got text/html`
- `Manifest: Line 1, column 1, Syntax error`

## Quick Fixes Applied ✅

1. **Created `/public/manifest.webmanifest`** - Web app manifest file
2. **Added manifest link to HTML** - `<link rel="manifest" href="./manifest.webmanifest" />`
3. **Created `netlify.toml`** - Netlify configuration
4. **Created `server.js`** - Universal Node.js/Express server
5. **Created `public/.htaccess`** - Apache configuration

---

## Deployment by Platform

### 🟢 Netlify (Current)

**Status:** ✅ Fixed with `netlify.toml`

**How it works:**
- Netlify reads `netlify.toml` automatically
- Sets correct MIME types for assets
- Routes all undefined paths to `index.html`

**Deploy steps:**
```bash
bun run build
# Push to GitHub
# Netlify auto-deploys
```

**Verify it works:**
1. Deploy to Netlify
2. Open DevTools → Network tab
3. Check that `index-*.js` returns JavaScript (not HTML)
4. Check that `manifest.webmanifest` returns JSON (not HTML)

---

### 🔵 Node.js Hosting (Heroku, Railway, Render, Replit, Custom VPS)

**How it works:**
- Uses `server.js` with Express
- Automatically sets correct MIME types
- Handles SPA routing properly

**Deploy steps:**

```bash
# 1. Update package.json with start script
# Add this to "scripts" section:
"start": "node server.js"

# 2. Install dependencies (if deploying)
bun install

# 3. Build
bun run build

# 4. For platforms like Heroku:
git push heroku main

# 5. For platforms like Railway/Render:
# - Connect GitHub repository
# - Set build command: bun run build
# - Set start command: node server.js
# - Platform auto-deploys
```

**For Railway (recommended for easy setup):**
```bash
# 1. Install Railway CLI: npm install -g @railway/cli
# 2. Login: railway login
# 3. Initialize: railway init
# 4. Deploy: railway up
# (Railway automatically detects package.json and runs start script)
```

---

### 🟠 Traditional Web Hosting (Apache/cPanel/Bluehost/GoDaddy)

**How it works:**
- Uses `.htaccess` file in public folder
- Rewrite rules handle SPA routing
- Works on shared hosting

**Deploy steps:**

```bash
# 1. Build locally
bun run build

# 2. Upload dist/ contents to public_html or www folder:
#    - All files from dist/ go to root

# 3. Upload public/.htaccess to public_html or www folder
#    - .htaccess controls routing

# 4. Verify in cPanel that mod_rewrite is enabled
#    (Usually enabled by default)
```

**Note:** If `.htaccess` doesn't work:
- Ask hosting provider to enable `mod_rewrite`
- Check file permissions (644 for .htaccess)
- Try renaming to `htaccess.txt` and using cPanel's `.htaccess` editor

---

### 🟣 Vercel

**Deploy steps:**

```bash
# 1. Create vercel.json in root:
cat > vercel.json << 'EOF'
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/:path((?!assets/|manifest\\.webmanifest|sw\\.js|robots\\.txt|pwa-.*\\.svg).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
EOF

# 2. Push to GitHub
git add .
git commit -m "Deploy to Vercel"
git push origin main

# 3. In Vercel dashboard: Import project and it auto-deploys
```

---

### 🔴 Docker (Self-hosted)

**How it works:**
- Build as static files
- Serve with Nginx or Node.js

**Using Node.js server:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json bun.lockb ./
RUN npm install -g bun && bun install --frozen-lockfile

COPY . .
RUN bun run build

EXPOSE 3000
CMD ["node", "server.js"]
```

**Using Nginx:**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN npm install -g bun && bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Create `nginx.conf`:**
```nginx
server {
  listen 80;
  server_name _;
  
  root /usr/share/nginx/html;
  index index.html;
  
  # Cache static assets
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
  
  # Proper MIME types
  location ~* \.webmanifest$ {
    add_header Content-Type "application/manifest+json";
  }
  
  # SPA routing
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

---

## Testing Checklist ✅

After deploying to any platform:

1. **Check console for errors**
   ```
   DevTools → Console
   Should show no "Failed to load module" errors
   ```

2. **Verify assets load**
   ```
   DevTools → Network → XHR/Fetch
   index-*.js should be type: fetch (not document)
   manifest.webmanifest should be type: fetch
   All should have status 200 (not 404 or 500)
   ```

3. **Check MIME types**
   ```
   DevTools → Network
   index-*.js should have Content-Type: application/javascript
   manifest.webmanifest should have Content-Type: application/manifest+json
   ```

4. **Test QR codes**
   - Navigate to `/qrcodes` page
   - QR codes should render without errors
   - PDF export should work

5. **Test routing**
   - Direct URL access: `/accueil`, `/reservations`, etc.
   - Should load page (not 404)

---

## Troubleshooting

### Error: "Failed to load module script: Expected JavaScript module but got text/html"

**Cause:** `.js` file is being served as HTML

**Solutions:**
1. For **Netlify**: Verify `netlify.toml` exists in root
2. For **Node.js**: Use `server.js` with correct MIME type handlers
3. For **Apache**: Ensure `.htaccess` is in public folder with correct permissions (644)
4. For **Other**: Check server config to serve assets before SPA fallback

### Error: "Manifest: Line 1, column 1, Syntax error"

**Cause:** `manifest.webmanifest` is being served as HTML

**Solutions:**
1. Verify file exists: `dist/manifest.webmanifest` (should be ~400 bytes JSON)
2. Set MIME type to `application/manifest+json`
3. Check that it's not caught by SPA fallback route

### QR codes don't render / errors in browser console

**Cause:** Usually related to asset loading (see errors above)

**Solution:**
1. Fix the "Failed to load module script" error first
2. Once all assets load, QR codes will work

---

## Environment Variables

Create `.env` if you need to configure for production:

```bash
# .env
VITE_API_URL=https://your-api.example.com
VITE_APP_NAME=Lhoxtencer
```

Reference in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

---

## Next Steps

1. **Choose your platform** from the options above
2. **Copy the relevant config file** to your deployment
3. **Deploy** using the steps for your platform
4. **Test** using the checklist above
5. **Verify QR codes work** without console errors

## Support

If issues persist after following this guide:

1. Check the browser DevTools → Network tab to see what MIME types are being returned
2. Check the server logs for errors
3. Verify all files from `dist/` are uploaded
4. Ensure `.htaccess` or config files have correct permissions
5. Try the Node.js `server.js` approach - it works universally
