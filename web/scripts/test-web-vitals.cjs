/**
 * Teste de Web Vitals com Playwright
 * Mede LCP, FCP, TTI, CLS e métricas customizadas
 */

const { chromium } = require('playwright');

const URL = 'https://futebadosparcas.com.br';

async function measureWebVitals() {
  console.log('🚀 Teste de Web Vitals com Playwright\n');
  console.log('='.repeat(70));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  
  const page = await context.newPage();

  // Coletar métricas de performance
  const metrics = {
    navigation: {},
    webVitals: {},
    resources: [],
  };

  // Monitorar recursos carregados
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/assets/') && response.status() === 200) {
      const headers = response.headers();
      metrics.resources.push({
        url: url.replace(URL, ''),
        size: parseInt(headers['content-length'] || '0'),
      });
    }
  });

  // Injetar script para coletar Web Vitals
  await page.addInitScript(() => {
    window.__webVitals = {
      lcp: null,
      fcp: null,
      cls: 0,
      fid: null,
    };

    // LCP
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      window.__webVitals.lcp = entries[entries.length - 1];
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // FCP
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          window.__webVitals.fcp = entry;
        }
      }
    }).observe({ entryTypes: ['paint'] });

    // CLS
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__webVitals.cls += entry.value;
        }
      }
    }).observe({ entryTypes: ['layout-shift'] });
  });

  console.log('\n📡 Carregando página...\n');
  const startTime = Date.now();
  
  await page.goto(URL, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - startTime;

  // Aguardar um pouco para coletar métricas
  await page.waitForTimeout(3000);

  // Coletar métricas de navegação
  const navigationMetrics = await page.evaluate(() => {
    const perf = performance.getEntriesByType('navigation')[0];
    return {
      dns: perf.domainLookupEnd - perf.domainLookupStart,
      tcp: perf.connectEnd - perf.connectStart,
      ttfb: perf.responseStart - perf.requestStart,
      domContentLoaded: perf.domContentLoadedEventEnd - perf.startTime,
      load: perf.loadEventEnd - perf.startTime,
    };
  });

  metrics.navigation = navigationMetrics;

  // Coletar Web Vitals
  const webVitals = await page.evaluate(() => {
    return {
      lcp: window.__webVitals.lcp?.startTime || null,
      fcp: window.__webVitals.fcp?.startTime || null,
      cls: window.__webVitals.cls,
    };
  });

  metrics.webVitals = webVitals;

  console.log('📊 Métricas de Navegação:\n');
  console.log(`  DNS Lookup:          ${navigationMetrics.dns.toFixed(2)}ms`);
  console.log(`  TCP Connection:      ${navigationMetrics.tcp.toFixed(2)}ms`);
  console.log(`  TTFB:                ${navigationMetrics.ttfb.toFixed(2)}ms`);
  console.log(`  DOM Content Loaded:  ${navigationMetrics.domContentLoaded.toFixed(2)}ms`);
  console.log(`  Load Complete:       ${navigationMetrics.load.toFixed(2)}ms`);
  console.log(`  Total Load Time:     ${loadTime}ms`);

  console.log('\n🎯 Web Vitals:\n');
  
  const budgets = {
    lcp: { good: 2500, poor: 4000, label: 'Largest Contentful Paint' },
    fcp: { good: 1800, poor: 3000, label: 'First Contentful Paint' },
    cls: { good: 0.1, poor: 0.25, label: 'Cumulative Layout Shift' },
  };

  for (const [key, value] of Object.entries(webVitals)) {
    if (value === null) {
      console.log(`  ⚠️  ${budgets[key].label.padEnd(30)} Não coletado`);
      continue;
    }

    const budget = budgets[key];
    const icon = value <= budget.good ? '✅' : value <= budget.poor ? '⚠️' : '❌';
    const unit = key === 'cls' ? '' : 'ms';
    const displayValue = key === 'cls' ? value.toFixed(3) : value.toFixed(2);
    
    console.log(`  ${icon} ${budget.label.padEnd(30)} ${displayValue}${unit} (Good: ≤${budget.good}${unit})`);
  }

  console.log('\n📦 Recursos Carregados:\n');
  console.log(`  Total de recursos:   ${metrics.resources.length}`);
  console.log(`  Total baixado:       ${(metrics.resources.reduce((sum, r) => sum + r.size, 0) / 1024).toFixed(1)}KB`);
  
  const topResources = metrics.resources
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);
  
  console.log('\n  Top 5 maiores recursos:');
  topResources.forEach((r, i) => {
    console.log(`    ${i + 1}. ${r.url.padEnd(50)} ${(r.size / 1024).toFixed(1)}KB`);
  });

  console.log('\n🎯 Performance Budgets:\n');
  
  const perfBudgets = {
    'Total Load Time': { value: loadTime, good: 3000, poor: 5000, unit: 'ms' },
    'TTFB': { value: navigationMetrics.ttfb, good: 100, poor: 300, unit: 'ms' },
    'LCP': { value: webVitals.lcp, good: 2500, poor: 4000, unit: 'ms' },
    'FCP': { value: webVitals.fcp, good: 1800, poor: 3000, unit: 'ms' },
    'CLS': { value: webVitals.cls, good: 0.1, poor: 0.25, unit: '' },
  };

  for (const [name, budget] of Object.entries(perfBudgets)) {
    if (budget.value === null) {
      console.log(`  ⚠️  ${name.padEnd(20)} Não coletado`);
      continue;
    }

    const icon = budget.value <= budget.good ? '✅' : budget.value <= budget.poor ? '⚠️' : '❌';
    const displayValue = budget.unit === '' ? budget.value.toFixed(3) : budget.value.toFixed(0);
    console.log(`  ${icon} ${name.padEnd(20)} ${displayValue}${budget.unit} (Good: ≤${budget.good}${budget.unit}, Poor: >${budget.poor}${budget.unit})`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✨ Resumo:\n');
  
  const passed = Object.values(perfBudgets).filter(b => b.value !== null && b.value <= b.good).length;
  const total = Object.values(perfBudgets).filter(b => b.value !== null).length;
  
  console.log(`  Budgets atendidos: ${passed}/${total} (${(passed/total*100).toFixed(0)}%)`);
  
  if (passed === total) {
    console.log('  🎉 Todos os budgets foram atendidos!');
  } else {
    console.log('  ⚠️  Alguns budgets não foram atendidos. Veja recomendações acima.');
  }

  console.log('\n' + '='.repeat(70) + '\n');

  await browser.close();
}

measureWebVitals().catch(console.error);
