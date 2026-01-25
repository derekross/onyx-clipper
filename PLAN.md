# Onyx Clipper - Implementation Plan

## Overview

Onyx Clipper is a browser extension that allows users to clip web pages, highlight content, and save them directly to their Onyx vault as Markdown files.

## Summary of Decisions

| Decision | Choice |
|----------|--------|
| Default save location | `Clippings/` folder |
| Frontmatter | Yes - YAML metadata |
| Initial browsers | Chrome + Firefox |
| Onyx integration | Yes - `onyx://` deep link handler |
| Branding | Use Onyx icon and visual style |
| Safari support | Deferred to future release |
| AI features | Yes - OpenCode integration via Onyx app |

---

## Project Structure

```
/onyx-clipper/
├── src/
│   ├── core/
│   │   ├── popup.ts              # Main popup UI logic
│   │   ├── popup.html            # Popup HTML
│   │   ├── settings.ts           # Settings page logic
│   │   └── settings.html         # Settings HTML
│   ├── utils/
│   │   ├── browser-polyfill.ts   # Cross-browser API wrapper
│   │   ├── content-extractor.ts  # Defuddle integration
│   │   ├── markdown-converter.ts # Turndown configuration
│   │   ├── highlighter.ts        # Highlight management
│   │   ├── highlighter-overlay.ts# Highlight rendering
│   │   ├── template-compiler.ts  # Variable interpolation
│   │   ├── storage.ts            # Storage utilities
│   │   └── onyx-api.ts           # Communication with Onyx app
│   ├── types/
│   │   └── types.ts              # TypeScript interfaces
│   ├── templates/
│   │   └── defaults.ts           # Default template definitions
│   ├── background.ts             # Service worker
│   ├── content.ts                # Content script
│   ├── manifest.chrome.json      # Chrome Manifest V3
│   ├── manifest.firefox.json     # Firefox Manifest V3
│   ├── style.scss                # Main styles
│   └── highlighter.scss          # Highlight overlay styles
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
├── scripts/
│   └── build.js                  # Build script
├── webpack.config.js
├── package.json
├── tsconfig.json
└── README.md
```

---

## Implementation Phases

### Phase 1: Project Setup (Day 1-2)
- [x] Create project directory
- [x] Write implementation plan
- [ ] Initialize package.json with dependencies
- [ ] Configure TypeScript (tsconfig.json)
- [ ] Configure Webpack for multi-browser builds
- [ ] Create Chrome manifest (Manifest V3)
- [ ] Create Firefox manifest (Manifest V3)
- [ ] Set up SCSS compilation
- [ ] Copy/create Onyx icons

### Phase 2: Content Extraction & Markdown (Day 3-4)
- [ ] Implement content extractor with Defuddle
- [ ] Configure Turndown for Markdown conversion
- [ ] Add custom Turndown rules (tables, code, math, embeds)
- [ ] Implement frontmatter generation
- [ ] Handle image URL conversion (relative → absolute)

### Phase 3: Template System (Day 5-6)
- [ ] Define template TypeScript interfaces
- [ ] Implement variable interpolation engine
- [ ] Create filter/pipe system for variables
- [ ] Build default templates (Article, Recipe, Reference, Highlight)
- [ ] Implement template triggers (URL matching)
- [ ] Add template storage and management

### Phase 4: Highlighting System (Day 7-8)
- [ ] Implement highlight creation from text selection
- [ ] Store highlights per-URL in browser storage
- [ ] Render highlight overlays (positioned divs)
- [ ] Add highlight notes/annotations
- [ ] Implement undo/redo
- [ ] Export highlights to Markdown format

### Phase 5: Onyx Integration (Day 9-11)
- [x] Add deep link handler to Onyx app (`onyx://clip`)
- [x] Register URL scheme in Tauri config
- [x] Implement clipboard-based content transfer
- [x] Add AI request handler (`onyx://ai`)
- [ ] Implement AI prompt processing via OpenCode (placeholder added)
- [x] Create Clippings folder management

### Phase 6: UI & Polish (Day 12-14)
- [ ] Build popup UI with template selector and preview
- [ ] Build settings page (templates, highlights, shortcuts)
- [ ] Add context menu integration
- [ ] Implement keyboard shortcuts
- [ ] Add import/export for settings
- [ ] Style with Onyx branding

### Phase 7: Testing & Release (Day 15-17)
- [ ] Write unit tests for template compilation
- [ ] Write unit tests for Markdown conversion
- [ ] Manual testing across browsers and websites
- [ ] Create production builds
- [ ] Write documentation (README, user guide)
- [ ] Prepare for browser store submissions

---

## Key Features

### Content Clipping
- Extract main content from any web page
- Convert HTML to clean Markdown
- Preserve tables, code blocks, images, and formatting
- Extract metadata (title, author, date, description)

### Templates
- Customizable templates for different content types
- Variable interpolation: `{{title}}`, `{{content}}`, `{{url}}`, etc.
- Filter system: `{{date:YYYY-MM-DD}}`, `{{title|slugify}}`
- Auto-select templates based on URL patterns
- AI-powered variables: `{{prompt:"Summarize this article"}}`

### Highlighting
- Highlight text on any web page
- Highlights persist across browser sessions
- Add notes to highlights
- Export highlights to Markdown

### Onyx Integration
- Save clips directly to Onyx vault via `onyx://` URL scheme
- AI processing via Onyx/OpenCode integration
- Configurable save location (default: `Clippings/`)

---

## Default Templates

### Article
```markdown
---
title: "{{title}}"
author: "{{author}}"
published: {{published}}
source: "{{url}}"
clipped: {{date:YYYY-MM-DDTHH:mm:ss}}
tags: [clippings, articles]
---

{{content}}
```

### Recipe
```markdown
---
title: "{{title}}"
author: "{{author}}"
source: "{{url}}"
clipped: {{date}}
tags: [clippings, recipes]
---

## Ingredients
{{prompt:"Extract the ingredients list from this recipe as a markdown checklist"}}

## Instructions
{{prompt:"Extract the cooking instructions as numbered steps"}}

---

## Original Content
{{content}}
```

### Highlight Only
```markdown
---
title: "{{title}}"
source: "{{url}}"
clipped: {{date}}
tags: [clippings, highlights]
---

## Highlights from {{title}}

{{highlights}}
```

### Reference
```markdown
---
title: "{{title}}"
type: reference
source: "{{url}}"
clipped: {{date}}
tags: [clippings, references]
---

> {{description}}

[Source]({{url}})
```

---

## Communication Protocol

### Clip to Onyx
```
onyx://clip?title={title}&path={path}&clipboard
```
- Content is copied to clipboard before opening URL
- Onyx reads content from clipboard and saves to vault

### AI Request
```
onyx://ai?prompt={prompt}&callback_id={id}&clipboard
```
- Context is copied to clipboard with callback ID
- Onyx processes prompt via OpenCode
- Result returned via clipboard with callback ID

---

## Dependencies

### Runtime
- `defuddle` - Content extraction
- `turndown` - HTML to Markdown
- `turndown-plugin-gfm` - GFM support (tables, strikethrough)
- `dompurify` - HTML sanitization
- `dayjs` - Date formatting
- `lz-string` - Storage compression
- `webextension-polyfill` - Cross-browser API

### Development
- `typescript`
- `webpack` + `webpack-cli`
- `sass`
- `copy-webpack-plugin`
- `@types/chrome`
- `@types/webextension-polyfill`

---

## Browser Support

| Browser | Status | Store |
|---------|--------|-------|
| Chrome | Primary | Chrome Web Store |
| Firefox | Primary | Firefox Add-ons |
| Edge | Via Chrome build | Edge Add-ons |
| Brave | Via Chrome build | Chrome Web Store |
| Safari | Future | App Store |

---

## Files to Modify in Onyx App

1. `src/App.tsx` - Add deep link handler
2. `src-tauri/tauri.conf.json` - Register URL scheme
3. `src-tauri/capabilities/default.json` - Verify deep-link permissions
