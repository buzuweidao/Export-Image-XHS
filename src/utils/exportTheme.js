const DEFAULT_BACKGROUND = '#ffffff';
const DARK_TEXT = { r: 34, g: 34, b: 34 };
const LIGHT_TEXT = { r: 248, g: 248, b: 248 };

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHexColor(value, fallback = DEFAULT_BACKGROUND) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return fallback;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function mixColors(base, overlay, ratio) {
  return {
    r: clampChannel(base.r * (1 - ratio) + overlay.r * ratio),
    g: clampChannel(base.g * (1 - ratio) + overlay.g * ratio),
    b: clampChannel(base.b * (1 - ratio) + overlay.b * ratio),
  };
}

function toRgbString(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function toLinear(channel) {
  const normalized = channel / 255;
  if (normalized <= 0.03928) {
    return normalized / 12.92;
  }

  return ((normalized + 0.055) / 1.055) ** 2.4;
}

function getLuminance(color) {
  return (
    0.2126 * toLinear(color.r)
    + 0.7152 * toLinear(color.g)
    + 0.0722 * toLinear(color.b)
  );
}

function getReadableTextColor(background) {
  return getLuminance(background) >= 0.52 ? DARK_TEXT : LIGHT_TEXT;
}

export function resolveExportTheme(setting = {}) {
  const exportTheme = setting.exportTheme || {};
  const mode = exportTheme.mode === 'custom' ? 'custom' : 'obsidian';

  if (mode !== 'custom') {
    return { mode };
  }

  const backgroundColor = normalizeHexColor(exportTheme.backgroundColor);
  const background = hexToRgb(backgroundColor);
  const text = getReadableTextColor(background);

  return {
    mode,
    backgroundColor,
    textColor: toRgbString(text),
    mutedTextColor: toRgbString(mixColors(text, background, 0.48)),
    faintTextColor: toRgbString(mixColors(text, background, 0.68)),
    surfaceColor: toRgbString(mixColors(background, text, 0.05)),
    surfaceAltColor: toRgbString(mixColors(background, text, 0.08)),
    borderColor: toRgbString(mixColors(background, text, 0.14)),
  };
}

export function getExportThemeCssVars(setting = {}) {
  const theme = resolveExportTheme(setting);
  if (theme.mode !== 'custom') {
    return {};
  }

  return {
    '--background-primary': theme.backgroundColor,
    '--background-primary-alt': theme.surfaceColor,
    '--background-secondary': theme.surfaceColor,
    '--background-secondary-alt': theme.surfaceAltColor,
    '--background-modifier-border': theme.borderColor,
    '--blockquote-border-color': theme.borderColor,
    '--hr-color': theme.borderColor,
    '--text-normal': theme.textColor,
    '--text-muted': theme.mutedTextColor,
    '--text-faint': theme.faintTextColor,
    '--code-background': theme.surfaceColor,
  };
}
