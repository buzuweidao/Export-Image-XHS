/**
 * @param {number} effectiveHeight
 * @param {number} totalHeight
 * @param {Array<{top:number,height:number,children?:Array<{top:number,height:number}>}>} elements
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
      const safeBreakTop = normalizeBreakTop(
        findSafeBreakTop(item.children, currentStartY, pageBottom),
        currentStartY,
      );
      if (safeBreakTop && safeBreakTop > currentStartY) {
        positions.push({ startY: currentStartY, height: safeBreakTop - currentStartY });
        currentStartY = safeBreakTop;
        currentPageHeight = effectiveHeight;
        continue;
      }

      positions.push({ startY: currentStartY, height: currentPageHeight });
      currentStartY += currentPageHeight;
      currentPageHeight = effectiveHeight;
      continue;
    }

    const nextStartY = normalizeBreakTop(item.top, currentStartY);
    positions.push({ startY: currentStartY, height: nextStartY - currentStartY });
    currentStartY = nextStartY;
    pageStartIndex = index;
    currentPageHeight = effectiveHeight;
  }

  if (currentStartY < totalHeight) {
    positions.push({ startY: currentStartY, height: totalHeight - currentStartY });
  }

  return positions;
}

/**
 * 当一个块级元素本身超过当前页可用高度时，
 * 在块内部找一个最近的行起点作为安全断点，避免截断半行文字。
 *
 * @param {Array<{top:number,height:number}> | undefined} children
 * @param {number} currentStartY
 * @param {number} pageBottom
 * @returns {number | undefined}
 */
function findSafeBreakTop(children, currentStartY, pageBottom) {
  if (!children?.length) {
    return undefined;
  }

  let candidate;
  for (const child of children) {
    if (child.top <= currentStartY + 1) {
      continue;
    }

    if (child.top >= pageBottom - 1) {
      break;
    }

    candidate = child.top;
  }

  return candidate;
}

/**
 * 将分页断点收敛到安全整数像素，避免 transform/clip 使用小数时裁到半行文字。
 *
 * @param {number | undefined} top
 * @param {number} currentStartY
 * @returns {number | undefined}
 */
function normalizeBreakTop(top, currentStartY) {
  if (!Number.isFinite(top)) {
    return undefined;
  }

  return Math.max(currentStartY + 1, Math.floor(top));
}
