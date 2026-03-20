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
