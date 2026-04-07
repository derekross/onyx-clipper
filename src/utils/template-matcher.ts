import type { Template } from '../types/types';

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
