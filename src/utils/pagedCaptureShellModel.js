import { sanitizeCaptureClassName } from './previewSelection.js';

export function getPagedCaptureShellClassName(rootClassName = '') {
  const sanitized = sanitizeCaptureClassName(rootClassName).trim();
  return [sanitized, 'export-image-hidden'].filter(Boolean).join(' ');
}
