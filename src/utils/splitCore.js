/**
 * @param {number} effectiveHeight
 * @param {number} totalHeight
 * @param {Array<{top:number,height:number}>} elements
 * @param {number} [firstPageHeight]
 * @returns {Array<{startY:number,height:number}>}
 */
export function calculateAutoLikeSplitPositions(effectiveHeight, totalHeight, elements, firstPageHeight = effectiveHeight) {
  if (!elements.length) {
    return [{ startY: 0, height: totalHeight }];
  }

  const positions = [];
  let currentStartY = 0;
  let pageStartIndex = 0;
  let index = 0;
  let currentPageHeight = firstPageHeight;

  while (index < elements.length) {
    const item = elements[index];
    const itemBottom = item.top + item.height;
    const pageBottom = currentStartY + currentPageHeight;

    if (itemBottom <= pageBottom) {
      index++;
      continue;
    }

    if (index === pageStartIndex) {
      positions.push({ startY: currentStartY, height: currentPageHeight });
      currentStartY += currentPageHeight;
      currentPageHeight = effectiveHeight;
      continue;
    }

    positions.push({ startY: currentStartY, height: item.top - currentStartY });
    currentStartY = item.top;
    pageStartIndex = index;
    currentPageHeight = effectiveHeight;
  }

  if (currentStartY < totalHeight) {
    positions.push({ startY: currentStartY, height: totalHeight - currentStartY });
  }

  return positions;
}
