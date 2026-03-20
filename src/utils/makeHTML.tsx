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
  const renderChild = new MarkdownRenderChild(element);
  await MarkdownRenderer.render(
    app,
    markdown,
    element,
    file.path,
    app.workspace.getActiveViewOfType(MarkdownView) || renderChild,
  );
  renderChild.unload();

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
