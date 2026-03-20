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
  const previewSplitHeight = getSplitHeight(formData.split.mode, formData.width, formData.split.height);
  const previousSplitModeRef = useRef<SplitMode | undefined>(settings.split.mode);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    isCopiable(formData.format).then(result => {
      setAllowCopy(Boolean(result));
    });
  }, [formData.format]);

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
      await save(
        app,
        root.current.contentElement,
        title,
        formData.resolutionMode,
        formData.format,
        Platform.isMobile,
      );
    } catch {
      new Notice(L.saveFail());
    }

    setProcessing(false);
  }, [root, formData.resolutionMode, formData.format, title, formData.width]);
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
      await saveAll(
        root.current,
        formData,
        formData.format,
        formData.resolutionMode,
        app,
        title,
      );
    } catch {
      new Notice(L.saveFail());
    }

    setProcessing(false);
  }, [root, formData, app, title]);

  return (
    <div className='export-image-preview-root'>
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
              </div>
            )}
          </div>
        </div>
      </div>
      <div className='export-image-preview-actions'>
        {formData.split.mode === 'none' && pages === 1 && (
          <div>
            <button onClick={handleCopy} disabled={processing || !allowCopy || isLoading}>
              {L.copy()}
            </button>
            {allowCopy || <p>{L.notAllowCopy({format: formData.format.replace(/\d$/, '').toUpperCase()})}</p>}
          </div>
        )}

        <button
          onClick={async () => (previewSession.exportAction === 'saveAll' ? handleSaveAll() : handleSave())}
          disabled={processing || isLoading}
        >
          {Platform.isMobile ? L.saveVault() : L.save()}
        </button>
      </div>
    </div>
  );
};

export default ModalContent;
