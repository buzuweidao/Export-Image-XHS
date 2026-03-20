import {
  Notice, Platform, requestUrl, type App, type TFile,
} from 'obsidian';
import saveAs from 'file-saver';
import JsPdf from 'jspdf';
import JSZip from 'jszip';
import domtoimage from '../dom-to-image-more';
import L from '../L';
import makeHTML from './makeHTML';
import { fileToBase64, delay, getMime } from '.';
import { sanitizeCaptureClassName } from './previewSelection.js';
import { getElementMeasures } from './split';
import { isPagedSplitMode } from './splitMode.js';
import {
  getCaptureContentHeight,
  getPagedBodyCloneStyle,
} from './pagedCaptureModel.js';
import { buildCaptureSplitModel } from './captureSplitModel.js';
import { getPagedCaptureShellClassName } from './pagedCaptureShellModel.js';
import { buildPagedCaptureLayerPlan } from './pagedCaptureLayerModel.js';

async function getBlob(el: HTMLElement, resolutionMode: ResolutionMode, type: string): Promise<Blob> {
  const scale = resolutionMode === '2x' ? 2 : resolutionMode === '3x' ? 3 : resolutionMode === '4x' ? 4 : 1;
  return domtoimage.toBlob(el, {
    width: el.clientWidth,
    height: el.clientHeight,
    quality: 0.85,
    scale: scale,
    requestUrl,
    type,
  }) as Promise<Blob>;
}

async function makePdf(blob: Blob, el: HTMLElement) {
  const dataUrl = await fileToBase64(blob);
  const pdf = new JsPdf({
    unit: 'in',
    format: [el.clientWidth / 96, el.clientHeight / 96],
    orientation: el.clientWidth > el.clientHeight ? 'l' : 'p',
    compress: true,
  });
  pdf.addImage(
    dataUrl,
    'JPEG',
    0,
    0,
    el.clientWidth / 96,
    el.clientHeight / 96,
  );
  return pdf;
}

async function saveToVault(app: App, blob: Blob, filename: string) {
  const filePath = await app.fileManager.getAvailablePathForAttachment(filename);
  await app.vault.createBinary(filePath, await blob.arrayBuffer());
  return filePath;
}

function cloneForCapture(el: HTMLElement) {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.className = sanitizeCaptureClassName(clone.className);
  clone.querySelectorAll('.is-selected').forEach(node => {
    if (node instanceof HTMLElement) {
      node.className = sanitizeCaptureClassName(node.className);
    }
  });
  clone.querySelectorAll('[data-export-control="true"]').forEach(node => node.remove());
  clone.classList.add('export-image-hidden');
  clone.style.pointerEvents = 'none';
  document.body.append(clone);
  return clone;
}

export async function save(
  app: App,
  el: HTMLElement,
  title: string,
  resolutionMode: ResolutionMode,
  format: FileFormat,
  isMobile: boolean,
) {
  const blob: Blob = await getBlob(
    el,
    resolutionMode,
    getMime(format),
  );
  const filename = `${title.replaceAll(/\s+/g, '_')}.${format.replace(/\d$/, '')}`;
  switch (format) {
    case 'jpg':
    case 'webp':
    case 'png0':
    case 'png1': {
      if (isMobile) {
        const filePath = await app.fileManager.getAvailablePathForAttachment(
          filename,
        );
        await app.vault.createBinary(filePath, await blob.arrayBuffer());
        new Notice(L.saveSuccess({ filePath }));
      } else {
        saveAs(blob, filename);
      }

      break;
    }

    case 'pdf': {
      const pdf = await makePdf(blob, el);
      if (isMobile) {
        const filePath = await app.fileManager.getAvailablePathForAttachment(
          filename,
        );
        await app.vault.createBinary(filePath, pdf.output('arraybuffer'));
        new Notice(L.saveSuccess({ filePath }));
      } else {
        pdf.save(filename);
      }

      break;
    }
  }
}

export async function copy(
  el: HTMLElement,
  resolutionMode: ResolutionMode,
  format: FileFormat,
) {
  if (format === 'pdf') {
    new Notice(L.copyNotAllowed());
    return;
  }

  const blob = await getBlob(
    el,
    resolutionMode,
    getMime(format),
  );
  const data: ClipboardItem[] = [];
  data.push(
    new ClipboardItem({
      [blob.type]: blob,
    }),
  );
  await navigator.clipboard.write(data);
  new Notice(L.copiedSuccess());
}

export async function savePageElements(
  elements: HTMLElement[],
  format: FileFormat,
  resolutionMode: ResolutionMode,
  app: App,
  title: string,
) {
  const pageElements = elements.filter(Boolean);
  if (pageElements.length === 0) {
    return;
  }

  if (format === 'pdf') {
    let pdf: JsPdf | undefined;

    for (const pageElement of pageElements) {
      const captureElement = cloneForCapture(pageElement);
      const blob = await getBlob(
        captureElement,
        resolutionMode,
        'image/jpeg',
      );
      const dataUrl = await fileToBase64(blob);

      if (!pdf) {
        pdf = new JsPdf({
          unit: 'in',
          format: [captureElement.clientWidth / 96, captureElement.clientHeight / 96],
          orientation: captureElement.clientWidth > captureElement.clientHeight ? 'l' : 'p',
          compress: true,
        });
      } else {
        pdf.addPage(
          [captureElement.clientWidth / 96, captureElement.clientHeight / 96],
          captureElement.clientWidth > captureElement.clientHeight ? 'l' : 'p',
        );
      }

      pdf.addImage(
        dataUrl,
        'JPEG',
        0,
        0,
        captureElement.clientWidth / 96,
        captureElement.clientHeight / 96,
      );
      captureElement.remove();
    }

    const filename = `${title.replaceAll(/\s+/g, '_')}.pdf`;
    if (Platform.isMobile) {
      const filePath = await saveToVault(app, new Blob([pdf!.output('arraybuffer')]), filename);
      new Notice(L.saveSuccess({ filePath }));
    } else {
      pdf?.save(filename);
    }
    return;
  }

  const ext = format.replace(/\d$/, '');
  const zip = new JSZip();
  const blobs: { blob: Blob; filename: string }[] = [];

  for (let index = 0; index < pageElements.length; index++) {
    const captureElement = cloneForCapture(pageElements[index]);
    const blob = await getBlob(captureElement, resolutionMode, getMime(format));
    blobs.push({
      blob,
      filename: `${title.replaceAll(/\s+/g, '_')}_${index + 1}.${ext}`,
    });
    captureElement.remove();
  }

  if (Platform.isMobile) {
    for (const { blob, filename } of blobs) {
      const filePath = await saveToVault(app, blob, filename);
      new Notice(L.saveSuccess({ filePath }));
    }
    return;
  }

  for (const { blob, filename } of blobs) {
    zip.file(filename, blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `${title.replaceAll(/\s+/g, '_')}.zip`);
}

export async function saveMultipleFiles(
  files: TFile[],
  settings: ISettings,
  onProgress: (finished: number) => void,
  app: App,
  folderName: string,
  containner: HTMLDivElement,
) {
  let finished = 0;
  const { format, resolutionMode } = settings;
  const blobs: { blob: Blob; filename: string }[] = [];

  for (const file of files) {
    const el = await makeHTML(file, settings, app, containner) as HTMLElement;
    await delay(20);

    const target = {
      element: el,
      contentElement: el,
      setClip: (startY: number, height: number) => {
        el.style.height = `${height}px`;
        el.style.overflow = 'hidden';
        el.style.transform = `translateY(-${startY}px)`;
      },
      resetClip: () => {
        el.style.height = '';
        el.style.overflow = '';
        el.style.transform = '';
      },
    };

    await saveAll(
      target,
      settings,
      format,
      resolutionMode,
      app,
      file.basename,
    );

    finished++;
    onProgress(finished);
  }
}

export async function getRemoteImageUrl(url?: string) {
  if (!url || !url.startsWith('http')) {
    return url;
  }
  try {
    const response = await requestUrl({
      url,
      method: 'GET',
    });
    const blob = new Blob([response.arrayBuffer], { type: response.headers['content-type'] || 'application/octet-stream' });
    const res = URL.createObjectURL(blob);
    return res;
  } catch (error) {
    console.error('Failed to load image:', error);
    return url;
  }
}

export async function saveAll(
  target: { element: HTMLElement; contentElement: HTMLElement; setClip: (startY: number, height: number) => void; resetClip: () => void },
  settings: ISettings,
  format: FileFormat,
  resolutionMode: ResolutionMode,
  app: App,
  title: string,
) {
  try {
    const { split } = settings;
    const rootElement = target.contentElement;
    const bodyElement = rootElement.querySelector('.export-image-preview-container') as HTMLElement | null;
    const authorElement = rootElement.querySelector('.user-info-container') as HTMLElement | null;
    const watermarkElement = rootElement.querySelector('.export-image-static-watermark') as HTMLElement | null;
    const bodyTarget = bodyElement || rootElement;
    const authorHeight = (
      settings.authorInfo.show
      && settings.authorInfo.position === 'top'
      && authorElement
    ) ? authorElement.clientHeight : 0;

    const totalHeight = getCaptureContentHeight(bodyTarget);
    const elements = getElementMeasures(bodyTarget, split.mode);
    const {
      splitPositions,
      pageHeight,
    } = buildCaptureSplitModel({
      setting: settings,
      totalHeight,
      authorHeight,
      elements,
    });

    const createPageCaptureElement = (startY: number, pageIndex: number, viewportHeight: number) => {
      const layerPlan = buildPagedCaptureLayerPlan({
        pageIndex,
        authorHeight,
        hasAuthorElement: Boolean(authorElement),
        hasWatermarkElement: Boolean(watermarkElement),
      });
      const pageEl = document.createElement('div');
      pageEl.className = getPagedCaptureShellClassName(rootElement.className);
      pageEl.style.width = `${target.element.clientWidth}px`;
      pageEl.style.height = `${pageHeight}px`;
      pageEl.style.position = layerPlan.shellPosition;
      pageEl.style.overflow = 'hidden';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.background = getComputedStyle(target.contentElement).background;
      pageEl.style.pointerEvents = 'none';

      if (layerPlan.includeAuthor && authorElement) {
        pageEl.append(authorElement.cloneNode(true));
      }

      const viewportEl = document.createElement('div');
      viewportEl.style.height = `${Math.max(1, viewportHeight)}px`;
      viewportEl.style.overflow = 'hidden';
      viewportEl.style.position = 'relative';

      const bodyClone = bodyTarget.cloneNode(true) as HTMLElement;
      Object.assign(bodyClone.style, getPagedBodyCloneStyle(startY));
      bodyClone.querySelectorAll('.export-image-split-line').forEach(line => line.remove());
      viewportEl.append(bodyClone);
      pageEl.append(viewportEl);
      if (layerPlan.includeWatermark && watermarkElement) {
        pageEl.append(watermarkElement.cloneNode(true));
      }
      document.body.append(pageEl);
      return pageEl;
    };

    if (format === 'pdf') {
      // PDF 格式：创建多页 PDF
      let pdf: JsPdf | undefined;

      for (let pageIndex = 0; pageIndex < splitPositions.length; pageIndex++) {
        const { startY, height } = splitPositions[pageIndex];
        const captureHeight = isPagedSplitMode(split.mode) ? pageHeight : height;
        const captureElement = isPagedSplitMode(split.mode)
          ? createPageCaptureElement(startY, pageIndex, height)
          : target.element;

        if (!isPagedSplitMode(split.mode)) {
          target.setClip(startY, height);
          await delay(20);
        }

        const blob = await getBlob(
          captureElement,
          resolutionMode,
          'image/jpeg',
        );
        const dataUrl = await fileToBase64(blob);

        if (!pdf) {
          pdf = new JsPdf({
            unit: 'in',
            format: [captureElement.clientWidth / 96, captureHeight / 96],
            orientation: captureElement.clientWidth > captureHeight ? 'l' : 'p',
            compress: true,
          });
        } else {
          pdf.addPage([captureElement.clientWidth / 96, captureHeight / 96], captureElement.clientWidth > captureHeight ? 'l' : 'p');
        }

        pdf.addImage(dataUrl, 'JPEG', 0, 0, captureElement.clientWidth / 96, captureHeight / 96);
        if (captureElement !== target.element) {
          captureElement.remove();
        }
      }

      const filename = `${title.replaceAll(/\s+/g, '_')}.pdf`;
      if (Platform.isMobile) {
        const filePath = await saveToVault(app, new Blob([pdf!.output('arraybuffer')]), filename);
        new Notice(L.saveSuccess({ filePath }));
      } else {
        pdf?.save(filename);
      }
    } else {
      // 其他图片格式：分别保存每个部分
      const ext = format.replace(/\d$/, '');
      const zip = new JSZip();
      const blobs: { blob: Blob; filename: string }[] = [];

      for (let i = 0; i < splitPositions.length; i++) {
        const { startY, height } = splitPositions[i];
        const captureElement = isPagedSplitMode(split.mode)
          ? createPageCaptureElement(startY, i, height)
          : target.element;

        if (!isPagedSplitMode(split.mode)) {
          target.setClip(startY, height);
          await delay(20);
        }

        const blob = await getBlob(captureElement, resolutionMode, getMime(format));
        const filename = `${title.replaceAll(/\s+/g, '_')}_${i + 1}.${ext}`;
        blobs.push({ blob, filename });
        if (captureElement !== target.element) {
          captureElement.remove();
        }
      }

      if (Platform.isMobile) {
        // 在移动端直接保存到 vault
        for (const { blob, filename } of blobs) {
          const filePath = await saveToVault(app, blob, filename);
          new Notice(L.saveSuccess({ filePath }));
        }
      } else {
        // 在桌面端创建 zip
        for (const { blob, filename } of blobs) {
          zip.file(filename, blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `${title.replaceAll(/\s+/g, '_')}.zip`);
      }
    }
  } finally {
    // 确保无论成功还是失败都恢复原始状态
    target.resetClip();
  }
}
