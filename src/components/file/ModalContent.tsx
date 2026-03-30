import {
  type App, type FrontMatterCache, Notice, Platform,
} from 'obsidian';
import React, {
  useState, useRef, type FC, useEffect, useCallback,
} from 'react';
import {isCopiable} from 'src/imageFormatTester';
import {
  getRecommendedPadding,
  getRecommendedWidth,
  getSplitHeight,
} from 'src/utils/splitMode.js';
import {AUTHOR_FONT_OPTIONS} from 'src/utils/authorInfo';
import {buildPreviewSessionModel} from 'src/utils/previewSessionModel.js';
import {
  copy, save, saveAll,
  type SaveProgress,
} from '../../utils/capture.js';
import L from '../../L.js';
import Target, {type TargetRef} from '../common/Target.js';
import FormItems from '../common/form/FormItems.js';

const formSchema: FormSchema<ISettings> = [
  {
    label: L.includingFilename(),
    path: 'showFilename',
    type: 'boolean',
  },
  {
    label: L.imageWidth(),
    path: 'width',
    type: 'number',
  },
  {
    label: '正文字号',
    path: 'bodyFontSize',
    type: 'number',
  },
  {
    path: 'padding.top',
    label: L.setting.padding.top(),
    desc: L.setting.padding.description(),
    type: 'number',
  },
  {
    path: 'padding.right',
    label: L.setting.padding.right(),
    type: 'number',
  },
  {
    path: 'padding.bottom',
    label: L.setting.padding.bottom(),
    type: 'number',
  },
  {
    path: 'padding.left',
    label: L.setting.padding.left(),
    type: 'number',
  },
  {
    path: 'split.mode',
    label: L.setting.split.mode.label(),
    desc: L.setting.split.mode.description(),
    type: 'select',
    options: [
      {text: L.setting.split.mode.none(), value: 'none'},
      {text: L.setting.split.mode.fixed(), value: 'fixed'},
      {text: L.setting.split.mode.hr(), value: 'hr'},
      {text: L.setting.split.mode.auto(), value: 'auto'},
      {text: '小红书比例（3:4）', value: 'xiaohongshu'},
    ],
  },
  {
    path: 'resolutionMode',
    label: L.setting.resolutionMode.label(),
    desc: L.setting.resolutionMode.description(),
    type: 'select',
    options: [
      {text: '1x', value: '1x'},
      {text: '2x', value: '2x'},
      {text: '3x', value: '3x'},
      {text: '4x', value: '4x'},
    ],
  },
  {
    path: 'split.height',
    desc: L.setting.split.height.description(),
    label: L.setting.split.height.label(),
    type: 'number',
    when: settings => settings.split.mode !== 'none'
      && settings.split.mode !== 'hr'
      && settings.split.mode !== 'xiaohongshu',
  },
  {
    path: 'split.overlap',
    desc: L.setting.split.overlap.description(),
    label: L.setting.split.overlap.label(),
    type: 'number',
    when: settings => settings.split.mode === 'fixed',
  },
  {
    label: L.setting.userInfo.show(),
    path: 'authorInfo.show',
    type: 'boolean',
  },
  {
    label: L.setting.userInfo.name(),
    path: 'authorInfo.name',
    type: 'string',
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: L.setting.userInfo.remark(),
    path: 'authorInfo.remark',
    type: 'string',
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: L.setting.userInfo.avatar.title(),
    desc: L.setting.userInfo.avatar.description(),
    path: 'authorInfo.avatar',
    type: 'file',
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: L.setting.userInfo.badgeStyle.label(),
    path: 'authorInfo.badgeStyle',
    type: 'select',
    options: [
      {text: L.setting.userInfo.badgeStyle.none(), value: 'none'},
      {text: L.setting.userInfo.badgeStyle.x(), value: 'x'},
      {text: L.setting.userInfo.badgeStyle.weibo(), value: 'weibo'},
    ],
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: L.setting.userInfo.weiboLocation(),
    path: 'authorInfo.weiboLocation',
    type: 'string',
    when: (settings: ISettings) => settings.authorInfo.show && settings.authorInfo.badgeStyle === 'weibo',
  },
  {
    label: '头像大小',
    path: 'authorInfo.avatarSize',
    type: 'number',
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: '作者区上边距',
    path: 'authorInfo.paddingTop',
    type: 'number',
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: '作者名字号',
    path: 'authorInfo.nameFontSize',
    type: 'number',
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: '作者名字体',
    path: 'authorInfo.nameFontFamily',
    type: 'select',
    options: AUTHOR_FONT_OPTIONS.map(option => ({text: option.text, value: option.value})),
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: '额外文案字号',
    path: 'authorInfo.remarkFontSize',
    type: 'number',
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: '额外文案字体',
    path: 'authorInfo.remarkFontFamily',
    type: 'select',
    options: AUTHOR_FONT_OPTIONS.map(option => ({text: option.text, value: option.value})),
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: '作者区分隔样式',
    path: 'authorInfo.separator',
    type: 'select',
    options: [
      {text: '无分隔', value: 'none'},
      {text: '细线分隔', value: 'line'},
      {text: '浅色底', value: 'background'},
    ],
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: L.setting.userInfo.align(),
    path: 'authorInfo.align',
    type: 'select',
    options: [
      {text: 'Left', value: 'left'},
      {text: 'Center', value: 'center'},
      {text: 'Right', value: 'right'},
    ],
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: L.setting.userInfo.position(),
    path: 'authorInfo.position',
    type: 'select',
    options: [
      {text: 'Top', value: 'top'},
      {text: 'Bottom', value: 'bottom'},
    ],
    when: {flag: true, path: 'authorInfo.show'},
  },
  {
    label: L.setting.watermark.enable.label(),
    path: 'watermark.enable',
    type: 'boolean',
  },
  {
    label: L.setting.watermark.type.label(),
    path: 'watermark.type',
    type: 'select',
    options: [
      {text: L.setting.watermark.type.text(), value: 'text'},
      {text: L.setting.watermark.type.image(), value: 'image'},
    ],
    when: {flag: true, path: 'watermark.enable'},
  },
  {
    label: L.setting.watermark.text.content(),
    path: 'watermark.text.content',
    type: 'string',
    when: settings =>
      settings.watermark.enable && settings.watermark.type === 'text',
  },
  {
    label: L.setting.watermark.image.src.label(),
    path: 'watermark.image.src',
    type: 'file',
    when: settings =>
      settings.watermark.enable && settings.watermark.type === 'image',
  },
  {
    label: L.setting.watermark.opacity(),
    path: 'watermark.opacity',
    type: 'number',
    when: {flag: true, path: 'watermark.enable'},
  },
  {
    label: L.setting.watermark.rotate(),
    path: 'watermark.rotate',
    type: 'number',
    when: {flag: true, path: 'watermark.enable'},
  },
  {
    label: L.setting.watermark.width(),
    path: 'watermark.width',
    type: 'number',
    when: {flag: true, path: 'watermark.enable'},
  },
  {
    label: L.setting.watermark.height(),
    path: 'watermark.height',
    type: 'number',
    when: {flag: true, path: 'watermark.enable'},
  },
];

const ModalContent: FC<{
  markdownEl: Node;
  settings: ISettings;
  frontmatter: FrontMatterCache | undefined;
  title: string;
  app: App;
  metadataMap: Record<string, {type: MetadataType}>;
}> = ({markdownEl, settings, app, frontmatter, title, metadataMap}) => {
  const [formData, setFormData] = useState<ISettings>(settings);
  const [isLoading, setIsLoading] = useState(true);
  const mainHeight = Math.min(764, (window.innerHeight * 0.85) - 225);
  const root = useRef<TargetRef>(null);
  const exportRoot = useRef<TargetRef>(null);
  const previewSplitHeight = getSplitHeight(formData.split.mode, formData.width, formData.split.height);
  const previousSplitModeRef = useRef<SplitMode | undefined>(settings.split.mode);
  const previousBadgeStyleRef = useRef<string | undefined>(settings.authorInfo?.badgeStyle);
  const [exportMarkdownEl, setExportMarkdownEl] = useState<Node | null>(null);
  const [exportRenderKey, setExportRenderKey] = useState(0);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  // 认证徽章样式联动：切换时自动调整头像大小、字号、额外文案时间格式
  useEffect(() => {
    const currentBadge = formData.authorInfo?.badgeStyle;
    const previousBadge = previousBadgeStyleRef.current;
    previousBadgeStyleRef.current = currentBadge;

    if (currentBadge === previousBadge) return;

    const now = new Date();
    // X/微博都用系统无衬线字体（SF Pro / PingFang SC），匹配原生 App
    const systemFont = '"SF Pro Display", "PingFang SC", sans-serif';
    const defaultFont = '"Anonymous Pro for Powerline", monospace';

    if (currentBadge === 'x') {
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${year}年${month}月${day}日 ${hours}:${minutes}`;
      setFormData(prev => ({
        ...prev,
        authorInfo: {
          ...prev.authorInfo,
          avatarSize: 66,
          nameFontSize: 20,
          remarkFontSize: 18,
          nameFontFamily: systemFont,
          remarkFontFamily: systemFont,
          remark: timeStr,
        },
      }));
    } else if (currentBadge === 'weibo') {
      const year = String(now.getFullYear()).slice(2);
      const month = now.getMonth() + 1;
      const day = now.getDate();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${year}-${month}-${day} ${hours}:${minutes}`;
      setFormData(prev => ({
        ...prev,
        authorInfo: {
          ...prev.authorInfo,
          avatarSize: 66,
          nameFontSize: 20,
          remarkFontSize: 17,
          nameFontFamily: systemFont,
          remarkFontFamily: systemFont,
          remark: timeStr,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        authorInfo: {
          ...prev.authorInfo,
          avatarSize: 88,
          nameFontSize: 25,
          remarkFontSize: 25,
          nameFontFamily: defaultFont,
          remarkFontFamily: defaultFont,
          remark: '',
        },
      }));
    }
  }, [formData.authorInfo?.badgeStyle]);

  useEffect(() => {
    const previousMode = previousSplitModeRef.current;
    previousSplitModeRef.current = formData.split.mode;

    if (
      formData.split.mode === 'xiaohongshu'
      && previousMode !== formData.split.mode
    ) {
      const recommendedWidth = getRecommendedWidth(formData.split.mode, formData.width);
      const recommendedPadding = getRecommendedPadding(formData.split.mode, formData.padding);
      setFormData({
        ...formData,
        width: recommendedWidth,
        padding: recommendedPadding,
      });
    }
  }, [formData]);

  useEffect(() => {
    if (markdownEl && markdownEl instanceof HTMLElement && markdownEl.innerHTML && markdownEl.innerHTML.length > 0) {
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    }

    const handleContentLoaded = () => {
      setIsLoading(false);
    };

    globalThis.document.addEventListener('export-image-content-loaded', handleContentLoaded);

    return () => {
      globalThis.document.removeEventListener('export-image-content-loaded', handleContentLoaded);
    };
  }, [markdownEl]);

  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<SaveProgress | null>(null);
  const [allowCopy, setAllowCopy] = useState(true);
  const [rootHeight, setRootHeight] = useState(0);
  const [pages, setPages] = useState(1);
  const previewSession = buildPreviewSessionModel({
    splitMode: formData.split.mode,
    pageCount: pages,
  });

  useEffect(() => {
    if (!root.current?.element || processing) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (root.current?.element && !processing) {
        setRootHeight(root.current.element.clientHeight);
      }
    });
    observer.observe(root.current.element);
    return () => {
      observer.disconnect();
    };
  }, [root.current?.element, processing]);

  const handleSplitChange = useCallback((positions: number[]) => {
    setPages(positions.length + 1);
  }, []);

  useEffect(() => {
    if (formData.split.mode === 'none') {
      setPages(1);
    }
  }, [formData.split.mode]);

  useEffect(() => {
    void isCopiable(formData.format).then(result => {
      setAllowCopy(Boolean(result));
    }).catch(() => {
      setAllowCopy(false);
    });
  }, [formData.format]);

  const getProcessingMessage = useCallback((progress: SaveProgress | null) => {
    if (!progress) {
      return '正在处理...';
    }

    if (progress.phase === 'selecting') {
      return '请选择保存位置...';
    }

    if (progress.phase === 'preparing') {
      return '正在准备保存...';
    }

    if (progress.phase === 'writing') {
      return '正在写入文件...';
    }

    if ((progress.total ?? 1) > 1) {
      return `正在生成图片 ${progress.current ?? 1}/${progress.total}...`;
    }

    return '正在生成图片...';
  }, []);

  const getProcessingPercent = useCallback((progress: SaveProgress | null) => {
    if (!progress) {
      return 0;
    }

    if (progress.phase === 'selecting') {
      return 0;
    }

    if (progress.phase === 'preparing') {
      return 8;
    }

    if (progress.phase === 'writing') {
      return 92;
    }

    const total = Math.max(progress.total ?? 1, 1);
    const current = Math.min(progress.current ?? 0, total);
    return Math.min(90, Math.max(12, Math.round((current / total) * 90)));
  }, []);

  const createExportMarkdownSnapshot = useCallback(() => {
    const snapshot = document.createElement('div');
    const previewMarkdown = root.current?.contentElement.querySelector('.export-image-markdown');
    const source = previewMarkdown ?? markdownEl;

    Array.from(source.childNodes).forEach(node => {
      snapshot.append(node.cloneNode(true));
    });

    return snapshot;
  }, [markdownEl]);

  const waitForBackgroundExportReady = useCallback(async () => {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve());
    });
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve());
    });
  }, []);

  const prepareBackgroundExportTarget = useCallback(async () => {
    const exportSnapshot = createExportMarkdownSnapshot();
    setExportMarkdownEl(exportSnapshot);
    setExportRenderKey(key => key + 1);
    await waitForBackgroundExportReady();
    return exportRoot.current;
  }, [createExportMarkdownSnapshot, waitForBackgroundExportReady]);

  const handleSave = useCallback(async () => {
    if ((formData.width || 640) <= 20) {
      new Notice(L.invalidWidth());
      return;
    }

    if (!root.current) {
      return;
    }

    setProcessing(true);
    try {
      setProcessingProgress({ phase: 'selecting' });
      const backgroundTarget = await prepareBackgroundExportTarget();
      if (!backgroundTarget) {
        throw new Error('Background export target is not ready');
      }
      await save(
        app,
        backgroundTarget.contentElement,
        title,
        formData.resolutionMode,
        formData.format,
        Platform.isMobile,
        setProcessingProgress,
      );
    } catch {
      new Notice(L.saveFail());
    } finally {
      setExportMarkdownEl(null);
      setProcessingProgress(null);
      setProcessing(false);
    }
  }, [prepareBackgroundExportTarget, formData.resolutionMode, formData.format, title, formData.width]);
  const handleCopy = useCallback(async () => {
    if ((formData.width || 640) <= 20) {
      new Notice(L.invalidWidth());
      return;
    }

    if (!root.current) {
      return;
    }

    setProcessing(true);
    try {
      await copy(root.current.contentElement, formData.resolutionMode, formData.format);
    } catch {
      new Notice(L.copyFail());
    }

    setProcessing(false);
  }, [root, formData.resolutionMode, formData.format, title, formData.width]);

  const handleSaveAll = useCallback(async () => {
    if ((formData.width || 640) <= 20) {
      new Notice(L.invalidWidth());
      return;
    }

    if (!root.current) {
      return;
    }

    setProcessing(true);
    try {
      setProcessingProgress({ phase: 'selecting' });
      const backgroundTarget = await prepareBackgroundExportTarget();
      if (!backgroundTarget) {
        throw new Error('Background export target is not ready');
      }
      await saveAll(
        backgroundTarget,
        formData,
        formData.format,
        formData.resolutionMode,
        app,
        title,
        setProcessingProgress,
      );
    } catch {
      new Notice(L.saveFail());
    } finally {
      setExportMarkdownEl(null);
      setProcessingProgress(null);
      setProcessing(false);
    }
  }, [prepareBackgroundExportTarget, formData, app, title]);

  const processingPercent = getProcessingPercent(processingProgress);
  const showProcessingOverlay = false;
  const showActionProgress = processing && processingProgress !== null;

  return (
    <div className='export-image-preview-root'>
      {exportMarkdownEl && (
        <div className='export-image-background-stage' aria-hidden='true'>
          <Target
            key={exportRenderKey}
            ref={exportRoot}
            editable={false}
            frontmatter={frontmatter}
            markdownEl={exportMarkdownEl}
            setting={formData}
            metadataMap={metadataMap}
            app={app}
            title={title}
            isProcessing={false}
          ></Target>
        </div>
      )}
      <div className='export-image-preview-main'>
        <div className='export-image-preview-left'>
          <FormItems
            formSchema={formSchema}
            update={setFormData}
            settings={formData}
            app={app}
          />
          {formData.split.mode !== 'none' && formData.split.mode !== 'hr' && <div className='info-text'>
            {L.splitInfo({rootHeight, splitHeight: previewSplitHeight, pages})}
          </div>}
          {formData.split.mode === 'hr' && <div className='info-text'>
            {L.splitInfoHr({rootHeight, pages})}
          </div>}
          <div className='info-text'>{L.moreSetting()}</div>
        </div>
        <div className='export-image-preview-right'>
          <div
            className='export-image-preview-out'
            style={{
              height: mainHeight,
            }}
          >
            {isLoading ? (
              <div className='export-image-loading'>
                <div className='export-image-loading-spinner'></div>
                <div className='export-image-loading-text'>{L.loading()}</div>
              </div>
            ) : (
              <div className='export-image-preview-live-frame'>
                <Target
                  ref={root}
                  editable={previewSession.previewEditable}
                  frontmatter={frontmatter}
                  markdownEl={markdownEl}
                  setting={formData}
                  metadataMap={metadataMap}
                  app={app}
                  title={title}
                  isProcessing={processing}
                  onSplitChange={handleSplitChange}
                ></Target>
                {showProcessingOverlay && (
                  <div className='export-image-processing-overlay'>
                    <div className='export-image-loading-spinner'></div>
                    <div className='export-image-loading-text'>
                      {getProcessingMessage(processingProgress)}
                    </div>
                    <div className='export-image-processing-progress'>
                      <div className='export-image-progress-bar'>
                        <div
                          className='export-image-progress-bar-inner'
                          style={{ width: `${processingPercent}%` }}
                        ></div>
                      </div>
                      <div className='export-image-processing-percent'>
                        {processingPercent}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className='export-image-preview-actions'>
        {showActionProgress && (
          <div className='export-image-action-progress'>
            <div className='export-image-loading-text'>
              {getProcessingMessage(processingProgress)}
            </div>
            {processingProgress?.phase !== 'selecting' && (
              <div className='export-image-processing-progress'>
                <div className='export-image-progress-bar'>
                  <div
                    className='export-image-progress-bar-inner'
                    style={{ width: `${processingPercent}%` }}
                  ></div>
                </div>
                <div className='export-image-processing-percent'>
                  {processingPercent}%
                </div>
              </div>
            )}
          </div>
        )}
        {formData.split.mode === 'none' && pages === 1 && (
          <div>
            <button
              onClick={() => {
                void handleCopy();
              }}
              disabled={processing || !allowCopy || isLoading}
            >
              {L.copy()}
            </button>
            {allowCopy || <p>{L.notAllowCopy({format: formData.format.replace(/\d$/, '').toUpperCase()})}</p>}
          </div>
        )}

        <button
          onClick={() => {
            void (previewSession.exportAction === 'saveAll' ? handleSaveAll() : handleSave());
          }}
          disabled={processing || isLoading}
        >
          {Platform.isMobile ? L.saveVault() : L.save()}
        </button>
      </div>
    </div>
  );
};

export default ModalContent;
