const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('../web/node_modules/esbuild');
const { chromium } = require('../web/node_modules/@playwright/test');

let browser;
let bundle;
before(async () => {
  const output = await build({
    stdin: {
      contents: `
        import React, { useEffect } from 'react';
        import { createRoot } from 'react-dom/client';
        import { TextField, Stack } from '@mui/material';
        import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
        function Probe() {
          const { setMode, setDocumentThemeOverride } = useTheme();
          useEffect(() => { window.setMode = setMode; window.setOverride = setDocumentThemeOverride; }, []);
          return <Stack spacing={2} sx={{ p: 4, maxWidth: 400 }}>
            <TextField label="Data" type="date" defaultValue="2026-09-08" />
            <TextField label="Horário" type="time" defaultValue="19:00" />
          </Stack>;
        }
        createRoot(document.getElementById('root')).render(<ThemeProvider><Probe /></ThemeProvider>);
      `,
      resolveDir: path.resolve(__dirname, '../web'),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  bundle = output.outputFiles[0].text;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); });

for (const mode of ['light', 'dark', 'oled']) {
  test(`native inputs inherit ${mode} through html, body and root; landing override restores`, async () => {
    const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
    try {
      // A real origin makes localStorage available; no Firebase/app backend needed.
      await page.route('http://theme.test/', (route) => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>',
      }));
      await page.goto('http://theme.test/');
      // Capture the resolved theme, not intermediate colors during its transition.
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
      await page.addScriptTag({ content: bundle });
      await page.waitForFunction(() => typeof window.setMode === 'function');
      await page.evaluate((next) => window.setMode(next), mode);
      const expected = mode === 'light' ? 'light' : 'dark';
      await page.waitForFunction((resolved) => document.documentElement.dataset.resolvedTheme === resolved, expected);
      const schemes = () => page.evaluate(() => ['html', 'body', '#root', 'input[type=date]', 'input[type=time]']
        .map((selector) => getComputedStyle(document.querySelector(selector)).colorScheme));
      assert.deepEqual(await schemes(), Array(5).fill(expected));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const screenshot = await page.screenshot({ path: path.resolve(__dirname, `../web/test-results/native-color-scheme-${mode}.png`) });
      if (expected === 'dark') {
        const indicators = await page.evaluate(async (png) => {
          const image = new Image();
          image.src = `data:image/png;base64,${png}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          const luminance = (rgb) => rgb.map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
            .reduce((sum, v, index) => sum + v * [0.2126, 0.7152, 0.0722][index], 0);
          const background = luminance(getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number));
          return ['date', 'time'].map((type) => {
            const rect = document.querySelector(`input[type=${type}]`).getBoundingClientRect();
            const pixels = context.getImageData(Math.floor(rect.right - 31), Math.floor(rect.y + rect.height / 2 - 7), 16, 14).data;
            let readablePixels = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              const foreground = luminance([pixels[i], pixels[i + 1], pixels[i + 2]]);
              const ratio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
              if (ratio >= 3) readablePixels++;
            }
            return { type, readablePixels };
          });
        }, screenshot.toString('base64'));
        for (const indicator of indicators) {
          assert.ok(indicator.readablePixels >= 6, `${mode}/${indicator.type}: visible picker strokes must reach 3:1 contrast`);
        }
      }
      await page.evaluate(() => window.setOverride('light'));
      await page.waitForFunction(() => document.documentElement.dataset.resolvedTheme === 'light');
      assert.deepEqual(await schemes(), Array(5).fill('light'));
      await page.evaluate(() => window.setOverride(null));
      await page.waitForFunction((resolved) => document.documentElement.dataset.resolvedTheme === resolved, expected);
      assert.deepEqual(await schemes(), Array(5).fill(expected));
    } finally {
      await page.close();
    }
  });
}
