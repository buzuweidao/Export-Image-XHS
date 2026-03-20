/**
 * @param {{clientHeight?: number; scrollHeight?: number} | null | undefined} bodyElement
 * @returns {number}
 */
export function getCaptureContentHeight(bodyElement) {
  if (!bodyElement) {
    return 0;
  }

  return Math.max(
    bodyElement.clientHeight ?? 0,
    bodyElement.scrollHeight ?? 0,
  );
}

/**
 * @param {number} startY
 * @returns {{
 *   height: string;
 *   maxHeight: string;
 *   minHeight: string;
 *   overflow: string;
 *   overflowX: string;
 *   overflowY: string;
 *   transform: string;
 * }}
 */
export function getPagedBodyCloneStyle(startY) {
  return {
    height: 'auto',
    maxHeight: 'none',
    minHeight: '0',
    overflow: 'visible',
    overflowX: 'visible',
    overflowY: 'visible',
    transform: `translateY(-${startY}px)`,
  };
}
