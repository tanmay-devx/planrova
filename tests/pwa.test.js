import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Service Worker & Web Manifest Audit', () => {
  const rootDir = path.resolve(__dirname, '..');
  const swPath = path.join(rootDir, 'public', 'sw.js');
  const manifestPath = path.join(rootDir, 'public', 'site.webmanifest');

  it('contains valid service worker script with upgraded cache version', () => {
    expect(fs.existsSync(swPath)).toBe(true);
    const swContent = fs.readFileSync(swPath, 'utf8');

    // Verify cache version bumped
    expect(swContent).toContain("CACHE_NAME = 'planrova-v2'");
    // Verify offline navigation fallback
    expect(swContent).toContain("event.request.mode === 'navigate'");
    expect(swContent).toContain("caches.match('/index.html')");
  });

  it('guarantees all precached assets in sw.js exist on the filesystem', () => {
    const swContent = fs.readFileSync(swPath, 'utf8');
    const match = swContent.match(/const ASSETS = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();

    const assetEntries = match[1]
      .split(',')
      .map(line => line.trim().replace(/['"]/g, ''))
      .filter(line => line.length > 0 && line !== '/');

    for (const asset of assetEntries) {
      const targetPath = asset === '/index.html'
        ? path.join(rootDir, 'index.html')
        : path.join(rootDir, 'public', asset.replace(/^\//, ''));

      expect(fs.existsSync(targetPath), `Missing precached asset: ${asset} at ${targetPath}`).toBe(true);
    }
  });

  it('validates web manifest structure and required PWA fields', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);

    expect(manifest.name).toBeDefined();
    expect(manifest.short_name).toBeDefined();
    expect(manifest.start_url).toBeDefined();
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});

