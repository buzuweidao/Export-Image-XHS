import {isPagedSplitMode} from './splitMode.js';

export function buildPreviewSessionModel({splitMode = 'none', pageCount = 1} = {}) {
  const exportsMultiplePages = isPagedSplitMode(splitMode) || pageCount > 1;

  return {
    previewSurface: 'live-target',
    previewEditable: true,
    exportAction: exportsMultiplePages ? 'saveAll' : 'save',
    allowPanZoom: false,
    usesLegacyPagedPreview: false,
  };
}
