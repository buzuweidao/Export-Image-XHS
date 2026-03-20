export const DEFAULT_BODY_FONT_SIZE = 18;

export function getBodyTypographyStyle(setting = {}) {
  const bodyFontSize = Number(setting.bodyFontSize ?? DEFAULT_BODY_FONT_SIZE);

  if (!Number.isFinite(bodyFontSize) || bodyFontSize <= 0) {
    return {
      fontSize: `${DEFAULT_BODY_FONT_SIZE}px`,
    };
  }

  return {
    fontSize: `${bodyFontSize}px`,
  };
}
