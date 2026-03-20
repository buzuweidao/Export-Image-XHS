export function getWatermarkTextLines(content = '') {
  return String(content).split(/\r?\n/);
}

export function getWatermarkTileMetrics(watermark = {}) {
  const markWidth = Number(watermark.width ?? 120);
  const markHeight = Number(watermark.height ?? 64);
  const gapX = Number(watermark.x ?? 100);
  const gapY = Number(watermark.y ?? 100);

  return {
    markWidth,
    markHeight,
    gapX,
    gapY,
    tileWidth: markWidth + gapX,
    tileHeight: markHeight + gapY,
    offsetLeft: gapX / 2,
    offsetTop: gapY / 2,
  };
}

export function buildStaticWatermarkLayerStyle({
  enable,
  patternUrl,
  tile,
}) {
  const baseStyle = {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    zIndex: '2',
  };

  if (!enable || !patternUrl || !tile) {
    return {
      ...baseStyle,
      display: 'none',
    };
  }

  return {
    ...baseStyle,
    backgroundRepeat: 'repeat, repeat',
    backgroundImage: `url(${patternUrl}), url(${patternUrl})`,
    backgroundPosition: `${tile.tileWidth / 2}px ${tile.tileHeight / 2}px, 0 0`,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export async function createWatermarkPattern(watermark = {}, resolveImageUrl = async url => url) {
  const tile = getWatermarkTileMetrics(watermark);

  if (!watermark.enable || typeof document === 'undefined') {
    return { patternUrl: '', tile };
  }

  const canvas = document.createElement('canvas');
  canvas.width = tile.tileWidth;
  canvas.height = tile.tileHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    return { patternUrl: '', tile };
  }

  context.translate(tile.offsetLeft, tile.offsetTop);
  context.rotate((Math.PI / 180) * Number(watermark.rotate ?? -30));
  context.globalAlpha = Number(watermark.opacity ?? 0.2);

  if (watermark.type === 'image' && watermark.image?.src) {
    try {
      const imageUrl = await resolveImageUrl(watermark.image.src);
      if (!imageUrl) {
        return { patternUrl: '', tile };
      }
      const image = await loadImage(imageUrl);
      context.drawImage(image, 0, 0, tile.markWidth, tile.markHeight);
      return { patternUrl: canvas.toDataURL(), tile };
    } catch (error) {
      console.error('Failed to draw watermark image:', error);
      return { patternUrl: '', tile };
    }
  }

  const lines = getWatermarkTextLines(watermark.text?.content ?? '')
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { patternUrl: '', tile };
  }

  const fontSize = Number(watermark.text?.fontSize ?? 16);
  const lineHeight = fontSize + 6;
  context.fillStyle = watermark.text?.color ?? '#cccccc';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `${fontSize}px sans-serif`;

  const contentHeight = fontSize + (Math.max(0, lines.length - 1) * lineHeight);
  const startY = Math.max(fontSize / 2, (tile.markHeight - contentHeight) / 2 + (fontSize / 2));

  lines.forEach((line, index) => {
    context.fillText(line, tile.markWidth / 2, startY + (index * lineHeight));
  });

  return { patternUrl: canvas.toDataURL(), tile };
}
