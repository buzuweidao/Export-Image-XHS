import { getAuthorBlockHeight } from './authorLayout.js';

const DEFAULT_AUTHOR_ALIGN = 'left';
const DEFAULT_AUTHOR_TOP_PADDING = 12;
const DEFAULT_AUTHOR_BOTTOM_PADDING = 12;

export function getBodyPadding(setting = {}) {
  return {
    top: setting.padding?.top ?? 0,
    right: setting.padding?.right ?? 0,
    bottom: setting.padding?.bottom ?? 0,
    left: setting.padding?.left ?? 0,
  };
}

export function getAuthorPadding(setting = {}) {
  const bodyPadding = getBodyPadding(setting);

  return {
    top: setting.authorInfo?.paddingTop ?? DEFAULT_AUTHOR_TOP_PADDING,
    right: bodyPadding.right,
    bottom: DEFAULT_AUTHOR_BOTTOM_PADDING,
    left: bodyPadding.left,
  };
}

export function getAuthorAlign(setting = {}) {
  return setting.authorInfo?.align || DEFAULT_AUTHOR_ALIGN;
}

export function shouldShowAuthorOnPage({
  setting = {},
  pageIndex = 0,
  totalPages = 1,
}) {
  const authorInfo = setting.authorInfo || {};
  const hasAuthorContent = Boolean(authorInfo.avatar || authorInfo.name);

  if (!authorInfo.show || !hasAuthorContent) {
    return false;
  }

  if (authorInfo.position === 'bottom') {
    return pageIndex === totalPages - 1;
  }

  return pageIndex === 0;
}

/**
 * @param {{
 *   setting?: object;
 *   pageHeight?: number;
 *   pageIndex?: number;
 *   totalPages?: number;
 *   authorHeightOverride?: number;
 * }} options
 */
export function getPageLayoutMetrics({
  setting = {},
  pageHeight = 0,
  pageIndex = 0,
  totalPages = 1,
  authorHeightOverride = undefined,
}) {
  const bodyPadding = getBodyPadding(setting);
  const authorPadding = getAuthorPadding(setting);
  const authorAlign = getAuthorAlign(setting);
  const authorVisible = shouldShowAuthorOnPage({ setting, pageIndex, totalPages });
  const authorHeight = authorVisible
    ? Math.max(0, authorHeightOverride ?? getAuthorBlockHeight(setting.authorInfo || {}))
    : 0;
  const pageBodyHeight = Math.max(1, (pageHeight || 1) - authorHeight);
  const pageContentHeight = Math.max(1, pageBodyHeight - bodyPadding.top - bodyPadding.bottom);
  const pageWidth = setting.width || 640;
  const contentWidth = Math.max(1, pageWidth - bodyPadding.left - bodyPadding.right);

  return {
    pageWidth,
    contentWidth,
    bodyPadding,
    authorPadding,
    authorAlign,
    authorVisible,
    authorHeight,
    pageBodyHeight,
    pageContentHeight,
  };
}
