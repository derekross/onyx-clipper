import browser from 'webextension-polyfill';
import type { Template, ClipperSettings } from '../types/types';
import {
  getTemplates,
  getSettings,
  saveSettings,
  saveTemplate,
  deleteTemplate,
  resetTemplates,
  exportData,
  importData,
  clearAllHighlights,
} from '../utils/storage';
import { DEFAULT_TEMPLATES } from '../templates/defaults';

// DOM Elements
const defaultTemplateSelect = document.getElementById('default-template') as HTMLSelectElement;
const defaultPathInput = document.getElementById('default-path') as HTMLInputElement;
const enableContextMenu = document.getElementById('enable-context-menu') as HTMLInputElement;
const enableShortcuts = document.getElementById('enable-shortcuts') as HTMLInputElement;
const highlightColorSelect = document.getElementById('highlight-color') as HTMLSelectElement;
const showHighlightsOnLoad = document.getElementById('show-highlights-on-load') as HTMLInputElement;
const templatesList = document.getElementById('templates-list')!;
const addTemplateBtn = document.getElementById('add-template')!;
const resetTemplatesBtn = document.getElementById('reset-templates')!;
const exportDataBtn = document.getElementById('export-data')!;
const importDataBtn = document.getElementById('import-data')!;
const importFileInput = document.getElementById('import-file') as HTMLInputElement;
const clearHighlightsBtn = document.getElementById('clear-highlights')!;

// Modal elements
const templateModal = document.getElementById('template-modal')!;
const modalTitle = document.getElementById('modal-title')!;
const closeModalBtn = document.getElementById('close-modal')!;
const templateNameInput = document.getElementById('template-name') as HTMLInputElement;
const templatePathInput = document.getElementById('template-path') as HTMLInputElement;
const templateFilenameInput = document.getElementById('template-filename') as HTMLInputElement;
const templateContentInput = document.getElementById('template-content') as HTMLTextAreaElement;
const deleteTemplateBtn = document.getElementById('delete-template')!;
const cancelTemplateBtn = document.getElementById('cancel-template')!;
const saveTemplateBtn = document.getElementById('save-template')!;

// State
let templates: Template[] = [];
let settings: ClipperSettings;
let editingTemplate: Template | null = null;

// Initialize
async function init() {
  try {
    // Load data
    templates = await getTemplates();
    settings = await getSettings();
    
    // Populate UI
    populateSettings();
    populateTemplates();
    
    // Set up event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Settings init error:', error);
  }
}

/**
 * Populate settings UI with current values
 */
function populateSettings() {
  // Default template
  defaultTemplateSelect.innerHTML = '';
  for (const template of templates) {
    const option = document.createElement('option');
    option.value = template.id;
    option.textContent = template.name;
    if (template.id === settings.defaultTemplateId) {
      option.selected = true;
    }
    defaultTemplateSelect.appendChild(option);
  }
  
  // Other settings
  defaultPathInput.value = settings.defaultPath;
  enableContextMenu.checked = settings.enableContextMenu;
  enableShortcuts.checked = settings.enableKeyboardShortcuts;
  highlightColorSelect.value = settings.highlightColor;
  showHighlightsOnLoad.checked = settings.showHighlightsOnLoad;
}

/**
 * Populate templates list
 */
function populateTemplates() {
  templatesList.innerHTML = '';
  
  for (const template of templates) {
    const item = document.createElement('div');
    item.className = 'template-item';
    item.innerHTML = `
      <div class="template-info">
        <span class="template-name">${escapeHtml(template.name)}</span>
        ${template.isDefault ? '<span class="template-badge">Default</span>' : ''}
        ${template.isCustom ? '<span class="template-badge custom">Custom</span>' : ''}
      </div>
      <button class="icon-btn edit-template" data-id="${template.id}" title="Edit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
    `;
    
    templatesList.appendChild(item);
  }
  
  // Add click handlers for edit buttons
  templatesList.querySelectorAll('.edit-template').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).dataset.id;
      const template = templates.find((t) => t.id === id);
      if (template) {
        openTemplateModal(template);
      }
    });
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Settings changes
  defaultTemplateSelect.addEventListener('change', async () => {
    await saveSettings({ defaultTemplateId: defaultTemplateSelect.value });
  });
  
  defaultPathInput.addEventListener('change', async () => {
    await saveSettings({ defaultPath: defaultPathInput.value });
  });
  
  enableContextMenu.addEventListener('change', async () => {
    await saveSettings({ enableContextMenu: enableContextMenu.checked });
  });
  
  enableShortcuts.addEventListener('change', async () => {
    await saveSettings({ enableKeyboardShortcuts: enableShortcuts.checked });
  });
  
  highlightColorSelect.addEventListener('change', async () => {
    await saveSettings({ highlightColor: highlightColorSelect.value as ClipperSettings['highlightColor'] });
  });
  
  showHighlightsOnLoad.addEventListener('change', async () => {
    await saveSettings({ showHighlightsOnLoad: showHighlightsOnLoad.checked });
  });
  
  // Template actions
  addTemplateBtn.addEventListener('click', () => openTemplateModal(null));
  
  resetTemplatesBtn.addEventListener('click', async () => {
    if (confirm('This will reset all templates to their default values. Custom templates will be preserved. Continue?')) {
      await resetTemplates();
      templates = await getTemplates();
      populateTemplates();
      populateSettings();
    }
  });
  
  // Data actions
  exportDataBtn.addEventListener('click', async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `onyx-clipper-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  });
  
  importDataBtn.addEventListener('click', () => {
    importFileInput.click();
  });
  
  importFileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importData(data);
      
      // Reload
      templates = await getTemplates();
      settings = await getSettings();
      populateSettings();
      populateTemplates();
      
      alert('Settings imported successfully!');
    } catch (error) {
      alert('Failed to import settings. Please check the file format.');
    }
    
    // Reset file input
    importFileInput.value = '';
  });
  
  clearHighlightsBtn.addEventListener('click', async () => {
    if (confirm('This will delete all saved highlights from all pages. This cannot be undone. Continue?')) {
      await clearAllHighlights();
      alert('All highlights have been cleared.');
    }
  });
  
  // Modal actions
  closeModalBtn.addEventListener('click', closeTemplateModal);
  cancelTemplateBtn.addEventListener('click', closeTemplateModal);
  saveTemplateBtn.addEventListener('click', handleSaveTemplate);
  deleteTemplateBtn.addEventListener('click', handleDeleteTemplate);
  
  // Close modal on backdrop click
  templateModal.addEventListener('click', (e) => {
    if (e.target === templateModal) {
      closeTemplateModal();
    }
  });
  
  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && templateModal.style.display !== 'none') {
      closeTemplateModal();
    }
  });
}

/**
 * Open template modal for editing or creating
 */
function openTemplateModal(template: Template | null) {
  editingTemplate = template;
  
  if (template) {
    modalTitle.textContent = 'Edit Template';
    templateNameInput.value = template.name;
    templatePathInput.value = template.path;
    templateFilenameInput.value = template.noteNameFormat;
    templateContentInput.value = template.noteContentFormat;
    deleteTemplateBtn.style.display = template.isDefault ? 'none' : 'block';
  } else {
    modalTitle.textContent = 'New Template';
    templateNameInput.value = '';
    templatePathInput.value = 'Clippings';
    templateFilenameInput.value = '{{title}}';
    templateContentInput.value = '{{content}}';
    deleteTemplateBtn.style.display = 'none';
  }
  
  templateModal.style.display = 'flex';
  templateNameInput.focus();
}

/**
 * Close template modal
 */
function closeTemplateModal() {
  templateModal.style.display = 'none';
  editingTemplate = null;
}

/**
 * Handle save template
 */
async function handleSaveTemplate() {
  const name = templateNameInput.value.trim();
  if (!name) {
    alert('Please enter a template name');
    return;
  }
  
  const template: Template = {
    id: editingTemplate?.id || `custom-${Date.now()}`,
    name,
    path: templatePathInput.value.trim() || 'Clippings',
    noteNameFormat: templateFilenameInput.value.trim() || '{{title}}',
    noteContentFormat: templateContentInput.value,
    properties: editingTemplate?.properties || [
      { name: 'title', value: '{{title}}', type: 'text' },
      { name: 'source', value: '{{url}}', type: 'text' },
      { name: 'clipped', value: '{{date}}', type: 'date' },
    ],
    isDefault: editingTemplate?.isDefault || false,
    isCustom: !editingTemplate?.isDefault,
  };
  
  await saveTemplate(template);
  
  // Reload templates
  templates = await getTemplates();
  populateTemplates();
  populateSettings();
  
  closeTemplateModal();
}

/**
 * Handle delete template
 */
async function handleDeleteTemplate() {
  if (!editingTemplate || editingTemplate.isDefault) return;
  
  if (confirm(`Delete "${editingTemplate.name}" template?`)) {
    await deleteTemplate(editingTemplate.id);
    
    // Reload templates
    templates = await getTemplates();
    populateTemplates();
    populateSettings();
    
    closeTemplateModal();
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
