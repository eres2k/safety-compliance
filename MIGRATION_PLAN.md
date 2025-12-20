# Migration Plan: React SPA → Astro with React Islands

## Executive Summary

Migrate the WHS Safety Compliance Navigator from a React SPA (Vite) to Astro with React islands for:
- **90%+ reduction** in initial JavaScript bundle
- **Full SEO** for all legal content pages
- **Sub-second** Time to Interactive
- **Maintained interactivity** for AI features via React islands

---

## Phase 0: Preparation (Pre-Migration)

### 0.1 Create Migration Branch
```bash
git checkout -b feature/astro-migration
```

### 0.2 Document Current State
- [ ] Run Lighthouse audit on current site, save results
- [ ] Document current bundle size: `npm run build && du -sh dist/`
- [ ] List all routes/navigation states in current SPA
- [ ] Identify all localStorage usage patterns

### 0.3 Install Astro Alongside Vite (Parallel Setup)
```bash
npm install astro @astrojs/react @astrojs/tailwind @astrojs/netlify
```

### 0.4 Create Astro Config
Create `astro.config.mjs`:
```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  integrations: [
    react(),
    tailwind(),
  ],
  output: 'hybrid', // Static by default, server for dynamic routes
  adapter: netlify(),
  vite: {
    // Preserve existing Vite optimizations
  }
});
```

---

## Phase 1: Project Structure Migration

### 1.1 Create Astro Directory Structure
```
/home/user/safety-compliance/
├── src/
│   ├── pages/                    # NEW: Astro pages (SSG)
│   │   ├── index.astro           # Dashboard
│   │   ├── laws/
│   │   │   ├── index.astro       # Law browser landing
│   │   │   ├── [country]/
│   │   │   │   ├── index.astro   # Country law list
│   │   │   │   └── [id].astro    # Individual law page
│   │   ├── compliance/
│   │   │   ├── checker.astro     # Compliance checker
│   │   │   ├── dashboard.astro   # Compliance dashboard
│   │   │   └── audit.astro       # Audit trail
│   │   ├── tools/
│   │   │   ├── calculator.astro  # Prevention time calc
│   │   │   ├── penalties.astro   # Penalty lookup
│   │   │   ├── checklists.astro  # Checklist templates
│   │   │   └── glossary.astro    # Glossary
│   │   └── training.astro        # Training resources
│   ├── layouts/                  # NEW: Shared layouts
│   │   ├── BaseLayout.astro      # HTML shell, meta, fonts
│   │   ├── ModuleLayout.astro    # Module page wrapper
│   │   └── LawLayout.astro       # Individual law wrapper
│   ├── components/               # EXISTING: React components
│   │   ├── modules/              # Keep as React islands
│   │   ├── ui/                   # Keep as React islands
│   │   ├── Header.jsx → Header.astro (convert)
│   │   ├── Footer.jsx → Footer.astro (convert)
│   │   └── Dashboard.jsx         # Keep React for interactivity
│   ├── islands/                  # NEW: Explicit client islands
│   │   ├── LawSearch.jsx         # Search functionality
│   │   ├── AIExplanation.jsx     # AI-powered features
│   │   ├── ComplianceChecker.jsx # Interactive checker
│   │   └── ThemeToggle.jsx       # Dark mode toggle
│   ├── content/                  # NEW: Content collections
│   │   └── laws/                 # Generated from eu_safety_laws
│   ├── context/                  # EXISTING: Keep for islands
│   ├── hooks/                    # EXISTING: Keep for islands
│   ├── services/                 # EXISTING: Keep
│   └── data/                     # EXISTING: Keep
├── public/                       # Static assets
│   └── eu_safety_laws/           # MOVE from root
└── astro.config.mjs              # NEW
```

### 1.2 Files to Create

| File | Purpose | Priority |
|------|---------|----------|
| `src/layouts/BaseLayout.astro` | HTML shell with meta tags | P0 |
| `src/pages/index.astro` | Homepage/Dashboard | P0 |
| `src/pages/laws/[country]/index.astro` | Country law listings | P0 |
| `src/pages/laws/[country]/[id].astro` | Individual law pages | P0 |
| `astro.config.mjs` | Astro configuration | P0 |

### 1.3 Files to Convert (JSX → Astro)

| React Component | Astro Component | Reason |
|-----------------|-----------------|--------|
| `Header.jsx` | `Header.astro` | Static, no state needed |
| `Footer.jsx` | `Footer.astro` | Static, no state needed |
| `ModuleCard.jsx` | `ModuleCard.astro` | Static cards |
| `Card.jsx` | `Card.astro` | Static wrapper |

### 1.4 Files to Keep as React Islands

| Component | Island Type | Reason |
|-----------|-------------|--------|
| `LawBrowser.jsx` | `client:load` | Core search functionality |
| `ComplianceChecker.jsx` | `client:visible` | AI interaction |
| `ComplexitySlider.jsx` | `client:visible` | AI interaction |
| `CrossBorderComparison.jsx` | `client:idle` | AI comparison |
| `SearchHistory.jsx` | `client:idle` | localStorage access |
| `RateLimitIndicator.jsx` | `client:only` | Real-time updates |
| `LawVisualizer.jsx` | `client:visible` | Mermaid charts |
| `PdfViewer.jsx` | `client:visible` | iframe interaction |

---

## Phase 2: Core Layout & Infrastructure

### 2.1 Create Base Layout
```astro
---
// src/layouts/BaseLayout.astro
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
  lang?: string;
}

const {
  title,
  description = 'WHS Safety Compliance Navigator for EU Workplace Safety',
  lang = 'en'
} = Astro.props;
---

<!DOCTYPE html>
<html lang={lang} class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content={description} />
  <title>{title} | WHS Navigator</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

  <!-- Preload critical fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />

  <!-- Open Graph -->
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
</head>
<body class="min-h-screen bg-gray-50 dark:bg-whs-dark-900">
  <slot />
</body>
</html>
```

### 2.2 Create Module Layout
```astro
---
// src/layouts/ModuleLayout.astro
import BaseLayout from './BaseLayout.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
---

<BaseLayout title={title} description={description}>
  <div class="relative z-10 flex flex-col min-h-screen">
    <Header />
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-8">
      <slot />
    </main>
    <Footer />
  </div>
</BaseLayout>
```

### 2.3 Convert Header to Astro
```astro
---
// src/components/Header.astro
import ThemeToggle from '../islands/ThemeToggle.jsx';
import LanguageSelector from '../islands/LanguageSelector.jsx';

const navigation = [
  { name: 'Laws', href: '/laws' },
  { name: 'Compliance', href: '/compliance/checker' },
  { name: 'Tools', href: '/tools/calculator' },
  { name: 'Training', href: '/training' },
];
---

<header class="sticky top-0 z-50 bg-white/80 dark:bg-whs-dark-800/80 backdrop-blur-md border-b border-gray-200 dark:border-whs-dark-700">
  <div class="max-w-7xl mx-auto px-4 py-4">
    <div class="flex items-center justify-between">
      <a href="/" class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-br from-whs-orange-500 to-whs-orange-600 rounded-xl flex items-center justify-center">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">WHS Navigator</h1>
          <p class="text-xs text-gray-500 dark:text-gray-400">EU Safety Compliance</p>
        </div>
      </a>

      <nav class="hidden md:flex items-center gap-6">
        {navigation.map((item) => (
          <a href={item.href} class="text-gray-600 dark:text-gray-300 hover:text-whs-orange-500 transition-colors">
            {item.name}
          </a>
        ))}
      </nav>

      <div class="flex items-center gap-4">
        <LanguageSelector client:idle />
        <ThemeToggle client:idle />
      </div>
    </div>
  </div>
</header>
```

---

## Phase 3: Static Page Generation

### 3.1 Create Law Content Collection
```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const lawsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    title_en: z.string().optional(),
    abbreviation: z.string().optional(),
    type: z.string(),
    category: z.string().optional(),
    description: z.string().optional(),
    jurisdiction: z.string(),
    country: z.enum(['AT', 'DE', 'NL']),
    summary: z.string().optional(),
    content: z.object({
      full_text: z.string().optional(),
      sections: z.array(z.any()).optional(),
    }).optional(),
    source: z.object({
      local_pdf_path: z.string().optional(),
      pdf_url: z.string().optional(),
    }).optional(),
    tags: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  }),
});

export const collections = {
  laws: lawsCollection,
};
```

### 3.2 Generate Law Pages Script
```javascript
// scripts/generate-law-content.js
// Run at build time to convert eu_safety_laws JSON → Astro content collections

import fs from 'fs';
import path from 'path';

const COUNTRIES = ['at', 'de', 'nl'];
const OUTPUT_DIR = 'src/content/laws';

for (const country of COUNTRIES) {
  const dbPath = `eu_safety_laws/${country}/${country}_database.json`;
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

  const countryDir = path.join(OUTPUT_DIR, country.toUpperCase());
  fs.mkdirSync(countryDir, { recursive: true });

  for (const item of db.items) {
    const filename = `${item.id}.json`;
    fs.writeFileSync(
      path.join(countryDir, filename),
      JSON.stringify(item, null, 2)
    );
  }

  console.log(`Generated ${db.items.length} law files for ${country.toUpperCase()}`);
}
```

### 3.3 Create Country Law Index Page
```astro
---
// src/pages/laws/[country]/index.astro
import { getCollection } from 'astro:content';
import ModuleLayout from '../../../layouts/ModuleLayout.astro';
import LawSearch from '../../../islands/LawSearch.jsx';

export async function getStaticPaths() {
  return [
    { params: { country: 'AT' } },
    { params: { country: 'DE' } },
    { params: { country: 'NL' } },
  ];
}

const { country } = Astro.params;
const countryNames = { AT: 'Austria', DE: 'Germany', NL: 'Netherlands' };
const laws = await getCollection('laws', (entry) =>
  entry.id.startsWith(country + '/')
);
---

<ModuleLayout title={`${countryNames[country]} Safety Laws`}>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        {countryNames[country]} Safety Laws
      </h1>
      <span class="px-3 py-1 bg-whs-orange-100 dark:bg-whs-orange-900/30 text-whs-orange-600 rounded-full text-sm">
        {laws.length} laws
      </span>
    </div>

    <!-- Interactive search as React island -->
    <LawSearch country={country} laws={laws} client:load />

    <!-- Static law list for SEO -->
    <div class="grid gap-4">
      {laws.map((law) => (
        <a
          href={`/laws/${country}/${law.data.id}`}
          class="block p-4 bg-white dark:bg-whs-dark-800 rounded-lg border border-gray-200 dark:border-whs-dark-700 hover:border-whs-orange-500 transition-colors"
        >
          <div class="flex items-start justify-between">
            <div>
              <h2 class="font-semibold text-gray-900 dark:text-white">
                {law.data.abbreviation || law.data.title}
              </h2>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {law.data.title_en || law.data.title}
              </p>
            </div>
            <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-whs-dark-700 rounded">
              {law.data.type}
            </span>
          </div>
        </a>
      ))}
    </div>
  </div>
</ModuleLayout>
```

### 3.4 Create Individual Law Page
```astro
---
// src/pages/laws/[country]/[id].astro
import { getCollection } from 'astro:content';
import LawLayout from '../../../layouts/LawLayout.astro';
import AIExplanation from '../../../islands/AIExplanation.jsx';
import ComplexitySlider from '../../../components/ui/ComplexitySlider.jsx';
import PdfViewer from '../../../components/ui/PdfViewer.jsx';
import CrossBorderComparison from '../../../components/ui/CrossBorderComparison.jsx';

export async function getStaticPaths() {
  const laws = await getCollection('laws');
  return laws.map((law) => {
    const [country, ...idParts] = law.id.split('/');
    return {
      params: { country, id: idParts.join('/').replace('.json', '') },
      props: { law },
    };
  });
}

const { law } = Astro.props;
const { country, id } = Astro.params;
---

<LawLayout title={law.data.title} law={law.data}>
  <article class="space-y-8">
    <!-- Static Header -->
    <header class="border-b border-gray-200 dark:border-whs-dark-700 pb-6">
      <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
        <a href="/laws" class="hover:text-whs-orange-500">Laws</a>
        <span>/</span>
        <a href={`/laws/${country}`} class="hover:text-whs-orange-500">{country}</a>
        <span>/</span>
        <span>{law.data.abbreviation || id}</span>
      </div>

      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
        {law.data.title}
      </h1>

      {law.data.title_en && law.data.title_en !== law.data.title && (
        <p class="text-lg text-gray-600 dark:text-gray-400 mt-2">
          {law.data.title_en}
        </p>
      )}

      <div class="flex flex-wrap gap-2 mt-4">
        {law.data.tags?.map((tag) => (
          <span class="px-2 py-1 bg-gray-100 dark:bg-whs-dark-700 text-gray-600 dark:text-gray-300 rounded text-xs">
            {tag}
          </span>
        ))}
      </div>
    </header>

    <!-- Summary (Static) -->
    {law.data.summary && (
      <section class="prose dark:prose-invert max-w-none">
        <h2>Summary</h2>
        <p>{law.data.summary}</p>
      </section>
    )}

    <!-- AI Explanation Island -->
    <section class="bg-whs-orange-50 dark:bg-whs-orange-900/20 rounded-lg p-6">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        AI-Powered Explanation
      </h2>
      <ComplexitySlider lawId={law.data.id} client:visible />
      <AIExplanation law={law.data} client:visible />
    </section>

    <!-- Full Text (Static for SEO) -->
    {law.data.content?.full_text && (
      <section class="prose dark:prose-invert max-w-none">
        <h2>Full Text</h2>
        <div set:html={law.data.content.full_text} />
      </section>
    )}

    <!-- PDF Viewer Island -->
    {law.data.source?.local_pdf_path && (
      <section>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Original Document
        </h2>
        <PdfViewer
          pdfPath={law.data.source.local_pdf_path}
          client:visible
        />
      </section>
    )}

    <!-- Cross-Border Comparison Island -->
    <section>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Compare with Other Countries
      </h2>
      <CrossBorderComparison
        currentLaw={law.data}
        country={country}
        client:idle
      />
    </section>
  </article>
</LawLayout>
```

---

## Phase 4: Interactive Features Migration

### 4.1 Create Search Island
```jsx
// src/islands/LawSearch.jsx
import { useState, useMemo } from 'react';

export default function LawSearch({ country, laws, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredLaws = useMemo(() => {
    return laws.filter(law => {
      const matchesQuery = !query ||
        law.data.title.toLowerCase().includes(query.toLowerCase()) ||
        law.data.title_en?.toLowerCase().includes(query.toLowerCase()) ||
        law.data.abbreviation?.toLowerCase().includes(query.toLowerCase());

      const matchesType = typeFilter === 'all' || law.data.type === typeFilter;

      return matchesQuery && matchesType;
    });
  }, [laws, query, typeFilter]);

  const types = [...new Set(laws.map(l => l.data.type))];

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search laws..."
          className="flex-1 px-4 py-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 rounded-lg focus:ring-2 focus:ring-whs-orange-500 focus:border-transparent"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 bg-white dark:bg-whs-dark-800 border border-gray-200 dark:border-whs-dark-700 rounded-lg"
        >
          <option value="all">All Types</option>
          {types.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing {filteredLaws.length} of {laws.length} laws
      </p>

      {/* Results update the static list via CSS/JS */}
      <script type="application/json" id="filtered-laws">
        {JSON.stringify(filteredLaws.map(l => l.data.id))}
      </script>
    </div>
  );
}
```

### 4.2 Adapt AI Service for Islands
```javascript
// src/services/aiService.js
// Keep existing service, but ensure it works in island context

// Add SSR-safe localStorage wrapper
const safeLocalStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  }
};

// Update cache calls to use safeLocalStorage
export async function getCachedAIResponse(key) {
  const cached = safeLocalStorage.getItem(`ai_cache_${key}`);
  // ... rest of implementation
}
```

### 4.3 Create Context Provider Island
```jsx
// src/islands/AppProviders.jsx
// Wrapper for islands that need shared context

import { AppProvider } from '../context/AppContext';

export default function AppProviders({ children }) {
  return (
    <AppProvider>
      {children}
    </AppProvider>
  );
}
```

---

## Phase 5: Routing & Navigation

### 5.1 URL Structure Mapping

| Current SPA State | Astro Route | Type |
|-------------------|-------------|------|
| `activeModule: null` | `/` | SSG |
| `activeModule: 'lawBrowser'` | `/laws/[country]` | SSG |
| Law detail view | `/laws/[country]/[id]` | SSG |
| `activeModule: 'complianceChecker'` | `/compliance/checker` | SSG + Island |
| `activeModule: 'complianceDashboard'` | `/compliance/dashboard` | SSG + Island |
| `activeModule: 'auditTrail'` | `/compliance/audit` | SSG + Island |
| `activeModule: 'preventionTimeCalculator'` | `/tools/calculator` | SSG + Island |
| `activeModule: 'penaltyLookup'` | `/tools/penalties` | SSG + Island |
| `activeModule: 'checklistTemplates'` | `/tools/checklists` | SSG + Island |
| `activeModule: 'glossary'` | `/tools/glossary` | SSG |
| `activeModule: 'trainingResources'` | `/training` | SSG |

### 5.2 Create Redirect Map for Old URLs
```javascript
// netlify.toml additions
[[redirects]]
  from = "/#lawBrowser"
  to = "/laws"
  status = 301

[[redirects]]
  from = "/#complianceChecker"
  to = "/compliance/checker"
  status = 301
```

---

## Phase 6: Build & Deployment

### 6.1 Update package.json Scripts
```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "npm run generate:laws && astro build",
    "preview": "astro preview",
    "generate:laws": "node scripts/generate-law-content.js",
    "lint": "eslint src --ext js,jsx,ts,tsx,astro"
  }
}
```

### 6.2 Update netlify.toml
```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[headers]]
  for = "/eu_safety_laws/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/_astro/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 6.3 Add Pagefind for Search
```bash
npm install @pagefind/default-ui
```

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  // ...
  integrations: [
    // ...
  ],
  build: {
    // Enable Pagefind indexing
  }
});
```

Post-build hook for Pagefind:
```json
{
  "scripts": {
    "postbuild": "pagefind --site dist"
  }
}
```

---

## Phase 7: Testing & Validation

### 7.1 Pre-Migration Checklist
- [ ] All 45 laws render correctly at `/laws/[country]/[id]`
- [ ] AI explanation works on individual law pages
- [ ] Complexity slider functions
- [ ] Cross-border comparison loads
- [ ] PDF viewer displays local PDFs
- [ ] Search filters laws correctly
- [ ] Theme toggle persists
- [ ] Language selector works
- [ ] All tools pages function
- [ ] Mobile responsive

### 7.2 Performance Validation
- [ ] Lighthouse score > 90 for Performance
- [ ] Core Web Vitals all green
- [ ] Initial JS bundle < 50KB
- [ ] Time to Interactive < 2s
- [ ] SEO score > 95

### 7.3 SEO Validation
- [ ] All law pages have unique meta descriptions
- [ ] Open Graph tags present
- [ ] Sitemap generated
- [ ] robots.txt correct
- [ ] Google can crawl all pages

---

## Phase 8: Cleanup & Finalization

### 8.1 Remove Vite-Specific Code
- [ ] Delete `vite.config.js`
- [ ] Remove `@vitejs/plugin-react` from dependencies
- [ ] Remove custom `serveEuSafetyLaws` plugin
- [ ] Update imports to use Astro patterns

### 8.2 Remove Unused React Components
- [ ] Delete `src/App.jsx` (replaced by layouts)
- [ ] Delete `src/main.jsx` (replaced by Astro entry)
- [ ] Delete `index.html` (replaced by layouts)

### 8.3 Documentation Updates
- [ ] Update README.md with new architecture
- [ ] Document island usage patterns
- [ ] Update deployment instructions

---

## Migration Order (Recommended)

### Week 1: Foundation
1. Phase 0: Preparation
2. Phase 1.1-1.2: Directory structure
3. Phase 2: Core layouts

### Week 2: Static Content
4. Phase 3: Law page generation
5. Phase 1.3-1.4: Component conversion

### Week 3: Interactive Features
6. Phase 4: Island migration
7. Phase 5: Routing

### Week 4: Finalization
8. Phase 6: Build & deployment
9. Phase 7: Testing
10. Phase 8: Cleanup

---

## Rollback Plan

If migration fails:
1. Keep `main` branch unchanged until migration complete
2. Vite config preserved in `legacy/` folder
3. Can revert with single merge to main

---

## Success Metrics

| Metric | Before | Target | Measured |
|--------|--------|--------|----------|
| Initial JS | ~500KB | <50KB | |
| LCP | 3-5s | <1.5s | |
| TTI | 4-6s | <2s | |
| Lighthouse Perf | 60-70 | >90 | |
| SEO Score | 40-60 | >95 | |
| Build Time | 30s | <60s | |

---

## Notes for Claude (Self)

1. **Start with Phase 0** - Don't skip preparation
2. **Test incrementally** - Each phase should be testable
3. **Preserve functionality** - Don't break AI features
4. **Keep React islands minimal** - Only hydrate what needs interactivity
5. **Use `client:visible`** - Defer hydration until in viewport
6. **Don't over-engineer** - Match existing feature set, don't add new features
7. **Commit after each phase** - Enable easy rollback
