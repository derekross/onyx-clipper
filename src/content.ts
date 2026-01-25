import browser from 'webextension-polyfill';
import type { Message, MessageResponse, Highlight, PageHighlights } from './types/types';
import { extractPageContent, extractMetadata, getSelection } from './utils/content-extractor';
import { htmlToMarkdown } from './utils/markdown-converter';
import { getHighlights, saveHighlights, clearHighlights, getSettings } from './utils/storage';

// State
let highlighterMode = false;
let highlights: Highlight[] = [];
let highlightOverlays: Map<string, HTMLElement> = new Map();

// Initialize
async function init() {
  // Load existing highlights for this page
  const pageHighlights = await getHighlights(window.location.href);
  if (pageHighlights) {
    highlights = pageHighlights.highlights;
    
    // Check if we should show highlights on load
    const settings = await getSettings();
    if (settings.showHighlightsOnLoad) {
      renderHighlights();
    }
  }
  
  // Set up message listener
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser.runtime.onMessage.addListener((msg: any) => handleMessage(msg as Message));
  
  // Set up selection listener for highlighter mode
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Handle messages from background script and popup
 */
async function handleMessage(message: Message): Promise<MessageResponse> {
  try {
    switch (message.action) {
      case 'ping':
        return { success: true };

      case 'getPageContent':
        return await handleGetPageContent();

      case 'getSelection':
        return handleGetSelection();

      case 'getHighlights':
        return { success: true, data: highlights };

      case 'addHighlight':
        return await handleAddHighlight(message.data as { fromSelection?: boolean });

      case 'removeHighlight':
        return await handleRemoveHighlight(message.data as { id: string });

      case 'clearHighlights':
        return await handleClearHighlights();

      case 'toggleHighlighter':
        highlighterMode = !highlighterMode;
        updateHighlighterCursor();
        return { success: true, data: { active: highlighterMode } };

      case 'setHighlighterMode':
        highlighterMode = (message.data as { isActive: boolean }).isActive;
        updateHighlighterCursor();
        return { success: true };

      default:
        return { success: false, error: `Unknown action: ${message.action}` };
    }
  } catch (error) {
    console.error('Content script message handler error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get page content and metadata
 */
async function handleGetPageContent(): Promise<MessageResponse> {
  try {
    const pageContent = await extractPageContent();
    
    // Convert HTML content to Markdown
    const markdownContent = htmlToMarkdown(pageContent.contentHtml, window.location.href);
    const markdownSelection = pageContent.selectionHtml 
      ? htmlToMarkdown(pageContent.selectionHtml, window.location.href)
      : '';
    
    // Format highlights as Markdown
    const highlightsMarkdown = highlights.map((h) => {
      let md = `> ==${h.content}==`;
      if (h.notes && h.notes.length > 0) {
        md += '\n>\n> ' + h.notes.join('\n> ');
      }
      return md;
    }).join('\n\n');
    
    return {
      success: true,
      data: {
        metadata: pageContent.metadata,
        content: markdownContent,
        contentHtml: pageContent.contentHtml,
        selection: markdownSelection,
        selectionHtml: pageContent.selectionHtml,
        highlights: highlightsMarkdown,
        highlightCount: highlights.length,
      },
    };
  } catch (error) {
    console.error('Failed to get page content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract content',
    };
  }
}

/**
 * Get current selection
 */
function handleGetSelection(): MessageResponse {
  const selection = getSelection();
  if (!selection) {
    return { success: true, data: null };
  }
  
  const markdown = htmlToMarkdown(selection.html, window.location.href);
  return {
    success: true,
    data: {
      text: selection.text,
      html: selection.html,
      markdown,
    },
  };
}

/**
 * Add a highlight from current selection
 */
async function handleAddHighlight(data?: { fromSelection?: boolean }): Promise<MessageResponse> {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    return { success: false, error: 'No text selected' };
  }
  
  const range = selection.getRangeAt(0);
  const content = selection.toString();
  
  if (!content.trim()) {
    return { success: false, error: 'Selection is empty' };
  }
  
  // Generate XPath for the selection
  const xpath = getXPath(range.startContainer);
  
  // Create highlight
  const highlight: Highlight = {
    id: generateHighlightId(),
    type: 'text',
    xpath,
    content: content,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    createdAt: Date.now(),
  };
  
  highlights.push(highlight);
  
  // Save to storage
  await savePageHighlights();
  
  // Render the highlight
  renderHighlight(highlight, range);
  
  // Clear selection
  selection.removeAllRanges();
  
  return { success: true, data: highlight };
}

/**
 * Remove a highlight by ID
 */
async function handleRemoveHighlight(data: { id: string }): Promise<MessageResponse> {
  const index = highlights.findIndex((h) => h.id === data.id);
  if (index === -1) {
    return { success: false, error: 'Highlight not found' };
  }
  
  highlights.splice(index, 1);
  
  // Remove overlay
  const overlay = highlightOverlays.get(data.id);
  if (overlay) {
    overlay.remove();
    highlightOverlays.delete(data.id);
  }
  
  // Save to storage
  await savePageHighlights();
  
  return { success: true };
}

/**
 * Clear all highlights on this page
 */
async function handleClearHighlights(): Promise<MessageResponse> {
  highlights = [];
  
  // Remove all overlays
  highlightOverlays.forEach((overlay) => overlay.remove());
  highlightOverlays.clear();
  
  // Clear from storage
  await clearHighlights(window.location.href);
  
  return { success: true };
}

/**
 * Save highlights to storage
 */
async function savePageHighlights(): Promise<void> {
  const pageHighlights: PageHighlights = {
    url: window.location.href,
    normalizedUrl: window.location.href,
    highlights,
    lastUpdated: Date.now(),
  };
  
  await saveHighlights(pageHighlights);
}

/**
 * Render all highlights
 */
function renderHighlights(): void {
  for (const highlight of highlights) {
    try {
      // Find the element using XPath
      const result = document.evaluate(
        highlight.xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      
      const node = result.singleNodeValue;
      if (!node) continue;
      
      // Create a range for the highlight
      const range = document.createRange();
      
      if (highlight.type === 'text' && highlight.startOffset !== undefined) {
        try {
          range.setStart(node, highlight.startOffset);
          range.setEnd(node, highlight.endOffset || highlight.startOffset + highlight.content.length);
        } catch {
          // If offsets don't work, try to find the text
          const textContent = node.textContent || '';
          const startIndex = textContent.indexOf(highlight.content);
          if (startIndex >= 0) {
            range.setStart(node, startIndex);
            range.setEnd(node, startIndex + highlight.content.length);
          } else {
            continue;
          }
        }
      } else {
        range.selectNodeContents(node);
      }
      
      renderHighlight(highlight, range);
    } catch (error) {
      console.error('Failed to render highlight:', error);
    }
  }
}

/**
 * Render a single highlight overlay
 */
function renderHighlight(highlight: Highlight, range: Range): void {
  const rects = range.getClientRects();
  if (rects.length === 0) return;
  
  // Create container for this highlight's overlays
  const container = document.createElement('div');
  container.className = 'onyx-highlight-container';
  container.dataset.highlightId = highlight.id;
  
  // Create overlay for each rect
  for (const rect of rects) {
    const overlay = document.createElement('div');
    overlay.className = `onyx-highlight onyx-highlight-${highlight.color || 'yellow'}`;
    overlay.style.position = 'absolute';
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    
    container.appendChild(overlay);
  }
  
  // Add click handler to remove highlight
  container.style.pointerEvents = 'auto';
  container.style.cursor = 'pointer';
  container.addEventListener('click', async (e) => {
    if (e.shiftKey) {
      // Shift+click to remove
      await handleRemoveHighlight({ id: highlight.id });
    }
  });
  
  document.body.appendChild(container);
  highlightOverlays.set(highlight.id, container);
}

/**
 * Handle mouse up for highlighter mode
 */
function handleMouseUp(e: MouseEvent): void {
  if (!highlighterMode) return;
  
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;
  
  // Add highlight
  handleAddHighlight({ fromSelection: true });
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyDown(e: KeyboardEvent): void {
  // Escape to exit highlighter mode
  if (e.key === 'Escape' && highlighterMode) {
    highlighterMode = false;
    updateHighlighterCursor();
  }
}

/**
 * Update cursor style for highlighter mode
 */
function updateHighlighterCursor(): void {
  if (highlighterMode) {
    document.body.style.cursor = 'crosshair';
    document.body.classList.add('onyx-highlighter-active');
  } else {
    document.body.style.cursor = '';
    document.body.classList.remove('onyx-highlighter-active');
  }
}

/**
 * Generate XPath for a node
 */
function getXPath(node: Node): string {
  if (node.nodeType === Node.DOCUMENT_NODE) {
    return '/';
  }
  
  const parts: string[] = [];
  let current: Node | null = node;
  
  while (current && current.nodeType !== Node.DOCUMENT_NODE) {
    let index = 1;
    let sibling = current.previousSibling;
    
    while (sibling) {
      if (sibling.nodeType === current.nodeType && sibling.nodeName === current.nodeName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    
    const nodeName = current.nodeName.toLowerCase();
    parts.unshift(`${nodeName}[${index}]`);
    current = current.parentNode;
  }
  
  return '/' + parts.join('/');
}

/**
 * Generate a unique highlight ID
 */
function generateHighlightId(): string {
  return `hl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
