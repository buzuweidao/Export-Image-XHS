import {
  getSplitContentHeight,
  getSplitHeight,
  isPagedSplitMode,
} from './splitMode.js';
import { calculateAutoLikeSplitPositions } from './splitCore.js';

const XIAOHONGSHU_PAGE_GUARD = 8;

function calculatePositions({
  mode,
  height,
  firstPageHeight,
  overlap,
  totalHeight,
}, elements = []) {
  if (mode === 'hr') {
    const positions = [];
    let lastY = 0;
    elements.forEach((element, index) => {
      const currentY = element.top;
      if (index === 0) {
        positions.push({ startY: 0, height: currentY });
      } else {
        positions.push({ startY: lastY, height: currentY - lastY });
      }

      lastY = currentY;
    });

    if (lastY < totalHeight) {
      positions.push({ startY: lastY, height: totalHeight - lastY });
    }

    return positions;
  }

  if (mode === 'auto' || mode === 'xiaohongshu') {
    return calculateAutoLikeSplitPositions(height, totalHeight, elements, firstPageHeight);
  }

  const positions = [];
  const effectiveHeight = Math.max(height, 2 * overlap + 50);
  const initialHeight = effectiveHeight;
  const remainingHeight = totalHeight - initialHeight;
  const additionalPages = Math.max(0, Math.ceil(remainingHeight / (effectiveHeight - overlap * 2)));

  positions.push({ startY: 0, height: initialHeight });
  let lastY = initialHeight;

  for (let index = 1; index <= additionalPages; index++) {
    const startY = lastY - overlap;
    const pageHeight = index === additionalPages
      ? totalHeight - startY
      : effectiveHeight;
    positions.push({ startY, height: pageHeight });
    lastY = startY + pageHeight;
  }

  return positions;
}

/**
 * @param {{
 *   setting?: ISettings;
 *   totalHeight?: number;
 *   authorHeight?: number;
 *   elements?: Array<{top:number;height:number}>;
 * }} options
 */
export function buildCaptureSplitModel({
  setting,
  totalHeight = 0,
  authorHeight = 0,
  elements = [],
}) {
  const split = setting?.split || { mode: 'none', height: 0, overlap: 0 };
  const padding = setting?.padding || {};
  const width = setting?.width;
  const bottomPadding = padding.bottom ?? 0;
  const topPadding = padding.top ?? 0;
  const safeTotalHeight = Math.max(1, totalHeight);
  const pageHeight = getSplitHeight(split.mode, width, split.height);
  const pageGuard = split.mode === 'xiaohongshu' ? XIAOHONGSHU_PAGE_GUARD : 0;

  if (split.mode === 'none') {
    return {
      pageHeight,
      splitContentHeight: safeTotalHeight,
      splitPositions: [{ startY: 0, height: safeTotalHeight }],
      pageCount: 1,
      previewLines: [],
    };
  }

  const splitContentHeight = isPagedSplitMode(split.mode)
    ? Math.max(
      1,
      split.mode === 'xiaohongshu'
        ? pageHeight - topPadding - bottomPadding - pageGuard
        : pageHeight - bottomPadding - pageGuard,
    )
    : getSplitContentHeight(
      split.mode,
      width,
      split.height,
      padding.top,
      padding.bottom,
    );

  const splitPositions = calculatePositions({
    mode: split.mode,
    height: splitContentHeight,
    firstPageHeight: isPagedSplitMode(split.mode)
      ? Math.max(
        1,
        split.mode === 'xiaohongshu'
          ? pageHeight - authorHeight - topPadding - bottomPadding - pageGuard
          : pageHeight - authorHeight - pageGuard,
      )
      : undefined,
    overlap: split.overlap,
    totalHeight: safeTotalHeight,
    width,
  }, elements);

  const normalizedPositions = splitPositions.length > 0
    ? splitPositions
    : [{ startY: 0, height: safeTotalHeight }];

  return {
    pageHeight,
    splitContentHeight,
    splitPositions: normalizedPositions,
    pageCount: normalizedPositions.length,
    previewLines: normalizedPositions
      .slice(0, -1)
      .map(position => authorHeight + position.startY + position.height),
  };
}
