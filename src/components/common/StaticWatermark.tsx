import React, {
  type CSSProperties, useEffect, useMemo, useState,
} from 'react';
import { getRemoteImageUrl } from 'src/utils/capture';
import {
  buildStaticWatermarkLayerStyle,
  createWatermarkPattern,
  getWatermarkTileMetrics,
} from 'src/utils/watermark.js';

const StaticWatermark = ({
  setting,
}: {
  setting: ISettings;
}) => {
  const fallbackTile = useMemo(
    () => getWatermarkTileMetrics(setting.watermark),
    [
      setting.watermark.width,
      setting.watermark.height,
      setting.watermark.x,
      setting.watermark.y,
    ],
  );
  const [patternUrl, setPatternUrl] = useState('');
  const [tile, setTile] = useState(fallbackTile);

  useEffect(() => {
    let disposed = false;

    (async () => {
      const result = await createWatermarkPattern(
        setting.watermark,
        getRemoteImageUrl,
      );

      if (disposed) {
        return;
      }

      setPatternUrl(result.patternUrl);
      setTile(result.tile);
    })();

    return () => {
      disposed = true;
    };
  }, [
    setting.watermark.enable,
    setting.watermark.type,
    setting.watermark.rotate,
    setting.watermark.opacity,
    setting.watermark.width,
    setting.watermark.height,
    setting.watermark.x,
    setting.watermark.y,
    setting.watermark.text?.content,
    setting.watermark.text?.fontSize,
    setting.watermark.text?.color,
    setting.watermark.image?.src,
  ]);

  const style = useMemo<CSSProperties>(
    () => buildStaticWatermarkLayerStyle({
      enable: setting.watermark.enable,
      patternUrl,
      tile,
    }) as CSSProperties,
    [setting.watermark.enable, patternUrl, tile],
  );

  return (
    <div
      aria-hidden='true'
      className='export-image-static-watermark'
      style={style}
    ></div>
  );
};

export default StaticWatermark;
