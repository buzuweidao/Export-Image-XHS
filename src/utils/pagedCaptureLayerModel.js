export function buildPagedCaptureLayerPlan({
  pageIndex = 0,
  authorHeight = 0,
  hasAuthorElement = false,
  hasWatermarkElement = false,
} = {}) {
  return {
    includeAuthor: pageIndex === 0 && authorHeight > 0 && hasAuthorElement,
    includeWatermark: hasWatermarkElement,
    shellPosition: 'relative',
  };
}
