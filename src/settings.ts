import { isCreatable } from './imageFormatTester';
import { DEFAULT_AUTHOR_FONT_FAMILY } from './utils/authorInfo';

export const DEFAULT_SETTINGS: ISettings = {
  width: 621,
  bodyFontSize: 18,
  showFilename: false,
  resolutionMode: '2x' as ResolutionMode,
  format: 'png0',
  showMetadata: false,
  recursive: false,
  quickExportSelection: false,
  padding: {
    top: 40,
    right: 40,
    bottom: 28,
    left: 66,
  },
  authorInfo: {
    show: true,
    avatarSize: 88,
    paddingTop: 66,
    nameFontSize: 25,
    remarkFontSize: 25,
    nameFontFamily: DEFAULT_AUTHOR_FONT_FAMILY,
    remarkFontFamily: DEFAULT_AUTHOR_FONT_FAMILY,
    badgeStyle: 'none',
    weiboLocation: '',
    separator: 'none',
    align: 'left',
    position: 'top',
  },
  watermark: {
    enable: false,
    type: 'text',
    text: {
      content: '',
      fontSize: 28,
      color: '#cccccc',
    },
    image: {
      src: '',
    },
    opacity: 0.06,
    rotate: 30,
    height: 64,
    width: 120,
    x: 100,
    y: 100,
  },
  split: {
    height: 1000,
    overlap: 80,
    mode: 'xiaohongshu' as SplitMode,
  },
};

const formatList: FileFormat[] = ['png0', 'png1', 'jpg', 'webp', 'pdf'];
export const formatAvailable: FileFormat[] = [];
export const formatAvailableReady = (async () => {
  for (const type of formatList) {
    if (await isCreatable(type)) {
      formatAvailable.push(type);
    }
  }
})();
