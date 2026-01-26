import browser from 'webextension-polyfill';
import type { ClipRequest, MessageResponse } from '../types/types';

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
  
  // Send message to background script to open the deep link
  // This avoids the popup closing and canceling the permission dialog
  const response = await browser.runtime.sendMessage({
    action: 'openDeepLink',
    data: { url },
  }) as MessageResponse;
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to open Onyx');
  }
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
