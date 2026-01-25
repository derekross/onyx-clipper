import browser from 'webextension-polyfill';
import { initializeStorage, getTemplates, getSettings } from './utils/storage';
import type { Message, MessageResponse, Template } from './types/types';

// Initialize storage on extension install/update
browser.runtime.onInstalled.addListener(async () => {
  await initializeStorage();
  await setupContextMenu();
});

// Also initialize on startup
browser.runtime.onStartup.addListener(async () => {
  await initializeStorage();
  await setupContextMenu();
});

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (message: any, sender: any): Promise<MessageResponse> | undefined => {
    const msg = message as Message;
    return handleMessage(msg, sender);
  }
);

async function handleMessage(message: Message, sender: browser.Runtime.MessageSender): Promise<MessageResponse> {
  try {
    switch (message.action) {
      case 'getPageContent':
        // Forward to content script
        if (sender.tab?.id) {
          return await browser.tabs.sendMessage(sender.tab.id, message);
        }
        // Get active tab and send message
        const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          return await browser.tabs.sendMessage(activeTab.id, message);
        }
        return { success: false, error: 'No active tab' };

      case 'getSelection':
      case 'getHighlights':
      case 'addHighlight':
      case 'removeHighlight':
      case 'clearHighlights':
      case 'toggleHighlighter':
      case 'setHighlighterMode':
        // Forward to content script in active tab
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          return await browser.tabs.sendMessage(tab.id, message);
        }
        return { success: false, error: 'No active tab' };

      case 'openDeepLink':
        // Open a deep link URL from the background script
        // This avoids the popup closing and canceling the permission dialog
        const deepLinkData = message.data as { url: string };
        if (deepLinkData?.url) {
          await openDeepLink(deepLinkData.url);
          return { success: true };
        }
        return { success: false, error: 'No URL provided' };

      default:
        return { success: false, error: `Unknown action: ${message.action}` };
    }
  } catch (error) {
    console.error('Background message handler error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Open a deep link URL
 * Uses tabs.update to navigate the current tab temporarily, then navigates back
 * This triggers the OS "Open external app" dialog without popup issues
 */
async function openDeepLink(url: string): Promise<void> {
  // Get the active tab
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) {
    throw new Error('No active tab');
  }
  
  // Store the original URL
  const originalUrl = tab.url;
  
  // Navigate to the deep link - this will trigger the OS permission dialog
  await browser.tabs.update(tab.id, { url });
  
  // Wait a moment for the dialog to appear, then navigate back
  // The deep link will have been triggered by this point
  setTimeout(async () => {
    try {
      // Navigate back to the original page
      await browser.tabs.update(tab.id!, { url: originalUrl });
    } catch (e) {
      // Tab may have been closed or navigated elsewhere
      console.log('Could not restore original URL:', e);
    }
  }, 500);
}

// Handle keyboard commands
browser.commands.onCommand.addListener(async (command) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  switch (command) {
    case 'quick_clip':
      // Quick clip with default template
      await quickClip(tab.id);
      break;

    case 'toggle_highlighter':
      // Toggle highlighter mode
      await browser.tabs.sendMessage(tab.id, {
        action: 'toggleHighlighter',
      });
      break;
  }
});

// Handle context menu clicks
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  switch (info.menuItemId) {
    case 'clip-page':
      // Open popup (can't be done programmatically, so we'll use quick clip)
      await quickClip(tab.id);
      break;

    case 'clip-selection':
      await quickClipSelection(tab.id);
      break;

    case 'highlight-selection':
      await browser.tabs.sendMessage(tab.id, {
        action: 'addHighlight',
        data: { fromSelection: true },
      });
      break;
  }
});

/**
 * Set up context menu items
 */
async function setupContextMenu(): Promise<void> {
  // Remove existing items
  await browser.contextMenus.removeAll();

  const settings = await getSettings();
  if (!settings.enableContextMenu) return;

  // Add context menu items
  browser.contextMenus.create({
    id: 'clip-page',
    title: 'Clip page to Onyx',
    contexts: ['page'],
  });

  browser.contextMenus.create({
    id: 'clip-selection',
    title: 'Clip selection to Onyx',
    contexts: ['selection'],
  });

  browser.contextMenus.create({
    id: 'highlight-selection',
    title: 'Highlight selection',
    contexts: ['selection'],
  });
}

/**
 * Quick clip the current page with default template
 */
async function quickClip(tabId: number): Promise<void> {
  try {
    // Get page content from content script
    const response = await browser.tabs.sendMessage(tabId, {
      action: 'getPageContent',
    }) as MessageResponse<{ content: string; metadata: unknown }>;

    if (!response.success || !response.data) {
      console.error('Failed to get page content:', response.error);
      return;
    }

    // Get default template
    const settings = await getSettings();
    const templates = await getTemplates();
    const template = templates.find((t) => t.id === settings.defaultTemplateId) || templates[0];

    if (!template) {
      console.error('No template found');
      return;
    }

    // Send to Onyx
    // The actual clipping is done in the popup, so we'll open the popup
    // For now, just notify the user
    await browser.action.openPopup?.();
  } catch (error) {
    console.error('Quick clip failed:', error);
  }
}

/**
 * Quick clip the current selection
 */
async function quickClipSelection(tabId: number): Promise<void> {
  try {
    // Get selection from content script
    const response = await browser.tabs.sendMessage(tabId, {
      action: 'getSelection',
    }) as MessageResponse<{ text: string; html: string }>;

    if (!response.success || !response.data) {
      console.error('Failed to get selection:', response.error);
      return;
    }

    // Open popup with selection mode
    await browser.action.openPopup?.();
  } catch (error) {
    console.error('Quick clip selection failed:', error);
  }
}

/**
 * Find the best matching template for a URL
 */
export function findMatchingTemplate(url: string, templates: Template[]): Template | null {
  for (const template of templates) {
    if (!template.triggers || template.triggers.length === 0) continue;

    for (const trigger of template.triggers) {
      switch (trigger.type) {
        case 'url':
          if (url.startsWith(trigger.pattern)) {
            return template;
          }
          break;

        case 'regex':
          try {
            // Remove surrounding slashes and flags
            const match = trigger.pattern.match(/^\/(.+)\/([gimsuvy]*)$/);
            if (match) {
              const regex = new RegExp(match[1], match[2]);
              if (regex.test(url)) {
                return template;
              }
            }
          } catch {
            // Invalid regex, skip
          }
          break;

        case 'schema':
          // Schema matching would require access to page schema data
          // This is handled in the content script
          break;
      }
    }
  }

  return null;
}

// Export for testing
export { setupContextMenu, quickClip, quickClipSelection };
