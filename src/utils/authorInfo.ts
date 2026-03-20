export const DEFAULT_AUTHOR_FONT_FAMILY = '"Anonymous Pro for Powerline", monospace';

type FontOption = {
  text: string;
  value: string;
  aliases?: string[];
};

export const AUTHOR_FONT_OPTIONS: FontOption[] = [
  {
    text: 'Anonymous Pro for Powerline',
    value: DEFAULT_AUTHOR_FONT_FAMILY,
    aliases: ['Anonymous Pro for Powerline'],
  },
  {
    text: 'JetBrains Mono',
    value: '"JetBrains Mono", monospace',
    aliases: ['JetBrains Mono'],
  },
  {
    text: 'Fira Code',
    value: '"Fira Code", monospace',
    aliases: ['Fira Code'],
  },
  {
    text: 'SF Pro Display',
    value: '"SF Pro Display", "PingFang SC", sans-serif',
    aliases: ['SF Pro Display'],
  },
  {
    text: 'PingFang SC',
    value: '"PingFang SC", sans-serif',
    aliases: ['PingFang SC'],
  },
  {
    text: '跟随 Obsidian 主题',
    value: 'var(--font-text)',
    aliases: ['var(--font-text)'],
  },
];

export function normalizeAuthorFontFamily(fontFamily?: string) {
  if (!fontFamily) {
    return DEFAULT_AUTHOR_FONT_FAMILY;
  }

  const trimmed = fontFamily.trim();
  const matched = AUTHOR_FONT_OPTIONS.find(option => (
    option.value === trimmed || option.aliases?.includes(trimmed)
  ));

  return matched?.value || trimmed;
}
