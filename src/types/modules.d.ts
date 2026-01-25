// Type declarations for modules without types

declare module 'defuddle' {
  export interface DefuddleOptions {
    url?: string;
  }
  
  export interface DefuddleResult {
    title?: string;
    content?: string;
    author?: string;
    description?: string;
    published?: string;
    siteName?: string;
    image?: string;
    favicon?: string;
    wordCount?: number;
    schemaOrgData?: unknown;
  }
  
  export class Defuddle {
    constructor(document: Document, options?: DefuddleOptions);
    parse(): DefuddleResult;
  }
}

declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  
  export function gfm(turndownService: TurndownService): void;
  export function tables(turndownService: TurndownService): void;
  export function strikethrough(turndownService: TurndownService): void;
  export function taskListItems(turndownService: TurndownService): void;
}
