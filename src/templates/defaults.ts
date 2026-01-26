import type { Template } from '../types/types';

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'article',
    name: 'Article',
    path: 'Clippings',
    noteNameFormat: '{{title}}',
    properties: [
      { name: 'title', value: '{{title}}', type: 'text' },
      { name: 'author', value: '{{author}}', type: 'text' },
      { name: 'published', value: '{{published}}', type: 'date' },
      { name: 'source', value: '{{url}}', type: 'text' },
      { name: 'clipped', value: '{{date:YYYY-MM-DDTHH:mm:ss}}', type: 'date' },
      { name: 'tags', value: 'clippings, articles', type: 'list' },
    ],
    noteContentFormat: `{{content}}`,
    triggers: [],
    isDefault: true,
  },
  {
    id: 'recipe',
    name: 'Recipe',
    path: 'Clippings/Recipes',
    noteNameFormat: '{{title}}',
    properties: [
      { name: 'title', value: '{{title}}', type: 'text' },
      { name: 'author', value: '{{author}}', type: 'text' },
      { name: 'source', value: '{{url}}', type: 'text' },
      { name: 'clipped', value: '{{date}}', type: 'date' },
      { name: 'tags', value: 'clippings, recipes', type: 'list' },
    ],
    noteContentFormat: `{{content}}`,
    triggers: [
      { type: 'regex', pattern: '/recipe|cooking|food|allrecipes|epicurious|seriouseats/i' },
      { type: 'schema', pattern: '@Recipe' },
    ],
    isDefault: true,
  },
  {
    id: 'highlight-only',
    name: 'Highlights Only',
    path: 'Clippings',
    noteNameFormat: '{{title}} - Highlights',
    properties: [
      { name: 'title', value: '{{title}}', type: 'text' },
      { name: 'source', value: '{{url}}', type: 'text' },
      { name: 'clipped', value: '{{date}}', type: 'date' },
      { name: 'tags', value: 'clippings, highlights', type: 'list' },
    ],
    noteContentFormat: `## Highlights from {{title}}

{{highlights}}

---

[Source]({{url}})`,
    triggers: [],
    isDefault: true,
  },
  {
    id: 'reference',
    name: 'Reference',
    path: 'Clippings/References',
    noteNameFormat: '{{title}}',
    properties: [
      { name: 'title', value: '{{title}}', type: 'text' },
      { name: 'type', value: 'reference', type: 'text' },
      { name: 'source', value: '{{url}}', type: 'text' },
      { name: 'clipped', value: '{{date}}', type: 'date' },
      { name: 'tags', value: 'clippings, references', type: 'list' },
    ],
    noteContentFormat: `> {{description}}

[Source]({{url}})`,
    triggers: [],
    isDefault: true,
  },
  {
    id: 'selection',
    name: 'Selection Only',
    path: 'Clippings',
    noteNameFormat: '{{title}} - Selection',
    properties: [
      { name: 'title', value: '{{title}}', type: 'text' },
      { name: 'source', value: '{{url}}', type: 'text' },
      { name: 'clipped', value: '{{date}}', type: 'date' },
      { name: 'tags', value: 'clippings', type: 'list' },
    ],
    noteContentFormat: `{{selection}}

---

[Source]({{url}})`,
    triggers: [],
    isDefault: true,
  },

  {
    id: 'github',
    name: 'GitHub Repository',
    path: 'Clippings/GitHub',
    noteNameFormat: '{{title}}',
    properties: [
      { name: 'title', value: '{{title}}', type: 'text' },
      { name: 'source', value: '{{url}}', type: 'text' },
      { name: 'clipped', value: '{{date}}', type: 'date' },
      { name: 'tags', value: 'clippings, github, code', type: 'list' },
    ],
    noteContentFormat: `## {{title}}

{{description}}

**Repository:** [{{url}}]({{url}})

---

{{content}}`,
    triggers: [
      { type: 'url', pattern: 'https://github.com/' },
    ],
    isDefault: true,
  },
  {
    id: 'youtube',
    name: 'YouTube Video',
    path: 'Clippings/Videos',
    noteNameFormat: '{{title}}',
    properties: [
      { name: 'title', value: '{{title}}', type: 'text' },
      { name: 'author', value: '{{author}}', type: 'text' },
      { name: 'source', value: '{{url}}', type: 'text' },
      { name: 'clipped', value: '{{date}}', type: 'date' },
      { name: 'tags', value: 'clippings, videos, youtube', type: 'list' },
    ],
    noteContentFormat: `## {{title}}

**Channel:** {{author}}

{{description}}

**Link:** [Watch on YouTube]({{url}})`,
    triggers: [
      { type: 'regex', pattern: '/youtube\\.com|youtu\\.be/i' },
    ],
    isDefault: true,
  },
];

export const DEFAULT_SETTINGS = {
  defaultTemplateId: 'article',
  defaultPath: 'Clippings',
  showHighlightsOnLoad: true,
  highlightColor: 'yellow' as const,
  enableContextMenu: true,
  enableKeyboardShortcuts: true,
};
