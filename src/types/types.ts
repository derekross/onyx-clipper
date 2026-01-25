// Page metadata extracted from web pages
export interface PageMetadata {
  title: string;
  url: string;
  author?: string;
  description?: string;
  published?: string;
  siteName?: string;
  favicon?: string;
  image?: string;
  wordCount?: number;
  schemaOrg?: Record<string, unknown>;
}

// Page content extracted and converted
export interface PageContent {
  metadata: PageMetadata;
  content: string;        // Main content as Markdown
  contentHtml: string;    // Main content as HTML (sanitized)
  selection?: string;     // Selected text as Markdown
  selectionHtml?: string; // Selected text as HTML
}

// Template system
export interface Template {
  id: string;
  name: string;
  path: string;                 // Save location, default "Clippings"
  noteNameFormat: string;       // e.g., "{{title}}"
  noteContentFormat: string;    // Markdown template body
  properties: PropertyField[];  // Frontmatter fields
  triggers?: TemplateTrigger[]; // URL patterns for auto-select
  context?: string;             // Context for AI prompts
  isDefault?: boolean;          // Is this a built-in template
  isCustom?: boolean;           // Was this created by user
}

export interface PropertyField {
  name: string;
  value: string;                // Can include variables
  type: 'text' | 'date' | 'list' | 'checkbox' | 'number';
}

export interface TemplateTrigger {
  type: 'url' | 'regex' | 'schema';
  pattern: string;
}

// Highlighting system
export interface Highlight {
  id: string;
  type: 'text' | 'element';
  xpath: string;
  content: string;              // The highlighted text
  contentHtml?: string;         // HTML version
  startOffset?: number;
  endOffset?: number;
  notes?: string[];
  color?: HighlightColor;
  createdAt: number;
  updatedAt?: number;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

export interface PageHighlights {
  url: string;
  normalizedUrl: string;        // URL without hash/query for matching
  highlights: Highlight[];
  lastUpdated: number;
}

// Storage types
export interface StorageData {
  templates: Template[];
  settings: ClipperSettings;
  highlights: Record<string, PageHighlights>; // Keyed by normalized URL
}

export interface ClipperSettings {
  defaultTemplateId: string;
  defaultPath: string;
  showHighlightsOnLoad: boolean;
  highlightColor: HighlightColor;
  enableContextMenu: boolean;
  enableKeyboardShortcuts: boolean;
}

// Message passing between background, content, and popup
export type MessageAction =
  | 'getPageContent'
  | 'getSelection'
  | 'getHighlights'
  | 'addHighlight'
  | 'removeHighlight'
  | 'clearHighlights'
  | 'toggleHighlighter'
  | 'setHighlighterMode'
  | 'ping'
  | 'clipToOnyx'
  | 'requestAi';

export interface Message {
  action: MessageAction;
  data?: unknown;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Onyx communication
export interface ClipRequest {
  title: string;
  path: string;
  content: string;
  filename?: string;
}

export interface AiRequest {
  prompt: string;
  context: string;
  callbackId: string;
}

export interface AiResponse {
  callbackId: string;
  result: string;
  error?: string;
}

// Template variable context
export interface VariableContext {
  // Page data
  title: string;
  url: string;
  domain: string;
  author: string;
  published: string;
  description: string;
  content: string;
  contentHtml: string;
  selection: string;
  selectionHtml: string;
  
  // Highlights
  highlights: string;
  highlightCount: number;
  
  // Date/time
  date: string;
  time: string;
  
  // Schema.org data (if available)
  schema?: Record<string, unknown>;
}
