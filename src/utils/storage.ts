import browser from 'webextension-polyfill';
import type { Template, ClipperSettings, PageHighlights, StorageData } from '../types/types';
import { DEFAULT_TEMPLATES, DEFAULT_SETTINGS } from '../templates/defaults';

// Storage keys
const STORAGE_KEYS = {
  TEMPLATES: 'templates',
  SETTINGS: 'settings',
  HIGHLIGHTS: 'highlights',
} as const;

/**
 * Initialize storage with default values if not present
 */
export async function initializeStorage(): Promise<void> {
  const data = await browser.storage.local.get([
    STORAGE_KEYS.TEMPLATES,
    STORAGE_KEYS.SETTINGS,
  ]);
  
  // Initialize templates if not present
  if (!data[STORAGE_KEYS.TEMPLATES]) {
    await browser.storage.local.set({
      [STORAGE_KEYS.TEMPLATES]: DEFAULT_TEMPLATES,
    });
  }
  
  // Initialize settings if not present
  if (!data[STORAGE_KEYS.SETTINGS]) {
    await browser.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS,
    });
  }
}

// ============ Templates ============

/**
 * Get all templates
 */
export async function getTemplates(): Promise<Template[]> {
  const data = await browser.storage.local.get(STORAGE_KEYS.TEMPLATES) as Record<string, Template[]>;
  return data[STORAGE_KEYS.TEMPLATES] || DEFAULT_TEMPLATES;
}

/**
 * Get a template by ID
 */
export async function getTemplate(id: string): Promise<Template | null> {
  const templates = await getTemplates();
  return templates.find((t) => t.id === id) || null;
}

/**
 * Save a template (add or update)
 */
export async function saveTemplate(template: Template): Promise<void> {
  const templates = await getTemplates();
  const index = templates.findIndex((t) => t.id === template.id);
  
  if (index >= 0) {
    templates[index] = template;
  } else {
    templates.push(template);
  }
  
  await browser.storage.local.set({
    [STORAGE_KEYS.TEMPLATES]: templates,
  });
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  
  await browser.storage.local.set({
    [STORAGE_KEYS.TEMPLATES]: filtered,
  });
}

/**
 * Reset templates to defaults
 */
export async function resetTemplates(): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.TEMPLATES]: DEFAULT_TEMPLATES,
  });
}

// ============ Settings ============

/**
 * Get settings
 */
export async function getSettings(): Promise<ClipperSettings> {
  const data = await browser.storage.local.get(STORAGE_KEYS.SETTINGS) as Record<string, ClipperSettings | undefined>;
  const stored = data[STORAGE_KEYS.SETTINGS];
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

/**
 * Save settings
 */
export async function saveSettings(settings: Partial<ClipperSettings>): Promise<void> {
  const current = await getSettings();
  await browser.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },
  });
}

// ============ Highlights ============

/**
 * Normalize a URL for storage (remove hash, normalize query params)
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove hash
    parsed.hash = '';
    // Sort query params for consistency
    const params = new URLSearchParams(parsed.search);
    const sortedParams = new URLSearchParams([...params].sort());
    parsed.search = sortedParams.toString();
    return parsed.toString();
  } catch {
    return url;
  }
}

type HighlightsStorage = Record<string, PageHighlights>;

/**
 * Get highlights for a URL
 */
export async function getHighlights(url: string): Promise<PageHighlights | null> {
  const normalizedUrl = normalizeUrl(url);
  const data = await browser.storage.local.get(STORAGE_KEYS.HIGHLIGHTS) as Record<string, HighlightsStorage | undefined>;
  const allHighlights: HighlightsStorage = data[STORAGE_KEYS.HIGHLIGHTS] || {};
  return allHighlights[normalizedUrl] || null;
}

/**
 * Save highlights for a URL
 */
export async function saveHighlights(highlights: PageHighlights): Promise<void> {
  const normalizedUrl = normalizeUrl(highlights.url);
  const data = await browser.storage.local.get(STORAGE_KEYS.HIGHLIGHTS) as Record<string, HighlightsStorage | undefined>;
  const allHighlights: HighlightsStorage = data[STORAGE_KEYS.HIGHLIGHTS] || {};
  
  allHighlights[normalizedUrl] = {
    ...highlights,
    normalizedUrl,
    lastUpdated: Date.now(),
  };
  
  await browser.storage.local.set({
    [STORAGE_KEYS.HIGHLIGHTS]: allHighlights,
  });
}

/**
 * Clear highlights for a URL
 */
export async function clearHighlights(url: string): Promise<void> {
  const normalizedUrl = normalizeUrl(url);
  const data = await browser.storage.local.get(STORAGE_KEYS.HIGHLIGHTS) as Record<string, HighlightsStorage | undefined>;
  const allHighlights: HighlightsStorage = data[STORAGE_KEYS.HIGHLIGHTS] || {};
  
  delete allHighlights[normalizedUrl];
  
  await browser.storage.local.set({
    [STORAGE_KEYS.HIGHLIGHTS]: allHighlights,
  });
}

/**
 * Get all highlights
 */
export async function getAllHighlights(): Promise<Record<string, PageHighlights>> {
  const data = await browser.storage.local.get(STORAGE_KEYS.HIGHLIGHTS) as Record<string, HighlightsStorage | undefined>;
  return data[STORAGE_KEYS.HIGHLIGHTS] || {};
}

/**
 * Clear all highlights
 */
export async function clearAllHighlights(): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.HIGHLIGHTS]: {},
  });
}

// ============ Import/Export ============

/**
 * Export all data for backup
 */
export async function exportData(): Promise<StorageData> {
  const [templates, settings, highlights] = await Promise.all([
    getTemplates(),
    getSettings(),
    getAllHighlights(),
  ]);
  
  return { templates, settings, highlights };
}

/**
 * Import data from backup
 */
export async function importData(data: Partial<StorageData>): Promise<void> {
  if (data.templates) {
    await browser.storage.local.set({
      [STORAGE_KEYS.TEMPLATES]: data.templates,
    });
  }
  
  if (data.settings) {
    await browser.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: data.settings,
    });
  }
  
  if (data.highlights) {
    await browser.storage.local.set({
      [STORAGE_KEYS.HIGHLIGHTS]: data.highlights,
    });
  }
}
