import { type App, type FrontMatterCache } from 'obsidian';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import clsx from 'clsx';
import { lowerCase } from 'lodash';
import { normalizeAuthorFontFamily } from 'src/utils/authorInfo';
import { getBodyTypographyStyle } from 'src/utils/bodyTypography';
import { getCaptureContentHeight } from 'src/utils/pagedCaptureModel';
import { buildCaptureSplitModel } from 'src/utils/captureSplitModel';
import { getElementMeasures } from 'src/utils/split';
import { getAuthorAlign, getAuthorPadding, getBodyPadding } from 'src/utils/pageLayout';
import Metadata from './Metadata';
import StaticWatermark from './StaticWatermark';

const alignMap = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

const coerceMetadataValue = (value: unknown) => value as (
  string
  | number
  | boolean
  | string[]
  | undefined
);

const resolveFrontmatterClassName = (frontmatter: FrontMatterCache | undefined) => {
  const cssClasses = frontmatter?.cssclasses;
  if (Array.isArray(cssClasses)) {
    return cssClasses.join(' ');
  }

  if (typeof cssClasses === 'string') {
    return cssClasses;
  }

  return typeof frontmatter?.cssclass === 'string' ? frontmatter.cssclass : undefined;
};

export type TargetRef = {
  element: HTMLElement;
  contentElement: HTMLElement;
  setClip: (startY: number, height: number) => void;
  resetClip: () => void;
};

type TargetProps = {
  frontmatter: FrontMatterCache | undefined;
  setting: ISettings;
  title: string;
  metadataMap: Record<string, { type: MetadataType }>;
  markdownEl: Node;
  app: App;
  scale?: number;
  isProcessing: boolean;
  onSplitChange?: (positions: number[]) => void;
  clipStartY?: number;
  clipHeight?: number;
  hideSplitLines?: boolean;
  editable?: boolean;
};

const Target = forwardRef<TargetRef, TargetProps>(({
  frontmatter,
  setting,
  title,
  metadataMap,
  markdownEl,
  scale = 1,
  isProcessing,
  onSplitChange,
  clipStartY,
  clipHeight,
  hideSplitLines,
  editable = false,
}, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const [rootHeight, setRootHeight] = useState(0);
  const [contentVersion, setContentVersion] = useState(0);

  useEffect(() => {
    if (!rootRef.current) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      if (rootRef.current) {
        setRootHeight(rootRef.current.clientHeight);
      }
    });

    observer.observe(rootRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!contentRef.current) {
      return;
    }

    contentRef.current.innerHTML = '';
    Array.from(markdownEl.childNodes).forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent) {
          contentRef.current?.append(child.textContent);
        }

        return;
      }

      contentRef.current?.append(child.cloneNode(true));
    });

    setContentVersion(version => version + 1);
  }, [markdownEl]);

  useImperativeHandle(ref, () => ({
    element: clipRef.current!,
    contentElement: rootRef.current!,
    setClip(startY: number, height: number) {
      if (!clipRef.current || !rootRef.current) {
        return;
      }

      clipRef.current.setCssProps({
        height: `${height}px`,
        overflow: 'hidden',
      });
      rootRef.current.setCssProps({
        transform: `translateY(-${startY}px)`,
      });
    },
    resetClip() {
      if (!clipRef.current || !rootRef.current) {
        return;
      }

      clipRef.current.setCssProps({
        height: '',
        overflow: '',
      });
      rootRef.current.setCssProps({
        transform: '',
      });
    },
  }), []);

  const splitLines = useMemo(() => {
    if (!rootHeight || !rootRef.current) {
      return [];
    }

    const bodyTarget = rootRef.current.querySelector<HTMLElement>('.export-image-preview-container');
    const authorElement = rootRef.current.querySelector<HTMLElement>('.user-info-container');
    const authorHeight = (
      setting.authorInfo.show
      && setting.authorInfo.position === 'top'
      && authorElement
    ) ? authorElement.clientHeight : 0;
    const splitTarget = bodyTarget || rootRef.current;
    const totalHeight = getCaptureContentHeight(splitTarget);
    const elements = getElementMeasures(splitTarget, setting.split.mode);
    const { previewLines } = buildCaptureSplitModel({
      setting,
      totalHeight,
      authorHeight,
      elements,
    });

    onSplitChange?.(previewLines);
    return previewLines;
  }, [
    contentVersion,
    onSplitChange,
    rootHeight,
    setting.authorInfo.position,
    setting.authorInfo.show,
    setting.padding.bottom,
    setting.padding.top,
    setting.split.height,
    setting.split.mode,
    setting.split.overlap,
    setting.width,
  ]);

  const splitLineStyle = useMemo(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    height: `${2 / scale}px`,
    borderTop: `${2 / scale}px dashed var(--interactive-accent)`,
    opacity: 0.7,
    pointerEvents: 'none',
  } as const), [scale]);

  const separatorStyle = useMemo(() => {
    if (setting.authorInfo.separator === 'line') {
      return {
        [setting.authorInfo.position === 'top' ? 'borderBottom' : 'borderTop']: '1px solid var(--background-modifier-border)',
      };
    }

    if (setting.authorInfo.separator === 'background') {
      return {
        background: 'var(--background-secondary)',
      };
    }

    return {};
  }, [setting.authorInfo.position, setting.authorInfo.separator]);

  const bodyPadding = useMemo(() => getBodyPadding(setting), [setting]);
  const authorPadding = useMemo(() => getAuthorPadding(setting), [setting]);
  const authorAlign = useMemo(() => getAuthorAlign(setting), [setting]);
  const authorJustify = alignMap[(authorAlign as keyof typeof alignMap)] || alignMap.left;
  const frontmatterClassName = useMemo(
    () => resolveFrontmatterClassName(frontmatter),
    [frontmatter],
  );

  return (
    <div
      ref={clipRef}
      style={{
        height: clipHeight !== undefined ? `${clipHeight}px` : undefined,
        overflow: clipHeight !== undefined ? 'hidden' : undefined,
      }}
    >
      <div
        className={clsx('export-image-root markdown-reading-view', frontmatterClassName)}
        ref={rootRef}
        style={{
          width: `${setting.width}px`,
          boxSizing: 'border-box',
          backgroundColor:
            setting.format === 'png1' ? 'unset' : 'var(--background-primary)',
          position: 'relative',
          transform: clipStartY !== undefined ? `translateY(-${clipStartY}px)` : undefined,
        }}
      >
        <div
          className='export-image-watermark-content'
          style={{
            display: 'flex',
            flexDirection:
              setting.authorInfo.position === 'bottom'
                ? 'column'
                : 'column-reverse',
          }}
        >
          <div
            className={clsx('markdown-preview-view markdown-rendered export-image-preview-container', {
              'is-editable': editable,
            })}
            style={{
              width: `${setting.width}px`,
              boxSizing: 'border-box',
              transition: 'width 0.25s',
              padding: `${bodyPadding.top}px ${bodyPadding.right}px ${bodyPadding.bottom}px ${bodyPadding.left}px`,
            }}
          >
            {setting.showFilename && (
              <div className='inline-title' autoCapitalize='on'>
                {title}
              </div>
            )}
            {setting.showMetadata
              && frontmatter
              && Object.keys(frontmatter).length > 0 && (
                <div className='metadata-container' style={{ display: 'block' }}>
                  <div className='metadata-content'>
                    {Object.keys(frontmatter).map(name => (
                      <Metadata
                        name={name}
                        key={name}
                        value={coerceMetadataValue(frontmatter[name])}
                        type={metadataMap[lowerCase(name)]?.type || 'text'}
                      ></Metadata>
                    ))}
                  </div>
                </div>
              )}
            <div
              ref={contentRef}
              className={clsx(`export-image-split-${setting.split.mode} export-image-markdown`, {
                'is-editable': editable,
              })}
              contentEditable={editable}
              suppressContentEditableWarning={editable}
              onInput={editable ? () => {
                setContentVersion(version => version + 1);
              } : undefined}
              style={getBodyTypographyStyle(setting)}
            ></div>
          </div>
          {setting.authorInfo.show
            && (setting.authorInfo.avatar || setting.authorInfo.name) && (
              <div
                className='user-info-container'
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: `${authorPadding.top}px ${authorPadding.right}px ${authorPadding.bottom}px ${authorPadding.left}px`,
                  justifyContent: authorJustify,
                  background:
                    setting.format === 'png1'
                      ? 'unset'
                      : 'var(--background-primary)',
                  ...separatorStyle,
                }}
              >
                {setting.authorInfo.avatar && (
                  <div
                    className='user-info-avatar'
                    style={{
                      backgroundImage: `url(${setting.authorInfo.avatar})`,
                      width: setting.authorInfo.avatarSize,
                      height: setting.authorInfo.avatarSize,
                    }}
                  ></div>
                )}
                {setting.authorInfo.name && (
                  <div className='user-info-text'>
                    <div
                      className='user-info-name'
                      style={{
                        fontSize: setting.authorInfo.nameFontSize,
                        fontFamily: normalizeAuthorFontFamily(setting.authorInfo.nameFontFamily),
                      }}
                    >
                      {setting.authorInfo.name}
                    </div>
                    {setting.authorInfo.remark && (
                      <div
                        className='user-info-remark'
                        style={{
                          fontSize: setting.authorInfo.remarkFontSize,
                          fontFamily: normalizeAuthorFontFamily(setting.authorInfo.remarkFontFamily),
                        }}
                      >
                        {setting.authorInfo.remark}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
        </div>
        <StaticWatermark setting={setting}></StaticWatermark>
        {!isProcessing && !hideSplitLines && splitLines.map((y, index) => (
          <div
            key={index}
            className='export-image-split-line'
            style={{
              ...splitLineStyle,
              top: y,
              zIndex: 10,
            }}
          />
        ))}
      </div>
    </div>
  );
});

export default Target;
