import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import DOMPurify from 'dompurify';

// Create and configure Turndown instance
const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  linkReferenceStyle: 'full',
});

// Add GFM plugin for tables, strikethrough, task lists
turndownService.use(gfm);

// Custom rule for handling YouTube embeds
turndownService.addRule('youtube', {
  filter: (node) => {
    if (node.nodeName === 'IFRAME') {
      const src = node.getAttribute('src') || '';
      return src.includes('youtube.com') || src.includes('youtu.be');
    }
    return false;
  },
  replacement: (_content, node) => {
    const src = (node as HTMLIFrameElement).src || '';
    const videoId = extractYouTubeId(src);
    if (videoId) {
      return `\n\n[![YouTube Video](https://img.youtube.com/vi/${videoId}/0.jpg)](https://www.youtube.com/watch?v=${videoId})\n\n`;
    }
    return '';
  },
});

// Custom rule for handling Twitter/X embeds
turndownService.addRule('twitter', {
  filter: (node) => {
    return (
      node.nodeName === 'BLOCKQUOTE' &&
      node.classList.contains('twitter-tweet')
    );
  },
  replacement: (content, node) => {
    const link = (node as HTMLElement).querySelector('a[href*="twitter.com"], a[href*="x.com"]');
    const href = link?.getAttribute('href') || '';
    return `\n\n> ${content.trim()}\n>\n> [View on Twitter](${href})\n\n`;
  },
});

// Custom rule for handling code blocks with language detection
turndownService.addRule('codeBlock', {
  filter: (node) => {
    return (
      node.nodeName === 'PRE' &&
      node.querySelector('code') !== null
    );
  },
  replacement: (_content, node) => {
    const codeElement = (node as HTMLElement).querySelector('code');
    if (!codeElement) return '';
    
    const code = codeElement.textContent || '';
    let language = '';
    
    // Try to detect language from class
    const classList = codeElement.className.split(' ');
    for (const cls of classList) {
      if (cls.startsWith('language-') || cls.startsWith('lang-')) {
        language = cls.replace(/^(language-|lang-)/, '');
        break;
      }
      if (cls.startsWith('hljs-')) continue;
      if (['javascript', 'typescript', 'python', 'rust', 'go', 'java', 'cpp', 'c', 'ruby', 'php', 'html', 'css', 'json', 'yaml', 'markdown', 'bash', 'shell', 'sql'].includes(cls)) {
        language = cls;
        break;
      }
    }
    
    return `\n\n\`\`\`${language}\n${code.trim()}\n\`\`\`\n\n`;
  },
});

// Custom rule for handling highlight/mark elements
turndownService.addRule('highlight', {
  filter: ['mark'],
  replacement: (content) => {
    return `==${content}==`;
  },
});

// Custom rule for handling strikethrough
turndownService.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (content: string) => {
    return `~~${content}~~`;
  },
});

// Custom rule for handling images - convert relative URLs to absolute
turndownService.addRule('images', {
  filter: 'img',
  replacement: (_content, node) => {
    const img = node as HTMLImageElement;
    let src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const title = img.getAttribute('title');
    
    // Convert relative URLs to absolute
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      try {
        src = new URL(src, document.URL).href;
      } catch {
        // Keep original src if URL parsing fails
      }
    }
    
    // Skip tiny images (likely tracking pixels or icons)
    const width = parseInt(img.getAttribute('width') || '0', 10);
    const height = parseInt(img.getAttribute('height') || '0', 10);
    if ((width > 0 && width < 10) || (height > 0 && height < 10)) {
      return '';
    }
    
    if (!src) return '';
    
    const titlePart = title ? ` "${title}"` : '';
    return `![${alt}](${src}${titlePart})`;
  },
});

// Custom rule for handling links - convert relative URLs to absolute
turndownService.addRule('links', {
  filter: 'a',
  replacement: (content, node) => {
    const anchor = node as HTMLAnchorElement;
    let href = anchor.getAttribute('href') || '';
    const title = anchor.getAttribute('title');
    
    // Convert relative URLs to absolute
    if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
      try {
        href = new URL(href, document.URL).href;
      } catch {
        // Keep original href if URL parsing fails
      }
    }
    
    if (!href || href === '#') {
      return content;
    }
    
    const titlePart = title ? ` "${title}"` : '';
    return `[${content}](${href}${titlePart})`;
  },
});

// Custom rule for handling math (MathJax/KaTeX)
turndownService.addRule('math', {
  filter: (node) => {
    const classList = (node as HTMLElement).className || '';
    return (
      classList.includes('MathJax') ||
      classList.includes('katex') ||
      node.nodeName === 'MATH' ||
      (node as HTMLElement).getAttribute('data-mathml') !== null
    );
  },
  replacement: (_content, node) => {
    // Try to get the original LaTeX from data attributes
    const latex = 
      (node as HTMLElement).getAttribute('data-latex') ||
      (node as HTMLElement).getAttribute('data-tex') ||
      (node as HTMLElement).getAttribute('alt') ||
      '';
    
    if (latex) {
      // Determine if it's display or inline math
      const isDisplay = (node as HTMLElement).classList.contains('MathJax_Display') ||
        (node as HTMLElement).parentElement?.classList.contains('MathJax_Display');
      
      if (isDisplay) {
        return `\n\n$$\n${latex}\n$$\n\n`;
      }
      return `$${latex}$`;
    }
    
    return '';
  },
});

/**
 * Convert HTML to Markdown
 */
export function htmlToMarkdown(html: string, baseUrl?: string): string {
  // Sanitize HTML first
  const cleanHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'a', 'img',
      'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike', 'mark',
      'code', 'pre', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'figure', 'figcaption',
      'div', 'span',
      'iframe', // For embeds
      'math', // For math
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'width', 'height',
      'class', 'id',
      'data-latex', 'data-tex', 'data-mathml',
      'colspan', 'rowspan',
    ],
  });
  
  // Store the base URL for relative link conversion
  if (baseUrl) {
    // We handle this in the custom rules above
  }
  
  // Convert to Markdown
  let markdown = turndownService.turndown(cleanHtml);
  
  // Clean up excessive whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
    .replace(/^\s+|\s+$/g, '')   // Trim
    .replace(/[ \t]+$/gm, '');   // Remove trailing whitespace
  
  return markdown;
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Escape special characters for YAML frontmatter
 */
export function escapeYaml(value: string): string {
  if (!value) return '';
  
  // If the value contains special characters, wrap in quotes
  if (/[:#\[\]{}|>!&*?'"]/.test(value) || value.includes('\n')) {
    // Escape existing double quotes
    return value.replace(/"/g, '\\"');
  }
  
  return value;
}

/**
 * Generate YAML frontmatter from properties
 */
export function generateFrontmatter(properties: Record<string, string | string[]>): string {
  const lines: string[] = ['---'];
  
  for (const [key, value] of Object.entries(properties)) {
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${escapeYaml(item)}`);
      }
    } else if (value) {
      // Check if value needs quoting
      if (/[:#\[\]{}|>!&*?'"\n]/.test(value) || value.startsWith(' ') || value.endsWith(' ')) {
        lines.push(`${key}: "${escapeYaml(value)}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}
