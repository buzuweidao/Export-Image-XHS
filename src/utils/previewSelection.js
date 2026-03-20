export function getNextActivePreviewPage(currentIndex, clickedIndex) {
  return currentIndex === clickedIndex ? -1 : clickedIndex;
}

function resolveEventElement(target) {
  if (!target) {
    return null;
  }

  if (typeof target.closest === 'function') {
    return target;
  }

  if (target.parentElement && typeof target.parentElement.closest === 'function') {
    return target.parentElement;
  }

  return null;
}

export function shouldTogglePreviewSelection(target) {
  const element = resolveEventElement(target);

  if (!element) {
    return true;
  }

  return !element.closest('.export-image-draft-page-editor');
}

export function sanitizeCaptureClassName(className = '') {
  return className
    .split(/\s+/)
    .filter(token => token && token !== 'is-selected')
    .join(' ');
}
