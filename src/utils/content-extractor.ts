import type { PageMetadata, PageContent } from '../types/types';

/**
 * Extract main content and metadata from a web page
 * Uses Defuddle for content extraction when available,
 * falls back to manual extraction
 */
export async function extractPageContent(): Promise<PageContent> {
  const metadata = extractMetadata();
  
  // Try to use Defuddle for content extraction
  let content = '';
  let contentHtml = '';
  
  try {
    // Dynamic import of defuddle (it may not be available in content script)
    const { Defuddle } = await import('defuddle');
    const result = new Defuddle(document, { url: document.URL }).parse();
    
    content = result.content || '';
    contentHtml = result.content || '';
    
    // Update metadata from Defuddle results
    if (result.title) metadata.title = result.title;
    if (result.author) metadata.author = result.author;
    if (result.description) metadata.description = result.description;
    if (result.published) metadata.published = result.published;
    if (result.siteName) metadata.siteName = result.siteName;
    if (result.image) metadata.image = result.image;
    if (result.wordCount) metadata.wordCount = result.wordCount;
    if (result.schemaOrgData) metadata.schemaOrg = result.schemaOrgData as Record<string, unknown>;
  } catch {
    // Fallback to manual content extraction
    const article = document.querySelector('article');
    const main = document.querySelector('main');
    const contentElement = article || main || document.body;
    
    contentHtml = cleanHtml(contentElement.innerHTML);
    content = contentHtml; // Will be converted to Markdown later
  }
  
  // Get selection if any
  const selection = window.getSelection();
  let selectionText = '';
  let selectionHtml = '';
  
  if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
    selectionText = selection.toString();
    
    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    selectionHtml = container.innerHTML;
  }
  
  return {
    metadata,
    content,
    contentHtml,
    selection: selectionText,
    selectionHtml,
  };
}

/**
 * Extract metadata from the page
 */
export function extractMetadata(): PageMetadata {
  const metadata: PageMetadata = {
    title: '',
    url: document.URL,
  };
  
  // Title extraction (in order of preference)
  metadata.title = 
    getMetaContent('og:title') ||
    getMetaContent('twitter:title') ||
    document.querySelector('h1')?.textContent?.trim() ||
    document.title ||
    '';
  
  // Author
  metadata.author = 
    getMetaContent('author') ||
    getMetaContent('article:author') ||
    getMetaContent('twitter:creator') ||
    document.querySelector('[rel="author"]')?.textContent?.trim() ||
    document.querySelector('.author')?.textContent?.trim() ||
    '';
  
  // Description
  metadata.description = 
    getMetaContent('og:description') ||
    getMetaContent('twitter:description') ||
    getMetaContent('description') ||
    '';
  
  // Published date
  metadata.published = 
    getMetaContent('article:published_time') ||
    getMetaContent('datePublished') ||
    document.querySelector('time')?.getAttribute('datetime') ||
    '';
  
  // Site name
  metadata.siteName = 
    getMetaContent('og:site_name') ||
    new URL(document.URL).hostname ||
    '';
  
  // Favicon
  const faviconLink = document.querySelector('link[rel="icon"]') ||
    document.querySelector('link[rel="shortcut icon"]');
  metadata.favicon = faviconLink?.getAttribute('href') || '/favicon.ico';
  if (metadata.favicon && !metadata.favicon.startsWith('http')) {
    metadata.favicon = new URL(metadata.favicon, document.URL).href;
  }
  
  // Featured image
  metadata.image = 
    getMetaContent('og:image') ||
    getMetaContent('twitter:image') ||
    '';
  
  // Extract Schema.org data
  const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
  if (schemaScripts.length > 0) {
    try {
      const schemaData: Record<string, unknown>[] = [];
      schemaScripts.forEach((script) => {
        try {
          const data = JSON.parse(script.textContent || '');
          schemaData.push(data);
        } catch {
          // Ignore invalid JSON
        }
      });
      if (schemaData.length > 0) {
        metadata.schemaOrg = schemaData.length === 1 ? schemaData[0] : { items: schemaData };
      }
    } catch {
      // Ignore schema parsing errors
    }
  }
  
  return metadata;
}

/**
 * Get content from a meta tag
 */
function getMetaContent(name: string): string {
  const meta = document.querySelector(
    `meta[property="${name}"], meta[name="${name}"]`
  );
  return meta?.getAttribute('content')?.trim() || '';
}

/**
 * Clean HTML by removing scripts, styles, and other non-content elements
 */
function cleanHtml(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  
  // Remove unwanted elements
  const selectorsToRemove = [
    'script',
    'style',
    'noscript',
    'iframe',
    'nav',
    'footer',
    'header',
    'aside',
    '.ad',
    '.ads',
    '.advertisement',
    '.social-share',
    '.comments',
    '.related-posts',
    '[role="complementary"]',
    '[role="navigation"]',
  ];
  
  selectorsToRemove.forEach((selector) => {
    container.querySelectorAll(selector).forEach((el) => el.remove());
  });
  
  return container.innerHTML;
}

/**
 * Get just the selected text/HTML from the page
 */
export function getSelection(): { text: string; html: string } | null {
  const selection = window.getSelection();
  
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  
  const text = selection.toString();
  
  const range = selection.getRangeAt(0);
  const container = document.createElement('div');
  container.appendChild(range.cloneContents());
  const html = container.innerHTML;
  
  return { text, html };
}

/**
 * Get the domain from the current URL
 */
export function getDomain(): string {
  try {
    return new URL(document.URL).hostname;
  } catch {
    return '';
  }
}
