declare type FileFormat = 'png0' | 'png1' | 'jpg' | 'pdf' | 'webp';

declare type ISettings = {
  width?: number;
  bodyFontSize?: number;
  showFilename: boolean;
  resolutionMode: ResolutionMode;
  format: FileFormat;
  showMetadata: boolean;
  recursive: boolean;
  quickExportSelection: boolean;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  authorInfo: {
    show: boolean;
    name?: string;
    remark?: string;
    avatar?: string;
    avatarSize?: number;
    paddingTop?: number;
    nameFontSize?: number;
    remarkFontSize?: number;
    nameFontFamily?: string;
    remarkFontFamily?: string;
    badgeStyle?: 'none' | 'x' | 'weibo';
    separator?: 'none' | 'line' | 'background';
    align?: 'left' | 'center' | 'right';
    position?: 'top' | 'bottom';
  };
  watermark: {
    enable: boolean;
    type?: 'text' | 'image';
    text: {
      content?: string;
      fontSize?: number;
      color?: string;
    };
    image: {
      src?: string;
    };
    opacity?: number;
    rotate?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  split: {
    height: number;
    overlap: number;
    mode: SplitMode;
  };
};

type ConditionType<T> = { flag: unknown; path: string } | ((data: T) => boolean);

type ValueType = 'number' | 'string' | 'boolean' | 'file';

type BaseFieldSchema<T> = {
  label: string;
  path: string;
  type: ValueType;
  when?: ConditionType<T>;
  desc?: string;
};
type SelectFieldSchema<T> = {
  label: string;
  path: string;
  type: 'select';
  options: Array<{ text: string; value: string }>;
  when?: ConditionType<T>;
  desc?: string;
};
declare type FieldSchema<T> = BaseFieldSchema<T> | SelectFieldSchema<T>;
declare type FormSchema<T> = Array<FieldSchema<T>>;

declare type MetadataType =
  | 'text'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'multitext'
  | 'number'
  | 'tags'
  | 'aliases';

declare type SplitMode = 'none' | 'fixed' | 'hr' | 'auto' | 'xiaohongshu';

declare type ResolutionMode = '1x' | '2x' | '3x' | '4x';
