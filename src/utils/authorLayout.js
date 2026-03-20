const DEFAULT_AUTHOR_SECTION_BOTTOM_PADDING = 12;
const DEFAULT_AUTHOR_LINE_HEIGHT = 1.2;
const DEFAULT_AUTHOR_TEXT_GAP = 4;

function getAuthorTextHeight(authorInfo = {}) {
  const hasName = Boolean(authorInfo.name);
  const hasRemark = Boolean(authorInfo.remark);

  if (!hasName && !hasRemark) {
    return 0;
  }

  const nameHeight = hasName
    ? (authorInfo.nameFontSize || 16) * DEFAULT_AUTHOR_LINE_HEIGHT
    : 0;
  const remarkHeight = hasRemark
    ? (authorInfo.remarkFontSize || 12) * DEFAULT_AUTHOR_LINE_HEIGHT
    : 0;
  const gap = hasName && hasRemark ? DEFAULT_AUTHOR_TEXT_GAP : 0;

  return nameHeight + remarkHeight + gap;
}

export function getAuthorBlockHeight(authorInfo = {}) {
  if (!authorInfo.show || (!authorInfo.avatar && !authorInfo.name)) {
    return 0;
  }

  const topPadding = authorInfo.paddingTop ?? 12;
  const avatarHeight = authorInfo.avatar ? (authorInfo.avatarSize || 0) : 0;
  const textHeight = getAuthorTextHeight(authorInfo);
  const contentHeight = Math.max(avatarHeight, textHeight);

  return Math.ceil(topPadding + contentHeight + DEFAULT_AUTHOR_SECTION_BOTTOM_PADDING);
}
