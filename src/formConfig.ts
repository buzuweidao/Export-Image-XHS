import type { App } from 'obsidian';
import L from 'src/L';
import { formatAvailable, formatAvailableReady } from 'src/settings';
import { AUTHOR_FONT_OPTIONS } from './utils/authorInfo';

// 从 type.d.ts 中引入类型
type FileFormat = 'png0' | 'png1' | 'jpg' | 'webp' | 'pdf';

export interface SettingItem<T = unknown> {
  id: string;
  label: string;
  description?: string;
  type: 'text' | 'number' | 'toggle' | 'dropdown' | 'color' | 'file';
  defaultValue?: T;
  placeholder?: string;
  options?: Array<{ value: string; text: string }>;
  validate?: (value: T) => boolean;
  onChange?: (value: T, app: App) => void | Promise<void>;
  show?: (settings: ISettings) => boolean;
}

export const createSettingConfig = async (app: App): Promise<SettingItem[]> => {
  await formatAvailableReady;
  return [
    {
      id: 'width',
      label: L.setting.imageWidth.label(),
      description: L.setting.imageWidth.description(),
      type: 'number',
      placeholder: '621',
    },
    {
      id: 'bodyFontSize',
      label: '正文字号',
      type: 'number',
      placeholder: '18',
    },
    {
      id: 'padding.top',
      label: L.setting.padding.top(),
      description: L.setting.padding.description(),
      type: 'number',
      placeholder: '66',
    },
    {
      id: 'padding.right',
      label: L.setting.padding.right(),
      description: L.setting.padding.description(),
      type: 'number',
      placeholder: '40',
    },
    {
      id: 'padding.bottom',
      label: L.setting.padding.bottom(),
      description: L.setting.padding.description(),
      type: 'number',
      placeholder: '28',
    },
    {
      id: 'padding.left',
      label: L.setting.padding.left(),
      description: L.setting.padding.description(),
      type: 'number',
      placeholder: '66',
    },
    {
      id: 'split.mode',
      label: L.setting.split.mode.label(),
      description: L.setting.split.mode.description(),
      type: 'dropdown',
      options: [
        { value: 'none', text: L.setting.split.mode.none() },
        { value: 'fixed', text: L.setting.split.mode.fixed() },
        { value: 'hr', text: L.setting.split.mode.hr() },
        { value: 'auto', text: L.setting.split.mode.auto() },
        { value: 'xiaohongshu', text: '小红书比例（3:4）' },
      ],
    },
    {
      id: 'split.height',
      label: L.setting.split.height.label(),
      description: L.setting.split.height.description(),
      type: 'number',
      placeholder: '1000',
      show: (settings) => settings.split.mode !== 'none'
        && settings.split.mode !== 'hr'
        && settings.split.mode !== 'xiaohongshu',
    },
    {
      id: 'split.overlap',
      label: L.setting.split.overlap.label(),
      description: L.setting.split.overlap.description(),
      type: 'number',
      placeholder: '40',
      show: (settings) => settings.split.mode === 'fixed',
    },
    {
      id: 'showFilename',
      label: L.setting.filename.label(),
      description: L.setting.filename.description(),
      type: 'toggle',
    },
    {
      id: 'showMetadata',
      label: L.setting.metadata.label(),
      type: 'toggle',
    },
    {
      id: 'resolutionMode',
      label: L.setting.resolutionMode.label(),
      description: L.setting.resolutionMode.description(),
      type: 'dropdown',
      options: [
        { value: '1x', text: '1x' },
        { value: '2x', text: '2x' },
        { value: '3x', text: '3x' },
        { value: '4x', text: '4x' },
      ],
    },
    {
      id: 'format',
      label: L.setting.format.title(),
      description: L.setting.format.description(),
      type: 'dropdown',
      options: [
        { value: 'png0', text: L.setting.format.png0() },
        { value: 'png1', text: L.setting.format.png1() },
        { value: 'jpg', text: L.setting.format.jpg() },
        { value: 'webp', text: '.webp' },
        { value: 'pdf', text: L.setting.format.pdf() },
      ].filter(({ value }) => formatAvailable.contains(value as FileFormat)),
    },
    {
      id: 'quickExportSelection',
      label: L.setting.quickExportSelection.label(),
      description: L.setting.quickExportSelection.description(),
      type: 'toggle',
    },
    {
      id: 'authorInfo.show',
      label: L.setting.userInfo.show(),
      type: 'toggle',
    },
    {
      id: 'authorInfo.name',
      label: L.setting.userInfo.name(),
      type: 'text',
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.remark',
      label: L.setting.userInfo.remark(),
      type: 'text',
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.avatar',
      label: L.setting.userInfo.avatar.title(),
      description: L.setting.userInfo.avatar.description(),
      type: 'file',
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.avatarSize',
      label: '头像大小',
      type: 'number',
      placeholder: '88',
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.paddingTop',
      label: '作者区上边距',
      type: 'number',
      placeholder: '66',
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.nameFontSize',
      label: '作者名字号',
      type: 'number',
      placeholder: '25',
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.nameFontFamily',
      label: '作者名字体',
      type: 'dropdown',
      options: AUTHOR_FONT_OPTIONS.map(option => ({ value: option.value, text: option.text })),
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.remarkFontSize',
      label: '额外文案字号',
      type: 'number',
      placeholder: '25',
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.remarkFontFamily',
      label: '额外文案字体',
      type: 'dropdown',
      options: AUTHOR_FONT_OPTIONS.map(option => ({ value: option.value, text: option.text })),
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.separator',
      label: '作者区分隔样式',
      type: 'dropdown',
      options: [
        { value: 'none', text: '无分隔' },
        { value: 'line', text: '细线分隔' },
        { value: 'background', text: '浅色底' },
      ],
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.position',
      label: L.setting.userInfo.position(),
      type: 'dropdown',
      options: [
        { value: 'top', text: 'Top' },
        { value: 'bottom', text: 'Bottom' },
      ],
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'authorInfo.align',
      label: L.setting.userInfo.align(),
      type: 'dropdown',
      options: [
        { value: 'left', text: 'Left' },
        { value: 'center', text: 'Center' },
        { value: 'right', text: 'Right' },
      ],
      show: (settings) => settings.authorInfo.show,
    },
    {
      id: 'watermark.enable',
      label: L.setting.watermark.enable.label(),
      description: L.setting.watermark.enable.description(),
      type: 'toggle',
    },
    {
      id: 'watermark.type',
      label: L.setting.watermark.type.label(),
      description: L.setting.watermark.type.description(),
      type: 'dropdown',
      options: [
        { value: 'text', text: L.setting.watermark.type.text() },
        { value: 'image', text: L.setting.watermark.type.image() },
      ],
      show: (settings) => settings.watermark.enable,
    },
    {
      id: 'watermark.text.content',
      label: L.setting.watermark.text.content(),
      type: 'text',
      show: (settings) => settings.watermark.enable && settings.watermark.type === 'text',
    },
    {
      id: 'watermark.text.color',
      label: L.setting.watermark.text.color(),
      type: 'color',
      defaultValue: '#cccccc',
      show: (settings) => settings.watermark.enable && settings.watermark.type === 'text',
    },
    {
      id: 'watermark.text.fontSize',
      label: L.setting.watermark.text.fontSize(),
      type: 'number',
      placeholder: '16',
      show: (settings) => settings.watermark.enable && settings.watermark.type === 'text',
    },
    {
      id: 'watermark.image.src',
      label: L.setting.watermark.image.src.label(),
      type: 'file',
      show: (settings) => settings.watermark.enable && settings.watermark.type === 'image',
    },
    {
      id: 'watermark.opacity',
      label: L.setting.watermark.opacity(),
      type: 'number',
      placeholder: '0.06',
      show: (settings) => settings.watermark.enable,
    },
    {
      id: 'watermark.rotate',
      label: L.setting.watermark.rotate(),
      type: 'number',
      placeholder: '-30',
      show: (settings) => settings.watermark.enable,
    },
    {
      id: 'watermark.width',
      label: L.setting.watermark.width(),
      type: 'number',
      placeholder: '120',
      show: (settings) => settings.watermark.enable,
    },
    {
      id: 'watermark.height',
      label: L.setting.watermark.height(),
      type: 'number',
      placeholder: '64',
      show: (settings) => settings.watermark.enable,
    },
    {
      id: 'watermark.x',
      label: L.setting.watermark.x(),
      type: 'number',
      placeholder: '100',
      show: (settings) => settings.watermark.enable,
    },
    {
      id: 'watermark.y',
      label: L.setting.watermark.y(),
      type: 'number',
      placeholder: '100',
      show: (settings) => settings.watermark.enable,
    },
  ];
};
