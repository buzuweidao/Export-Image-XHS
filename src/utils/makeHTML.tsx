import {
  type App,
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  type TFile,
} from 'obsidian';
import React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import Target from 'src/components/common/Target';
import { delay, getMetadata } from '.';
import { waitForEmbeds, waitForImages, convertImagesToBase64 } from './processImages';

let root: Root | undefined;

export default async function makeHTML(
  file: TFile,
  settings: ISettings,
  app: App,
  container: HTMLElement,
) {
  if (root) {
    root.unmount();
    await delay(20);
    container.empty();
  }

  const markdown = await app.vault.cachedRead(file);
  const element = document.createElement('div');

  // 临时挂载到 DOM，Obsidian 嵌入后处理器需要元素在 DOM 中
  element.setCssProps({
    position: 'fixed',
    top: '-99999px',
    left: '-99999px',
    visibility: 'hidden',
    'pointer-events': 'none',
  });
  document.body.appendChild(element);

  const renderChild = new MarkdownRenderChild(element);
  await MarkdownRenderer.render(
    app,
    markdown,
    element,
    file.path,
    app.workspace.getActiveViewOfType(MarkdownView) || renderChild,
  );

  await waitForEmbeds(element);
  await waitForImages(element);
  await convertImagesToBase64(element, app, file.path);
  renderChild.unload();

  // 清理临时挂载
  element.remove();
  element.setCssProps({
    position: '',
    top: '',
    left: '',
    visibility: '',
    'pointer-events': '',
  });

  const metadataMap = app.metadataCache.getAllPropertyInfos() as Record<string, { type: MetadataType }>;

  const frontmatter = getMetadata(file, app);

  root = createRoot(container);
  root.render(
    <Target
      frontmatter={frontmatter}
      setting={settings}
      title={file.basename}
      markdownEl={element}
      app={app}
      metadataMap={metadataMap}
      isProcessing
    />,
  );
  await delay(100);
  return (element).closest('.export-image-root') || element;
}
