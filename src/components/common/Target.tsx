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
import { WEIBO_BADGE_URL } from 'src/utils/badgeAssets';
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
                  alignItems: setting.authorInfo.badgeStyle === 'weibo' ? 'flex-start' : undefined,
                  gap: setting.authorInfo.badgeStyle === 'x' ? '12px'
                    : setting.authorInfo.badgeStyle === 'weibo' ? '12px'
                    : undefined,
                  background:
                    setting.format === 'png1'
                      ? 'unset'
                      : 'var(--background-primary)',
                  ...separatorStyle,
                }}
              >
                {setting.authorInfo.avatar && (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      className='user-info-avatar'
                      style={{
                        backgroundImage: `url(${setting.authorInfo.avatar})`,
                        width: setting.authorInfo.avatarSize,
                        height: setting.authorInfo.avatarSize,
                      }}
                    ></div>
                    {setting.authorInfo.badgeStyle === 'weibo' && (
                      <svg
                        className='user-info-avatar-v-badge'
                        viewBox="0 0 100 100"
                        style={{
                          width: `${Math.round((setting.authorInfo.avatarSize || 66) * 0.31)}px`,
                          height: `${Math.round((setting.authorInfo.avatarSize || 66) * 0.31)}px`,
                        }}
                      >
                        <circle cx="50" cy="50" r="50" fill="#fff"/>
                        <circle cx="50" cy="50" r="40.476" fill="#FF6C00"/>
                        <path fill="#fff" fillRule="evenodd" d="M37.025 33.134 50 59.612l13.153-26.478h11.3L55.404 71.429H44.589L25.542 33.134z" clipRule="evenodd"/>
                      </svg>
                    )}
                  </div>
                )}
                {setting.authorInfo.name && (
                  <div
                    className='user-info-text'
                    style={setting.authorInfo.badgeStyle === 'weibo'
                      ? { padding: '6px 0 3px', gap: '6px', alignItems: 'flex-start' }
                      : undefined
                    }
                  >
                    <div
                      className='user-info-name-row'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: setting.authorInfo.badgeStyle === 'x' ? '2px' : '5px',
                      }}
                    >
                      <div
                        className='user-info-name'
                        style={{
                          fontSize: setting.authorInfo.nameFontSize,
                          fontFamily: normalizeAuthorFontFamily(setting.authorInfo.nameFontFamily),
                          fontWeight: setting.authorInfo.badgeStyle !== 'none' ? 700 : undefined,
                          color: setting.authorInfo.badgeStyle === 'weibo' ? '#FF8200' : undefined,
                        }}
                      >
                        {setting.authorInfo.name}
                      </div>
                      {setting.authorInfo.badgeStyle === 'x' && (
                        <svg
                          viewBox="0 0 22 22"
                          className="user-info-badge"
                          style={{
                            width: `${(setting.authorInfo.nameFontSize || 25)}px`,
                            height: `${(setting.authorInfo.nameFontSize || 25)}px`,
                          }}
                        >
                          <path fill="#1D9BF0" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816z"></path>
                          <path fill="#FFFFFF" d="M9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"></path>
                        </svg>
                      )}
                      {setting.authorInfo.badgeStyle === 'weibo' && (
                        <img
                          className="user-info-badge"
                          src={WEIBO_BADGE_URL}
                          style={{
                            height: `${(setting.authorInfo.nameFontSize || 20) * 14 / 15}px`,
                            width: 'auto',
                          }}
                        />
                      )}
                    </div>
                    {setting.authorInfo.remark && (
                      <div
                        className='user-info-remark'
                        style={{
                          fontSize: setting.authorInfo.remarkFontSize,
                          fontFamily: normalizeAuthorFontFamily(setting.authorInfo.remarkFontFamily),
                          color: setting.authorInfo.badgeStyle === 'weibo'
                            ? 'rgb(147, 147, 147)'
                            : setting.authorInfo.badgeStyle === 'x'
                              ? 'rgb(113, 118, 123)'
                              : undefined,
                        }}
                      >
                        {setting.authorInfo.remark}
                      </div>
                    )}
                    {setting.authorInfo.badgeStyle === 'weibo' && setting.authorInfo.weiboLocation && (
                      <div
                        className='user-info-remark'
                        style={{
                          fontSize: setting.authorInfo.remarkFontSize,
                          fontFamily: normalizeAuthorFontFamily(setting.authorInfo.remarkFontFamily),
                          color: 'rgb(147, 147, 147)',
                        }}
                      >
                        发布于 {setting.authorInfo.weiboLocation}
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
