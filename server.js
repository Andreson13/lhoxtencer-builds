/**
 * Universal Express Server for Hotel Harmony
 * Works with any Node.js hosting (Heroku, Railway, Render, custom servers, etc)
 * 
 * Usage: node server.js
 * Port: 3000 (or process.env.PORT)
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = join(__dirname, 'dist');

// Trust proxy for correct client IPs when behind a reverse proxy
app.set('trust proxy', 1);

// 1. Serve static assets with proper MIME types and caching
app.use(express.static(DIST_DIR, {
  maxAge: '1y',
  etag: false,
  setHeaders: (res, path) => {
    // Cache immutable assets forever (they have hash in filename)
    if (path.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    
    // Serve manifest and service worker with proper MIME types
    if (path.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
    if (path.endsWith('sw.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
    
    // Don't cache HTML files - they should always be fresh
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

// 2. Specific handlers for assets to ensure they're never served as HTML
app.get('/assets/*', (req, res, next) => {
  const filePath = join(DIST_DIR, req.path);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Asset not found' });
  }
});

app.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json');
  res.sendFile(join(DIST_DIR, 'manifest.webmanifest'));
});

app.get('/sw.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(join(DIST_DIR, 'sw.js'));
});

// 3. SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(DIST_DIR, 'index.html'));
});

// 4. Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏨 Hotel Harmony running at http://0.0.0.0:${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
});
