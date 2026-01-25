import type { ClipRequest, AiRequest, AiResponse } from '../types/types';

/**
 * Clip content to Onyx via URL scheme
 * Uses clipboard for content transfer to avoid URL length limits
 */
export async function clipToOnyx(request: ClipRequest): Promise<void> {
  // Copy content to clipboard
  await navigator.clipboard.writeText(request.content);
  
  // Build URL with parameters
  const params = new URLSearchParams({
    title: request.title,
    path: request.path,
    clipboard: '1',
  });
  
  if (request.filename) {
    params.set('filename', request.filename);
  }
  
  // Open Onyx via URL scheme
  const url = `onyx://clip?${params.toString()}`;
  window.open(url, '_self');
}

/**
 * Request AI completion from Onyx
 * Onyx will process the prompt using the user's OpenCode configuration
 */
export async function requestAiCompletion(
  prompt: string,
  context: string,
  timeoutMs: number = 60000
): Promise<string> {
  const callbackId = generateCallbackId();
  
  // Prepare the request payload
  const payload: AiRequest = {
    prompt,
    context,
    callbackId,
  };
  
  // Copy the request to clipboard
  await navigator.clipboard.writeText(JSON.stringify(payload));
  
  // Build URL
  const params = new URLSearchParams({
    callback_id: callbackId,
    clipboard: '1',
  });
  
  // Open Onyx to process the AI request
  const url = `onyx://ai?${params.toString()}`;
  
  // We need to open this in a way that doesn't navigate away from the page
  // Use a hidden iframe or window.open with specific parameters
  const popup = window.open(url, '_blank', 'width=1,height=1');
  
  // Poll clipboard for response
  const result = await pollForAiResponse(callbackId, timeoutMs);
  
  // Close the popup if it's still open
  if (popup && !popup.closed) {
    popup.close();
  }
  
  return result;
}

/**
 * Poll the clipboard for an AI response
 */
async function pollForAiResponse(
  callbackId: string,
  timeoutMs: number
): Promise<string> {
  const startTime = Date.now();
  const pollInterval = 500; // Check every 500ms
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const clipboardText = await navigator.clipboard.readText();
      
      // Try to parse as JSON response
      try {
        const response = JSON.parse(clipboardText) as AiResponse;
        
        if (response.callbackId === callbackId) {
          if (response.error) {
            throw new Error(response.error);
          }
          return response.result;
        }
      } catch {
        // Not a valid JSON response, continue polling
      }
    } catch {
      // Clipboard read failed, continue polling
    }
    
    // Wait before next poll
    await sleep(pollInterval);
  }
  
  throw new Error('AI request timed out');
}

/**
 * Generate a unique callback ID
 */
function generateCallbackId(): string {
  return `onyx-ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if Onyx is likely installed by testing the URL scheme
 * Note: This is a heuristic and may not be 100% accurate
 */
export async function checkOnyxInstalled(): Promise<boolean> {
  // We can't reliably detect if a URL scheme is registered
  // The best we can do is try to open it and see if it works
  // For now, we'll assume it's installed if the user has configured it
  
  // In the future, we could:
  // 1. Try to open a test URL and see if it redirects back
  // 2. Check for a known file/cookie that Onyx might set
  // 3. Use native messaging if available
  
  return true;
}

/**
 * Open Onyx app (without clipping)
 */
export function openOnyx(): void {
  window.open('onyx://', '_self');
}

/**
 * Create a handler function for AI prompts that can be passed to template compiler
 */
export function createAiHandler(
  timeoutMs: number = 60000
): (prompt: string, context: string) => Promise<string> {
  return async (prompt: string, context: string): Promise<string> => {
    return requestAiCompletion(prompt, context, timeoutMs);
  };
}
