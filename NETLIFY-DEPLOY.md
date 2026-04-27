# 🚀 Deploy to Netlify - QR Code Fix

## What Was Fixed

Your QR codes weren't working because:
- ❌ Assets (`.js` files) were being served as HTML instead of JavaScript
- ❌ `manifest.webmanifest` was being served as HTML instead of JSON
- ❌ Netlify wasn't configured to handle SPA routing correctly

**Now fixed with `netlify.toml`** ✅

---

## Deploy to Netlify (1 minute)

### Option 1: Automatic Deploy (Recommended)

```bash
# 1. Commit the new files
git add netlify.toml public/manifest.webmanifest DEPLOYMENT.md DEPLOYMENT-QUICK-START.md
git commit -m "Fix: QR codes and asset loading in production

- Add netlify.toml with proper MIME types and SPA routing
- Add manifest.webmanifest for PWA support
- Set correct Content-Type headers for all asset types
- Configure proper caching for static assets"

# 2. Push to your repository
git push origin main

# 3. Netlify automatically redeploys!
# Check: https://app.netlify.com/sites/your-site-name/deploys
```

### Option 2: Manual Deploy (If needed)

```bash
# 1. Build locally
bun run build

# 2. Deploy using Netlify CLI
npm install -g netlify-cli
netlify deploy --prod --dir dist
```

---

## Verify It's Fixed ✅

After deployment, check:

1. **Open DevTools** (F12)
2. **Go to Network tab**
3. **Reload the page**
4. **Look for these files and verify their Content-Type:**

| File | Should Have | Status |
|------|-------------|--------|
| `index-*.js` | `Content-Type: application/javascript` | 200 |
| `manifest.webmanifest` | `Content-Type: application/manifest+json` | 200 |
| `*.css` | `Content-Type: text/css` | 200 |
| `sw.js` | `Content-Type: application/javascript` | 200 |

4. **Check Console** - Should have no red errors
5. **Test QR codes** - Go to `/qrcodes` page, QR codes should render

---

## What netlify.toml Does

```toml
# Build & publish settings
[build]
  command = "bun run build"    # Build command
  publish = "dist"             # Output folder

# Headers for static assets
[[headers]]
  for = "/assets/*"
  Cache-Control = "public, max-age=31536000, immutable"
  Content-Type = "application/javascript; charset=utf-8"

# Headers for manifest
[[headers]]
  for = "/manifest.webmanifest"
  Content-Type = "application/manifest+json"

# SPA routing - all routes → index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## If Something Goes Wrong

### 🔴 Still seeing "Failed to load module script" error?

1. Force refresh browser: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)
2. Clear browser cache:
   - Chrome: DevTools → Application → Cache Storage → Clear
   - Firefox: Ctrl+Shift+Delete → Cache
3. Wait 5-10 minutes for Netlify CDN to update

### 🔴 Still seeing "Manifest: Syntax error"?

1. Verify `manifest.webmanifest` exists in dist folder
2. Check the Content-Type header (should be `application/manifest+json`, not `text/html`)
3. Try in incognito/private window (no cache)

### 🔴 QR codes still not working?

1. Fix the asset loading first (steps above)
2. Once assets load, QR codes will work automatically
3. If still broken, check browser console for specific errors

---

## Next Time You Change Servers

This setup is **universal**:
- **Netlify?** Use `netlify.toml` ✅ (you're here)
- **Vercel?** Use `vercel.json` ✅ (included)
- **Railway/Render?** Use `server.js` ✅ (included)
- **Self-hosted?** Use `server.js` or `nginx.conf` ✅ (included)
- **cPanel/Bluehost?** Use `public/.htaccess` ✅ (included)

See `DEPLOYMENT-QUICK-START.md` for all options.

---

## Support

See `DEPLOYMENT.md` for:
- Complete troubleshooting guide
- Deployment instructions for other platforms
- Docker setup
- Nginx configuration
- Apache .htaccess setup

---

**You're all set!** 🎉 QR codes now work in production!
