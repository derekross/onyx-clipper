# Onyx Clipper

A browser extension that allows you to clip web pages, highlight content, and save them directly to your Onyx vault as Markdown files.

## Features

- **Clip entire pages** - Convert web pages to clean Markdown
- **Highlight text** - Mark important passages that persist across visits
- **Templates** - Customize how content is saved (articles, recipes, references, etc.)
- **AI-powered** - Use `{{prompt:"..."}}` in templates for AI-generated summaries
- **Multi-browser support** - Chrome, Firefox, Edge, Brave

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone https://github.com/onyxnotes/onyx-clipper.git
   cd onyx-clipper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   # For Chrome/Edge/Brave
   npm run build:chrome
   
   # For Firefox
   npm run build:firefox
   ```

4. Load the extension:
   - **Chrome**: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", select the `dist` folder
   - **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select any file in the `dist_firefox` folder

## Development

```bash
# Watch mode for Chrome
npm run dev:chrome

# Watch mode for Firefox
npm run dev:firefox
```

## Usage

### Basic Clipping

1. Click the Onyx Clipper icon in your browser toolbar
2. Select a template
3. Click "Add to Onyx"

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+X` | Open Onyx Clipper popup |
| `Alt+Shift+X` | Quick clip with default template |
| `Alt+Shift+H` | Toggle highlighter mode |

### Highlighting

1. Press `Alt+Shift+H` or click "Enable Highlighter" in the popup
2. Select text on the page to highlight it
3. Shift+click a highlight to remove it
4. Your highlights are saved and will appear when you revisit the page

### Templates

Templates control how clipped content is formatted. Available variables:

| Variable | Description |
|----------|-------------|
| `{{title}}` | Page title |
| `{{content}}` | Full content as Markdown |
| `{{url}}` | Source URL |
| `{{author}}` | Author name |
| `{{published}}` | Publish date |
| `{{date}}` | Current date |
| `{{date:FORMAT}}` | Current date with custom format |
| `{{selection}}` | Selected text |
| `{{highlights}}` | All highlights as Markdown |
| `{{description}}` | Meta description |
| `{{prompt:"..."}}` | AI-generated content |

### AI Integration

The `{{prompt:"..."}}` variable sends your prompt to Onyx, which processes it using your OpenCode configuration. Examples:

```markdown
## Summary
{{prompt:"Summarize this article in 3 bullet points"}}

## Key Quotes
{{prompt:"Extract the most important quotes"}}
```

## Configuration

### Settings

- **Default Template**: Which template to use for quick clips
- **Default Path**: Where to save clipped files (default: `Clippings/`)
- **Highlight Color**: Default color for new highlights
- **Show Highlights on Load**: Automatically display highlights when revisiting pages

### Custom Templates

1. Go to Settings (click the gear icon)
2. Scroll to "Templates"
3. Click "Add Template"
4. Configure your template with variables and save

## Communication with Onyx

The extension communicates with the Onyx desktop app via URL schemes:

- `onyx://clip` - Save clipped content
- `onyx://ai` - Process AI prompts

Make sure Onyx is installed and the URL scheme is registered.

## Browser Support

| Browser | Status |
|---------|--------|
| Chrome | Supported |
| Firefox | Supported |
| Edge | Supported (use Chrome build) |
| Brave | Supported (use Chrome build) |
| Safari | Planned |

## License

MIT
