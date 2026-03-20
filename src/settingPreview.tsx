import React, { type FC, useEffect, useRef } from 'react';
import { type App, MarkdownRenderChild, MarkdownRenderer } from 'obsidian';
import { createRoot } from 'react-dom/client';
import StaticWatermark from './components/common/StaticWatermark';

const Preview: FC<{ setting: ISettings; el: HTMLDivElement }> = ({
  setting,
  el,
}) => {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    container.current?.append(el);
  });

  return (
    <div className='export-image-setting-preview-surface'>
      <div
        className='markdown-preview-view markdown-rendered export-image-setting-preview-mock'
        ref={container}
      ></div>
      <StaticWatermark setting={setting}></StaticWatermark>
    </div>
  );
};

export const renderPreview = async (root: HTMLElement, app: App) => {
  const element = createDiv();
  await MarkdownRenderer.render(
    app,
    [
      '# test markdown',
      'some content...\n',
      'some content...\n',
      'some content...\n',
      'some content...\n',
    ].join('\n'),
    element,
    '/',
    new MarkdownRenderChild(element),
  );
  const r = createRoot(root);
  return (setting: ISettings) => {
    r.render(<Preview setting={setting} el={element}></Preview>);
  };
};
