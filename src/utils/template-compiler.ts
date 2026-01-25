import dayjs from 'dayjs';
import type { Template, VariableContext, PropertyField } from '../types/types';
import { htmlToMarkdown, generateFrontmatter, escapeYaml } from './markdown-converter';

/**
 * Compile a template with the given variable context
 * Returns the complete note content with frontmatter
 */
export async function compileTemplate(
  template: Template,
  context: VariableContext,
  aiHandler?: (prompt: string, pageContext: string) => Promise<string>
): Promise<{ filename: string; content: string }> {
  // Compile the filename
  const filename = sanitizeFilename(
    await interpolateVariables(template.noteNameFormat, context, aiHandler)
  );
  
  // Compile frontmatter properties
  const properties: Record<string, string | string[]> = {};
  for (const prop of template.properties) {
    const value = await interpolateVariables(prop.value, context, aiHandler);
    
    if (prop.type === 'list') {
      // Parse comma-separated list
      properties[prop.name] = value.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      properties[prop.name] = value;
    }
  }
  
  // Generate frontmatter
  const frontmatter = generateFrontmatter(properties);
  
  // Compile note content
  const noteContent = await interpolateVariables(
    template.noteContentFormat,
    context,
    aiHandler,
    template.context
  );
  
  // Combine frontmatter and content
  const content = `${frontmatter}\n\n${noteContent}`;
  
  return { filename: `${filename}.md`, content };
}

/**
 * Interpolate variables in a template string
 * Supports: {{variable}}, {{variable:format}}, {{prompt:"..."}}
 */
async function interpolateVariables(
  template: string,
  context: VariableContext,
  aiHandler?: (prompt: string, pageContext: string) => Promise<string>,
  templateContext?: string
): Promise<string> {
  // Match all variable patterns
  const variablePattern = /\{\{([^}]+)\}\}/g;
  
  // Find all matches first (we need to handle async replacements)
  const matches: Array<{ full: string; inner: string }> = [];
  let match;
  while ((match = variablePattern.exec(template)) !== null) {
    matches.push({ full: match[0], inner: match[1] });
  }
  
  // Process each match
  let result = template;
  for (const { full, inner } of matches) {
    const replacement = await resolveVariable(inner, context, aiHandler, templateContext);
    result = result.replace(full, replacement);
  }
  
  return result;
}

/**
 * Resolve a single variable
 */
async function resolveVariable(
  variable: string,
  context: VariableContext,
  aiHandler?: (prompt: string, pageContext: string) => Promise<string>,
  templateContext?: string
): Promise<string> {
  const trimmed = variable.trim();
  
  // Handle AI prompts: {{prompt:"..."}}
  if (trimmed.startsWith('prompt:')) {
    const promptMatch = trimmed.match(/^prompt:\s*["'](.+)["']$/s);
    if (promptMatch && aiHandler) {
      const prompt = promptMatch[1];
      const pageContext = templateContext 
        ? `${templateContext}\n\nPage content:\n${context.content}`
        : context.content;
      
      try {
        return await aiHandler(prompt, pageContext);
      } catch (error) {
        console.error('AI prompt failed:', error);
        return `[AI generation failed: ${prompt}]`;
      }
    }
    return '[AI not available]';
  }
  
  // Handle date formatting: {{date:FORMAT}} or {{published:FORMAT}}
  const dateFormatMatch = trimmed.match(/^(date|time|published):(.+)$/);
  if (dateFormatMatch) {
    const [, field, format] = dateFormatMatch;
    let dateValue: string;
    
    if (field === 'date' || field === 'time') {
      dateValue = dayjs().format(format);
    } else if (field === 'published' && context.published) {
      dateValue = dayjs(context.published).format(format);
    } else {
      dateValue = '';
    }
    
    return dateValue;
  }
  
  // Handle filters: {{variable|filter1|filter2}}
  const filterMatch = trimmed.match(/^([^|]+)(\|.+)$/);
  if (filterMatch) {
    const [, varName, filterChain] = filterMatch;
    let value = getContextValue(varName.trim(), context);
    
    // Apply filters
    const filters = filterChain.split('|').filter(Boolean);
    for (const filter of filters) {
      value = applyFilter(value, filter.trim());
    }
    
    return value;
  }
  
  // Simple variable lookup
  return getContextValue(trimmed, context);
}

/**
 * Get a value from the context by variable name
 */
function getContextValue(name: string, context: VariableContext): string {
  switch (name) {
    case 'title':
      return context.title || '';
    case 'url':
      return context.url || '';
    case 'domain':
      return context.domain || '';
    case 'author':
      return context.author || '';
    case 'published':
      return context.published || '';
    case 'description':
      return context.description || '';
    case 'content':
      return context.content || '';
    case 'contentHtml':
      return context.contentHtml || '';
    case 'selection':
      return context.selection || '';
    case 'selectionHtml':
      return context.selectionHtml || '';
    case 'highlights':
      return context.highlights || '';
    case 'highlightCount':
      return String(context.highlightCount || 0);
    case 'date':
      return dayjs().format('YYYY-MM-DD');
    case 'time':
      return dayjs().format('HH:mm:ss');
    default:
      // Check for schema.org data: schema:@Type.field
      if (name.startsWith('schema:') && context.schema) {
        return resolveSchemaValue(name.substring(7), context.schema);
      }
      return '';
  }
}

/**
 * Resolve a schema.org value
 * Format: @Type.field or @Type[index].field
 */
function resolveSchemaValue(path: string, schema: Record<string, unknown>): string {
  // Simple implementation - can be expanded
  try {
    const parts = path.split('.');
    let current: unknown = schema;
    
    for (const part of parts) {
      if (current === null || current === undefined) return '';
      
      // Handle array indexing
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = (current as Record<string, unknown>)[key.replace('@', '')];
        if (Array.isArray(current)) {
          current = current[parseInt(index, 10)];
        }
      } else {
        current = (current as Record<string, unknown>)[part.replace('@', '')];
      }
    }
    
    if (typeof current === 'string') return current;
    if (typeof current === 'number') return String(current);
    if (current === null || current === undefined) return '';
    return JSON.stringify(current);
  } catch {
    return '';
  }
}

/**
 * Apply a filter to a value
 */
function applyFilter(value: string, filter: string): string {
  // Parse filter with arguments: filter:arg1,arg2
  const [filterName, ...args] = filter.split(':');
  const filterArgs = args.join(':').split(',').map((s) => s.trim());
  
  switch (filterName) {
    case 'trim':
      return value.trim();
    
    case 'lower':
    case 'lowercase':
      return value.toLowerCase();
    
    case 'upper':
    case 'uppercase':
      return value.toUpperCase();
    
    case 'capitalize':
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    
    case 'title':
      return value.replace(/\b\w/g, (c) => c.toUpperCase());
    
    case 'slugify':
      return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    
    case 'truncate':
      const maxLength = parseInt(filterArgs[0] || '100', 10);
      if (value.length <= maxLength) return value;
      return value.substring(0, maxLength) + '...';
    
    case 'split':
      const separator = filterArgs[0] || ',';
      return value.split(separator).map((s) => s.trim()).join('\n');
    
    case 'join':
      const joiner = filterArgs[0] || ', ';
      return value.split('\n').join(joiner);
    
    case 'replace':
      if (filterArgs.length >= 2) {
        return value.replace(new RegExp(filterArgs[0], 'g'), filterArgs[1]);
      }
      return value;
    
    case 'wikilink':
      return `[[${value}]]`;
    
    case 'link':
      const url = filterArgs[0] || value;
      return `[${value}](${url})`;
    
    case 'quote':
      return value.split('\n').map((line) => `> ${line}`).join('\n');
    
    case 'list':
      return value.split('\n').map((line) => `- ${line}`).join('\n');
    
    case 'strip_tags':
      return value.replace(/<[^>]*>/g, '');
    
    case 'escape_yaml':
      return escapeYaml(value);
    
    case 'markdown':
      // Convert HTML to Markdown
      return htmlToMarkdown(value);
    
    default:
      return value;
  }
}

/**
 * Sanitize a filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    // Remove or replace invalid characters
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    // Replace multiple spaces/underscores with single
    .replace(/[\s_]+/g, ' ')
    // Trim whitespace and dots from ends
    .replace(/^[\s.]+|[\s.]+$/g, '')
    // Truncate to reasonable length
    .substring(0, 200)
    // Default if empty
    || 'Untitled';
}

/**
 * Build the variable context from page content and highlights
 */
export function buildVariableContext(
  metadata: { title: string; url: string; author?: string; published?: string; description?: string; schemaOrg?: Record<string, unknown> },
  content: string,
  contentHtml: string,
  selection?: string,
  selectionHtml?: string,
  highlights?: string,
  highlightCount?: number
): VariableContext {
  let domain = '';
  try {
    domain = new URL(metadata.url).hostname;
  } catch {
    // Ignore URL parsing errors
  }
  
  return {
    title: metadata.title || '',
    url: metadata.url || '',
    domain,
    author: metadata.author || '',
    published: metadata.published || '',
    description: metadata.description || '',
    content,
    contentHtml,
    selection: selection || '',
    selectionHtml: selectionHtml || '',
    highlights: highlights || '',
    highlightCount: highlightCount || 0,
    date: dayjs().format('YYYY-MM-DD'),
    time: dayjs().format('HH:mm:ss'),
    schema: metadata.schemaOrg,
  };
}
