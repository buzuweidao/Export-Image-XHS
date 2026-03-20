/**
 * @typedef {'none' | 'fixed' | 'hr' | 'auto' | 'xiaohongshu'} SplitMode
 */

export const XIAOHONGSHU_RECOMMENDED_WIDTH = 621;
export const XIAOHONGSHU_RECOMMENDED_PADDING = {
  top: 66,
  right: 24,
  bottom: 28,
  left: 66,
};

/**
 * @param {SplitMode} mode
 * @returns {boolean}
 */
export function isAutoLikeSplitMode(mode) {
  return mode === 'auto' || mode === 'xiaohongshu';
}

/**
 * @param {SplitMode} mode
 * @returns {boolean}
 */
export function isPagedSplitMode(mode) {
  return mode === 'fixed' || mode === 'auto' || mode === 'xiaohongshu';
}

/**
 * @param {SplitMode} mode
 * @param {number | undefined} currentWidth
 * @returns {number | undefined}
 */
export function getRecommendedWidth(mode, currentWidth) {
  if (mode === 'xiaohongshu') {
    return XIAOHONGSHU_RECOMMENDED_WIDTH;
  }

  return currentWidth;
}

/**
 * @param {SplitMode} mode
 * @param {{top:number,right:number,bottom:number,left:number}} currentPadding
 * @returns {{top:number,right:number,bottom:number,left:number}}
 */
export function getRecommendedPadding(mode, currentPadding) {
  if (mode === 'xiaohongshu') {
    return XIAOHONGSHU_RECOMMENDED_PADDING;
  }

  return currentPadding;
}

/**
 * @param {SplitMode} mode
 * @param {number | undefined} width
 * @param {number} configuredHeight
 * @returns {number}
 */
export function getSplitHeight(mode, width, configuredHeight) {
  if (mode === 'xiaohongshu') {
    const safeWidth = Math.max(1, width ?? XIAOHONGSHU_RECOMMENDED_WIDTH);
    return Math.round((safeWidth * 4) / 3);
  }

  return configuredHeight;
}

/**
 * @param {SplitMode} mode
 * @param {number | undefined} width
 * @param {number} configuredHeight
 * @param {number | undefined} paddingTop
 * @param {number | undefined} paddingBottom
 * @returns {number}
 */
export function getSplitContentHeight(mode, width, configuredHeight, paddingTop = 0, paddingBottom = 0) {
  const finalHeight = getSplitHeight(mode, width, configuredHeight);
  return Math.max(1, finalHeight - paddingTop - paddingBottom);
}

/**
 * @param {SplitMode} mode
 * @param {number} pageHeight
 * @param {Array<{startY:number,height:number}>} splitPositions
 * @returns {Array<{startY:number,height:number,previewHeight:number}>}
 */
export function getPreviewPageFrames(mode, pageHeight, splitPositions) {
  return splitPositions.map(position => ({
    ...position,
    previewHeight: isPagedSplitMode(mode) ? pageHeight : position.height,
    viewportHeight: position.height,
  }));
}
