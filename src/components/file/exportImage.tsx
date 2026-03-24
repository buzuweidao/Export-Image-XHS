import React from 'react';
import {
  type App,
  type FrontMatterCache,
  MarkdownRenderChild,
  MarkdownRenderer,
  MarkdownView,
  Modal,
  Notice,
  type TFile,
} from 'obsidian';
import { createRoot } from 'react-dom/client';
import L from '../../L';
import ModalContent from './ModalContent';
import { preprocessMarkdown } from 'src/utils/preprocessMarkdown';
import Target from '../common/Target';
import { delay } from 'src/utils';
import { copy } from 'src/utils/capture';
import { waitForEmbeds, waitForImages, convertImagesToBase64 } from 'src/utils/processImages';

export default async function (
  app: App,
  settings: ISettings,
  markdown: string,
  file: TFile,
  frontmatter: FrontMatterCache | undefined,
  type: 'file' | 'selection',
) {
  // 创建元素和模态框先
  const el = document.createElement('div');
  const skipConfig = type === 'selection' && settings.quickExportSelection;
  
  // 如果是快速导出，创建隐藏的div元素进行处理
  if (skipConfig) {
    const div = createDiv();
    div.setCssProps({
      width: `${settings.width || 400}px`,
      position: 'fixed',
      top: '9999px',
      left: '9999px',
    });
    document.body.appendChild(div);
    const root = createRoot(div);
    root.render(
      <Target
        isProcessing={true}
        markdownEl={el}
        setting={{ ...settings, showMetadata: false, showFilename: false, split: { overlap: 0, height: 0, mode: 'none' } }}
        frontmatter={{}}
        title={file.basename}
        metadataMap={{}}
        app={app}
      />,
    );
    
    // 先打开模态框，再加载内容
    await loadDocumentContent(app, el, markdown, file, frontmatter);
    
    try {
      await copy(div.querySelector('.export-image-root')!, settings.resolutionMode, settings.format);
    } catch (e) {
      console.error(e);
      new Notice(L.copyFail());
    } finally {
      root.unmount();
      div.remove();
    }
  }
  else {
    // 先创建模态框并显示加载状态
    const modal = new Modal(app);
    modal.setTitle(L.imageExportPreview());
    modal.modalEl.setCssProps({
      width: '85vw',
      'max-width': '1500px',
    });
    modal.open();
    const root = createRoot(modal.contentEl);
    
    const metadataMap = app.metadataCache.getAllPropertyInfos() as Record<string, { type: MetadataType }>;
    
    // 渲染组件，组件内部会处理loading状态
    root.render(
      <ModalContent
        markdownEl={el}
        settings={settings}
        frontmatter={frontmatter}
        title={file.basename}
        metadataMap={metadataMap}
        app={app}
      />,
    );
    
    // 异步加载文档内容
    await loadDocumentContent(app, el, markdown, file, frontmatter);
    
    // 发布一个自定义事件，通知内容已加载完成
    const loadedEvent = new CustomEvent("export-image-content-loaded");
    window.document.dispatchEvent(loadedEvent);
    
    modal.onClose = () => {
      root?.unmount();
    };
  }
}

// 提取加载文档内容的函数
async function loadDocumentContent(
  app: App,
  el: HTMLElement,
  markdown: string,
  file: TFile,
  frontmatter: FrontMatterCache | undefined,
) {
  try {
    el.empty();

    // 临时将 el 挂载到 DOM，Obsidian 的嵌入后处理器需要元素在 DOM 中
    el.setCssProps({
      position: 'fixed',
      top: '-99999px',
      left: '-99999px',
      visibility: 'hidden',
      'pointer-events': 'none',
    });
    document.body.appendChild(el);

    const renderChild = new MarkdownRenderChild(el);
    await MarkdownRenderer.render(
      app,
      preprocessMarkdown(markdown, frontmatter),
      el,
      file.path,
      app.workspace.getActiveViewOfType(MarkdownView) || renderChild,
    );

    // 等待 Obsidian 的嵌入后处理器解析图片（不要提前 unload renderChild）
    await waitForEmbeds(el);
    await waitForImages(el);
    await convertImagesToBase64(el, app, file.path);

    renderChild.unload();

    // 从 DOM 中移除并清理临时样式
    el.remove();
    el.setCssProps({
      position: '',
      top: '',
      left: '',
      visibility: '',
      'pointer-events': '',
    });

    await delay(100);
    return el;
  } catch (error) {
    console.error("Error loading document content:", error);
    // 确保清理
    if (el.parentNode) {
      el.remove();
    }
    el.setCssProps({
      position: '',
      top: '',
      left: '',
      visibility: '',
      'pointer-events': '',
    });
    return el;
  }
}
