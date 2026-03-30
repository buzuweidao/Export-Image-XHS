function isMeaningfulTextNode(node) {
  return node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim());
}

/**
 * 收集块级元素内部每一行文本的安全断点。
 * 返回的 top 为相对传入容器 container 的绝对偏移，可用于分页断点计算。
 *
 * @param {Element} block
 * @param {HTMLElement} container
 * @returns {Array<{top:number;height:number}>}
 */
export function collectBlockLineMeasures(block, container) {
  const textWalker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isMeaningfulTextNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const lineTops = [];
  const containerRect = container.getBoundingClientRect();
  const blockRect = block.getBoundingClientRect();
  const blockTop = blockRect.top - containerRect.top;
  const blockBottom = blockRect.bottom - containerRect.top;

  while (textWalker.nextNode()) {
    const node = textWalker.currentNode;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects());
    range.detach?.();

    for (const rect of rects) {
      if (rect.height <= 0 || rect.width <= 0) {
        continue;
      }

      const relativeTop = rect.top - containerRect.top;
      if (!Number.isFinite(relativeTop)) {
        continue;
      }

      lineTops.push({
        top: relativeTop,
        height: rect.height,
      });
    }
  }

  if (lineTops.length <= 1) {
    return [];
  }

  const mergedLineTops = [];
  const sortedLineTops = lineTops.sort((a, b) => a.top - b.top);

  for (const line of sortedLineTops) {
    const previous = mergedLineTops.at(-1);
    if (previous && Math.abs(previous.top - line.top) < 1) {
      previous.height = Math.max(previous.height, line.height);
      continue;
    }

    mergedLineTops.push({...line});
  }

  return mergedLineTops.map((line, index) => {
    const nextTop = mergedLineTops[index + 1]?.top ?? blockBottom;
    return {
      top: Math.max(blockTop, line.top),
      height: Math.max(1, nextTop - line.top),
    };
  });
}

/**
 * @param {Element | null | undefined} markdownRoot
 * @returns {Element[]}
 */
export function collectAutoLikeMeasureTargets(markdownRoot) {
  if (!markdownRoot) {
    return [];
  }

  const directChildren = Array.from(markdownRoot.children ?? []);
  if (directChildren.length === 0) {
    return [];
  }

  if (directChildren.length === 1 && directChildren[0].tagName === 'DIV') {
    const wrappedChildren = Array.from(directChildren[0].children ?? []);
    if (wrappedChildren.length > 0) {
      return wrappedChildren;
    }
  }

  return directChildren;
}
