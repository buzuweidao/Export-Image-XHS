import {
  Notice, Platform, requestUrl, type App, type TFile,
} from 'obsidian';
import saveAs from 'file-saver';
import JsPdf from 'jspdf';
import JSZip from 'jszip';
import domtoimage from 'dom-to-image-more';
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

export type SaveProgressPhase = 'selecting' | 'preparing' | 'rendering' | 'writing';
export type SaveProgress = {
  phase: SaveProgressPhase;
  current?: number;
  total?: number;
};
type DesktopSaveTarget =
  | { kind: 'path'; filePath: string }
  | {
    kind: 'handle';
    fileHandle: {
      createWritable: () => Promise<{
        write: (data: Blob | ArrayBuffer | Uint8Array | string) => Promise<void>;
        close: () => Promise<void>;
      }>;
    };
  };

/**
 * 将元素中的 app:// 图片转为 base64 data URL。
 * 优先用 fetch 读取原始字节（无损），失败时回退 canvas。
 */
async function convertLoadedImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  const tasks = images.map(async img => {
    if (!img.src || img.src.startsWith('data:')) {
      return;
    }

    // 方式1：requestUrl 读取原始文件（无损）
    try {
      const response = await requestUrl({ url: img.src });
      const blob = new Blob([response.arrayBuffer], { type: response.headers['content-type'] || 'image/png' });
      const dataUrl = await fileToBase64(blob);
      img.src = dataUrl;
      return;
    } catch {
      // requestUrl 不支持此协议，回退 canvas
    }

    // 方式2：canvas 绘制（可能有轻微质量损失）
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          img.src = canvas.toDataURL('image/png');
        }
      } catch {
        // 静默降级
      }
    }
  });
  await Promise.allSettled(tasks);
}

async function getBlob(el: HTMLElement, resolutionMode: ResolutionMode, type: string): Promise<Blob> {
  const scale = resolutionMode === '2x' ? 2 : resolutionMode === '3x' ? 3 : resolutionMode === '4x' ? 4 : 1;
  return domtoimage.toBlob(el, {
    width: el.clientWidth,
    height: el.clientHeight,
    quality: 0.85,
    scale: scale,
    requestUrl,
    type,
  });
}

async function flushProgressPaint() {
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}

async function yieldToBrowser(delayMs = 16) {
  await new Promise<void>(resolve => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    }, delayMs);
  });
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

function isPickerAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function getRuntimeRequire() {
  const runtime = globalThis as typeof globalThis & {
    require?: (id: string) => unknown;
  };

  if (typeof require === 'function') {
    return require;
  }

  return runtime.require;
}

function getElectronBridge() {
  const runtime = globalThis as typeof globalThis & {
    electron?: {
      dialog?: {
        showSaveDialog?: (
          browserWindow: unknown,
          options: {
            defaultPath: string;
            filters?: Array<{ name: string; extensions: string[] }>;
          },
        ) => Promise<{ canceled: boolean; filePath?: string }>;
      };
      remote?: {
        dialog?: {
          showSaveDialog?: (
            browserWindow: unknown,
            options: {
              defaultPath: string;
              filters?: Array<{ name: string; extensions: string[] }>;
            },
          ) => Promise<{ canceled: boolean; filePath?: string }>;
        };
        getCurrentWindow?: () => unknown;
      };
    };
    electronWindow?: unknown;
  };

  try {
    return runtime.electron ?? getRuntimeRequire()?.('electron') as typeof runtime.electron | undefined;
  } catch {
    return runtime.electron;
  }
}

async function showDesktopSavePicker(
  filename: string,
  accept: Record<string, string[]>,
) : Promise<DesktopSaveTarget | null | undefined> {
  const electronBridge = getElectronBridge();
  const electronDialog = electronBridge?.dialog ?? electronBridge?.remote?.dialog;
  const electronWindow = (globalThis as typeof globalThis & {
    electronWindow?: unknown;
  }).electronWindow ?? electronBridge?.remote?.getCurrentWindow?.();
  const filters = Object.entries(accept).map(([name, extensions]) => ({
    name,
    extensions: extensions.map(extension => extension.replace(/^\./, '')),
  }));

  if (electronDialog?.showSaveDialog) {
    const result = await electronDialog.showSaveDialog(electronWindow, {
      defaultPath: filename,
      filters,
    });
    if (result.canceled) {
      return null;
    }

    if (result.filePath) {
      return {
        kind: 'path',
        filePath: result.filePath,
      };
    }
  }

  const picker = (globalThis as typeof globalThis & {
    showSaveFilePicker?: (options: {
      suggestedName: string;
      types: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob | ArrayBuffer | Uint8Array | string) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  }).showSaveFilePicker;

  if (!picker) {
    return undefined;
  }

  try {
    const fileHandle = await picker({
      suggestedName: filename,
      types: [{
        description: 'Export Image XHS',
        accept,
      }],
    });
    return {
      kind: 'handle',
      fileHandle,
    };
  } catch (error) {
    if (isPickerAbort(error)) {
      return null;
    }

    throw error;
  }
}

async function writeWithPicker(
  fileHandle: Awaited<ReturnType<typeof showDesktopSavePicker>>,
  data: Blob | ArrayBuffer | Uint8Array | string,
) {
  if (!fileHandle) {
    return false;
  }

  if (fileHandle.kind === 'path') {
    try {
      const fs = getRuntimeRequire()?.('node:fs/promises') as {
        writeFile?: (path: string, content: Uint8Array | string) => Promise<void>;
      } | undefined;
      if (!fs?.writeFile) {
        return false;
      }

      let content: Uint8Array | string;
      if (typeof data === 'string') {
        content = data;
      } else if (data instanceof Uint8Array) {
        content = data;
      } else if (data instanceof ArrayBuffer) {
        content = new Uint8Array(data);
      } else {
        content = new Uint8Array(await data.arrayBuffer());
      }

      await fs.writeFile(fileHandle.filePath, content);
      return true;
    } catch {
      return false;
    }
  }

  const writable = await fileHandle.fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
  return true;
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
  clone.setCssProps({
    'pointer-events': 'none',
  });
  document.body.append(clone);
  return clone;
}

function cloneCaptureNode(el: HTMLElement) {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.className = sanitizeCaptureClassName(clone.className);
  clone.querySelectorAll('.is-selected').forEach(node => {
    if (node instanceof HTMLElement) {
      node.className = sanitizeCaptureClassName(node.className);
    }
  });
  clone.querySelectorAll('[data-export-control="true"]').forEach(node => node.remove());
  return clone;
}

export async function save(
  app: App,
  el: HTMLElement,
  title: string,
  resolutionMode: ResolutionMode,
  format: FileFormat,
  isMobile: boolean,
  onProgress?: (progress: SaveProgress) => void,
) {
  const filename = `${title.replaceAll(/\s+/g, '_')}.${format.replace(/\d$/, '')}`;
  onProgress?.({ phase: 'selecting' });
  const desktopPicker = !isMobile
    ? await showDesktopSavePicker(filename, format === 'pdf'
      ? { 'application/pdf': ['.pdf'] }
      : { [getMime(format)]: [`.${format.replace(/\d$/, '')}`] })
    : undefined;
  if (desktopPicker === null) {
    return;
  }

  onProgress?.({ phase: 'preparing' });
  await flushProgressPaint();
  onProgress?.({ phase: 'rendering', current: 1, total: 1 });
  await flushProgressPaint();
  await yieldToBrowser();
  const captureRoot = cloneForCapture(el);

  try {
    await convertLoadedImages(captureRoot);
    await yieldToBrowser();
    const blob: Blob = await getBlob(
      captureRoot,
      resolutionMode,
      getMime(format),
    );
    await yieldToBrowser(8);
  switch (format) {
    case 'jpg':
    case 'webp':
    case 'png0':
    case 'png1': {
      if (isMobile) {
        const filePath = await app.fileManager.getAvailablePathForAttachment(
          filename,
        );
        onProgress?.({ phase: 'writing', current: 1, total: 1 });
        await flushProgressPaint();
        await app.vault.createBinary(filePath, await blob.arrayBuffer());
        new Notice(L.saveSuccess({ filePath }));
      } else {
        onProgress?.({ phase: 'writing', current: 1, total: 1 });
        await flushProgressPaint();
        const saved = await writeWithPicker(desktopPicker, blob);
        if (!saved && desktopPicker === undefined) {
          saveAs(blob, filename);
        }
      }

      break;
    }

    case 'pdf': {
      onProgress?.({ phase: 'rendering', current: 1, total: 1 });
      const pdf = await makePdf(blob, captureRoot);
      if (isMobile) {
        const filePath = await app.fileManager.getAvailablePathForAttachment(
          filename,
        );
        onProgress?.({ phase: 'writing', current: 1, total: 1 });
        await flushProgressPaint();
        await app.vault.createBinary(filePath, pdf.output('arraybuffer'));
        new Notice(L.saveSuccess({ filePath }));
      } else {
        const pdfBuffer = pdf.output('arraybuffer');
        onProgress?.({ phase: 'writing', current: 1, total: 1 });
        await flushProgressPaint();
        const saved = await writeWithPicker(desktopPicker, pdfBuffer);
        if (!saved && desktopPicker === undefined) {
          pdf.save(filename);
        }
      }

      break;
    }
  }
  } finally {
    captureRoot.remove();
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

  await convertLoadedImages(el);
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
  const zipFilename = `${title.replaceAll(/\s+/g, '_')}.zip`;
  const desktopPicker = await showDesktopSavePicker(zipFilename, {
    'application/zip': ['.zip'],
  });
  if (desktopPicker === null) {
    return;
  }
  const saved = await writeWithPicker(desktopPicker, zipBlob);
  if (!saved && desktopPicker === undefined) {
    saveAs(zipBlob, zipFilename);
  }
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

  for (const file of files) {
    const el = await makeHTML(file, settings, app, containner) as HTMLElement;
    await delay(20);

    const target = {
      element: el,
      contentElement: el,
      setClip: (startY: number, height: number) => {
        el.setCssProps({
          height: `${height}px`,
          overflow: 'hidden',
          transform: `translateY(-${startY}px)`,
        });
      },
      resetClip: () => {
        el.setCssProps({
          height: '',
          overflow: '',
          transform: '',
        });
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
  onProgress?: (progress: SaveProgress) => void,
) {
  try {
    const desktopFilename = format === 'pdf'
      ? `${title.replaceAll(/\s+/g, '_')}.pdf`
      : `${title.replaceAll(/\s+/g, '_')}.zip`;
    onProgress?.({ phase: 'selecting' });
    const desktopPicker = !Platform.isMobile
      ? await showDesktopSavePicker(desktopFilename, format === 'pdf'
        ? { 'application/pdf': ['.pdf'] }
        : { 'application/zip': ['.zip'] })
      : undefined;
    if (desktopPicker === null) {
      return;
    }
    onProgress?.({ phase: 'preparing' });
    await flushProgressPaint();
    const { split } = settings;
    const captureRootElement = cloneForCapture(target.contentElement);

    try {
      // 在离屏副本中将已加载的 app:// 图片转为 base64，避免阻塞当前预览重绘
      await convertLoadedImages(captureRootElement);

      const bodyElement = captureRootElement.querySelector<HTMLElement>('.export-image-preview-container');
      const authorElement = captureRootElement.querySelector<HTMLElement>('.user-info-container');
      const watermarkElement = captureRootElement.querySelector<HTMLElement>('.export-image-static-watermark');
      const bodyTarget = bodyElement || captureRootElement;
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
        pageEl.className = getPagedCaptureShellClassName(captureRootElement.className);
        pageEl.setCssProps({
          width: `${captureRootElement.clientWidth}px`,
          height: `${pageHeight}px`,
          position: layerPlan.shellPosition,
          overflow: 'hidden',
          'box-sizing': 'border-box',
          'pointer-events': 'none',
        });
        pageEl.style.background = getComputedStyle(captureRootElement).background;

        if (layerPlan.includeAuthor && authorElement) {
          pageEl.append(authorElement.cloneNode(true));
        }

        const viewportEl = document.createElement('div');
        viewportEl.setCssProps({
          height: `${Math.max(1, viewportHeight)}px`,
          overflow: 'hidden',
          position: 'relative',
        });

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

      const createClippedRootCaptureElement = (startY: number, height: number) => {
        const clipEl = document.createElement('div');
        clipEl.className = 'export-image-hidden';
        clipEl.setCssProps({
          width: `${captureRootElement.clientWidth}px`,
          height: `${Math.max(1, height)}px`,
          overflow: 'hidden',
          'pointer-events': 'none',
        });

        const rootClone = cloneCaptureNode(captureRootElement);
        rootClone.setCssProps({
          transform: `translateY(-${startY}px)`,
        });

        clipEl.append(rootClone);
        document.body.append(clipEl);
        return clipEl;
      };

      if (format === 'pdf') {
      // PDF 格式：创建多页 PDF
        let pdf: JsPdf | undefined;

        for (let pageIndex = 0; pageIndex < splitPositions.length; pageIndex++) {
          onProgress?.({
            phase: 'rendering',
            current: pageIndex + 1,
            total: splitPositions.length,
          });
          await flushProgressPaint();
          await yieldToBrowser();
          const { startY, height } = splitPositions[pageIndex];
          const captureHeight = isPagedSplitMode(split.mode) ? pageHeight : height;
          const captureElement = isPagedSplitMode(split.mode)
            ? createPageCaptureElement(startY, pageIndex, height)
            : createClippedRootCaptureElement(startY, height);

          await yieldToBrowser(8);

          const blob = await getBlob(
            captureElement,
            resolutionMode,
            'image/jpeg',
          );
          await yieldToBrowser(8);
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
          captureElement.remove();
          await yieldToBrowser(8);
        }

        const filename = `${title.replaceAll(/\s+/g, '_')}.pdf`;
        if (Platform.isMobile) {
          const filePath = await saveToVault(app, new Blob([pdf!.output('arraybuffer')]), filename);
          new Notice(L.saveSuccess({ filePath }));
        } else {
          const pdfBuffer = pdf?.output('arraybuffer');
          onProgress?.({ phase: 'writing', total: splitPositions.length });
          await flushProgressPaint();
          const saved = pdfBuffer ? await writeWithPicker(desktopPicker, pdfBuffer) : false;
          if (!saved && desktopPicker === undefined) {
            pdf?.save(filename);
          }
        }
      } else {
      // 其他图片格式：分别保存每个部分
        const ext = format.replace(/\d$/, '');
        const zip = new JSZip();
        const blobs: { blob: Blob; filename: string }[] = [];

        for (let i = 0; i < splitPositions.length; i++) {
          onProgress?.({
            phase: 'rendering',
            current: i + 1,
            total: splitPositions.length,
          });
          await flushProgressPaint();
          await yieldToBrowser();
          const { startY, height } = splitPositions[i];
          const captureElement = isPagedSplitMode(split.mode)
            ? createPageCaptureElement(startY, i, height)
            : createClippedRootCaptureElement(startY, height);

          await yieldToBrowser(8);

          const blob = await getBlob(captureElement, resolutionMode, getMime(format));
          await yieldToBrowser(8);
          const filename = `${title.replaceAll(/\s+/g, '_')}_${i + 1}.${ext}`;
          blobs.push({ blob, filename });
          captureElement.remove();
          await yieldToBrowser(8);
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
          const zipFilename = `${title.replaceAll(/\s+/g, '_')}.zip`;
          onProgress?.({ phase: 'writing', total: splitPositions.length });
          await flushProgressPaint();
          const saved = await writeWithPicker(desktopPicker, zipBlob);
          if (!saved && desktopPicker === undefined) {
            saveAs(zipBlob, zipFilename);
          }
        }
      }
    } finally {
      captureRootElement.remove();
    }
  } finally {
    // 确保无论成功还是失败都恢复原始状态
    target.resetClip();
  }
}
