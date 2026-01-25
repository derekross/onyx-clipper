import browser from 'webextension-polyfill';
import type { Template, PageMetadata, MessageResponse } from '../types/types';
import { getTemplates, getSettings } from '../utils/storage';
import { compileTemplate, buildVariableContext, sanitizeFilename } from '../utils/template-compiler';
import { clipToOnyx, createAiHandler } from '../utils/onyx-api';
import { findMatchingTemplate } from '../background';

// DOM Elements
const loading = document.getElementById('loading')!;
const mainContent = document.getElementById('main-content')!;
const errorDiv = document.getElementById('error')!;
const successDiv = document.getElementById('success')!;

const pageTitle = document.getElementById('page-title')!;
const pageUrl = document.getElementById('page-url')!;
const templateSelect = document.getElementById('template-select') as HTMLSelectElement;
const savePath = document.getElementById('save-path') as HTMLInputElement;
const filename = document.getElementById('filename') as HTMLInputElement;
const preview = document.getElementById('preview')!;
const highlightsSection = document.getElementById('highlights-section')!;
const highlightCount = document.getElementById('highlight-count')!;
const includeHighlights = document.getElementById('include-highlights') as HTMLInputElement;

const clipBtn = document.getElementById('clip-btn') as HTMLButtonElement;
const settingsBtn = document.getElementById('settings-btn')!;
const togglePreview = document.getElementById('toggle-preview')!;
const toggleHighlighter = document.getElementById('toggle-highlighter')!;
const retryBtn = document.getElementById('retry-btn')!;
const errorMessage = document.getElementById('error-message')!;
const successMessage = document.getElementById('success-message')!;

// State
let templates: Template[] = [];
let pageContent: {
  metadata: PageMetadata;
  content: string;
  contentHtml: string;
  selection?: string;
  selectionHtml?: string;
  highlights: string;
  highlightCount: number;
} | null = null;
let currentTemplate: Template | null = null;
let compiledContent: { filename: string; content: string } | null = null;
let previewExpanded = false;

// Initialize
async function init() {
  try {
    // Load templates and settings
    templates = await getTemplates();
    const settings = await getSettings();
    
    // Populate template selector
    populateTemplates(templates, settings.defaultTemplateId);
    
    // Get page content
    await loadPageContent();
    
    // Set up event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Popup init error:', error);
    showError('Failed to initialize clipper');
  }
}

/**
 * Populate template selector
 */
function populateTemplates(templates: Template[], defaultId: string) {
  templateSelect.innerHTML = '';
  
  for (const template of templates) {
    const option = document.createElement('option');
    option.value = template.id;
    option.textContent = template.name;
    if (template.id === defaultId) {
      option.selected = true;
    }
    templateSelect.appendChild(option);
  }
}

/**
 * Load page content from content script
 */
async function loadPageContent() {
  try {
    showLoading();
    
    // Get active tab
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('No active tab');
    }
    
    // Request content from content script
    const response = await browser.tabs.sendMessage(tab.id, {
      action: 'getPageContent',
    }) as MessageResponse<typeof pageContent>;
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get page content');
    }
    
    pageContent = response.data;
    
    // Update UI
    pageTitle.textContent = pageContent.metadata.title || 'Untitled';
    pageUrl.textContent = new URL(pageContent.metadata.url).hostname;
    pageUrl.title = pageContent.metadata.url;
    
    // Find matching template based on URL
    const matchingTemplate = findMatchingTemplate(pageContent.metadata.url, templates);
    if (matchingTemplate) {
      templateSelect.value = matchingTemplate.id;
    }
    
    // Update highlights section
    if (pageContent.highlightCount > 0) {
      highlightsSection.style.display = 'block';
      highlightCount.textContent = `${pageContent.highlightCount} highlight${pageContent.highlightCount > 1 ? 's' : ''}`;
    }
    
    // Compile with current template
    await updateTemplate();
    
    showMain();
  } catch (error) {
    console.error('Failed to load page content:', error);
    showError(error instanceof Error ? error.message : 'Failed to load page content');
  }
}

/**
 * Update compiled content when template changes
 */
async function updateTemplate() {
  if (!pageContent) return;
  
  const templateId = templateSelect.value;
  currentTemplate = templates.find((t) => t.id === templateId) || templates[0];
  
  if (!currentTemplate) return;
  
  // Update save path
  savePath.value = currentTemplate.path;
  
  // Build variable context
  const context = buildVariableContext(
    pageContent.metadata,
    pageContent.content,
    pageContent.contentHtml,
    pageContent.selection,
    pageContent.selectionHtml,
    includeHighlights.checked ? pageContent.highlights : '',
    includeHighlights.checked ? pageContent.highlightCount : 0
  );
  
  // Compile template (without AI for preview - AI will run on clip)
  try {
    compiledContent = await compileTemplate(currentTemplate, context);
    
    // Update filename
    filename.value = compiledContent.filename;
    
    // Update preview
    updatePreview();
  } catch (error) {
    console.error('Template compilation error:', error);
    preview.textContent = 'Error compiling template';
  }
}

/**
 * Update preview display
 */
function updatePreview() {
  if (!compiledContent) return;
  
  const content = compiledContent.content;
  
  if (previewExpanded) {
    preview.textContent = content;
    preview.classList.add('expanded');
    togglePreview.textContent = 'Show less';
  } else {
    // Show truncated preview
    const lines = content.split('\n').slice(0, 10);
    preview.textContent = lines.join('\n') + (content.split('\n').length > 10 ? '\n...' : '');
    preview.classList.remove('expanded');
    togglePreview.textContent = 'Show full preview';
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Template change
  templateSelect.addEventListener('change', updateTemplate);
  
  // Include highlights change
  includeHighlights.addEventListener('change', updateTemplate);
  
  // Toggle preview
  togglePreview.addEventListener('click', () => {
    previewExpanded = !previewExpanded;
    updatePreview();
  });
  
  // Toggle highlighter
  toggleHighlighter.addEventListener('click', async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await browser.tabs.sendMessage(tab.id, { action: 'toggleHighlighter' });
      // Close popup so user can highlight
      window.close();
    }
  });
  
  // Settings button
  settingsBtn.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
  
  // Clip button
  clipBtn.addEventListener('click', handleClip);
  
  // Retry button
  retryBtn.addEventListener('click', () => {
    loadPageContent();
  });
  
  // Filename change
  filename.addEventListener('input', () => {
    if (compiledContent) {
      compiledContent.filename = sanitizeFilename(filename.value) + '.md';
    }
  });
  
  // Save path change
  savePath.addEventListener('input', () => {
    // Path will be used when clipping
  });
}

/**
 * Handle clip button click
 */
async function handleClip() {
  if (!pageContent || !currentTemplate || !compiledContent) return;
  
  try {
    clipBtn.disabled = true;
    clipBtn.innerHTML = '<span class="spinner small"></span> Clipping...';
    
    // Check if template has AI prompts
    const hasAiPrompts = currentTemplate.noteContentFormat.includes('{{prompt:');
    
    let finalContent = compiledContent.content;
    
    if (hasAiPrompts) {
      // Recompile with AI handler
      const context = buildVariableContext(
        pageContent.metadata,
        pageContent.content,
        pageContent.contentHtml,
        pageContent.selection,
        pageContent.selectionHtml,
        includeHighlights.checked ? pageContent.highlights : '',
        includeHighlights.checked ? pageContent.highlightCount : 0
      );
      
      const aiHandler = createAiHandler(60000);
      const compiled = await compileTemplate(currentTemplate, context, aiHandler);
      finalContent = compiled.content;
    }
    
    // Send to Onyx
    await clipToOnyx({
      title: pageContent.metadata.title || 'Untitled',
      path: savePath.value || 'Clippings',
      content: finalContent,
      filename: compiledContent.filename,
    });
    
    // Show success
    showSuccess(`Saved to ${savePath.value}/${compiledContent.filename}`);
    
    // Close popup after a delay
    setTimeout(() => {
      window.close();
    }, 1500);
  } catch (error) {
    console.error('Clip error:', error);
    showError(error instanceof Error ? error.message : 'Failed to clip to Onyx');
    
    clipBtn.disabled = false;
    clipBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      Add to Onyx
    `;
  }
}

// View helpers
function showLoading() {
  loading.style.display = 'flex';
  mainContent.style.display = 'none';
  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';
}

function showMain() {
  loading.style.display = 'none';
  mainContent.style.display = 'block';
  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';
}

function showError(message: string) {
  loading.style.display = 'none';
  mainContent.style.display = 'none';
  errorDiv.style.display = 'flex';
  successDiv.style.display = 'none';
  errorMessage.textContent = message;
}

function showSuccess(message: string) {
  loading.style.display = 'none';
  mainContent.style.display = 'none';
  errorDiv.style.display = 'none';
  successDiv.style.display = 'flex';
  successMessage.textContent = message;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
