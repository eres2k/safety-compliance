# WHS Safety Compliance Navigator

AI-Powered Workplace Health and Safety Compliance Navigator for Austria (ASchG), Germany (DGUV), and Netherlands (Arbowet).

## Features

- **Law Browser & Search**: Navigate and search safety legislation with AI-powered explanations
- **Compliance Checker**: Check requirements based on company size, industry, and topic
- **Document Generator**: Create safety documents from pre-defined templates
- **Quick Reference Tools**: Calculators, penalty lookups, and glossary
- **Regulation Lookup**: Query specific requirements with structured results

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Netlify Functions (for AI API)
- Google Gemini AI

## Setup

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Netlify Deployment

### Environment Variables

Set the following environment variable in Netlify:

- `GEMINI_API_KEY`: Your Google Gemini API key

### Deploy

1. Connect your repository to Netlify
2. Set the build command: `npm run build`
3. Set the publish directory: `dist`
4. Add the `GEMINI_API_KEY` environment variable
5. Deploy!

## Project Structure

```
src/
├── components/
│   ├── modules/          # Feature modules
│   │   ├── LawBrowser.jsx
│   │   ├── ComplianceChecker.jsx
│   │   ├── DocumentGenerator.jsx
│   │   ├── QuickReference.jsx
│   │   └── RegulationLookup.jsx
│   ├── ui/               # Reusable UI components
│   ├── Header.jsx
│   ├── Footer.jsx
│   ├── Dashboard.jsx
│   └── ModuleCard.jsx
├── context/
│   └── AppContext.jsx    # Global state management
├── data/
│   ├── laws/             # Legal framework data (JSON)
│   │   ├── aschg.json
│   │   ├── dguv.json
│   │   └── arbowet.json
│   └── locales/          # Translations (JSON)
│       ├── en.json
│       ├── de.json
│       └── nl.json
├── hooks/
│   └── useAI.js          # AI integration hook
├── services/
│   └── aiService.js      # AI API service
├── App.jsx
├── main.jsx
└── index.css

netlify/
└── functions/
    └── ai-generate.js    # Serverless function for AI API
```

## Supported Legal Frameworks

- **Austria (AT)**: ASchG - ArbeitnehmerInnenschutzgesetz
- **Germany (DE)**: DGUV & ArbSchG - Arbeitsschutzgesetz
- **Netherlands (NL)**: Arbowet - Arbeidsomstandighedenwet

## Localization

Available in:
- English
- German (Deutsch)
- Dutch (Nederlands)

## License

MIT
