import {
  App,
  Setting,
  setIcon,
  Modal,
} from 'obsidian';
import type { SettingItem } from './formConfig';
import L from './L';
import { fileToBase64 } from './utils';
import ImageSelectModal from './components/common/imageSelectModal';
import { renderPreview } from './settingPreview';
import type ExportImagePlugin from './ExportImagePlugin';
import { getRecommendedPadding, getRecommendedWidth } from './utils/splitMode.js';
import { updateSettingsAtPath } from './utils/settingsUpdate.js';
import { PROJECT_LINKS } from './utils/projectLinks.js';

export class SettingRenderer {
  private app: App;
  private plugin: ExportImagePlugin;
  private containerEl: HTMLElement;
  private settingItems: SettingItem[] = [];
  constructor(app: App, plugin: ExportImagePlugin, containerEl: HTMLElement) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = containerEl;
  }

  private getSettingValue(path: string): unknown {
    return path.split('.').reduce<unknown>((obj, key) => {
      if (!obj || typeof obj !== 'object') {
        return undefined;
      }

      return (obj as Record<string, unknown>)[key];
    }, this.plugin.settings);
  }

  private getStringSettingValue(path: string, fallback = ''): string {
    const value = this.getSettingValue(path);
    return this.toStringValue(value, fallback);
  }

  private toStringValue(value: unknown, fallback = ''): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return fallback;
  }

  private async updateSetting(path: string, value: unknown) {
    this.plugin.settings = updateSettingsAtPath(this.plugin.settings, path, value) as ISettings;
    if (path === 'split.mode') {
      const recommendedWidth = getRecommendedWidth(value as SplitMode, this.plugin.settings.width);
      if (recommendedWidth) {
        this.plugin.settings.width = recommendedWidth;
      }
      this.plugin.settings.padding = getRecommendedPadding(value as SplitMode, this.plugin.settings.padding);
    }
    await this.plugin.saveSettings();
    await this.render(undefined);
  }

  async render(settingItems: SettingItem[] | undefined): Promise<void> {
    if (settingItems && settingItems.length > 0) {
      this.settingItems = settingItems;
    }
    this.containerEl.empty();
    this.containerEl.createEl('h3', { text: L.setting.title() });

    const projectLinksSetting = new Setting(this.containerEl)
      .setName('项目链接')
      .setDesc('查看 GitHub 仓库或提交问题反馈。');

    projectLinksSetting
      .addButton(button => {
        button
          .setButtonText('GitHub 仓库')
          .onClick(() => window.open(PROJECT_LINKS.repoUrl, '_blank'));
      })
      .addButton(button => {
        button
          .setButtonText('问题反馈')
          .onClick(() => window.open(PROJECT_LINKS.issuesUrl, '_blank'));
      });

    // 使用配置渲染设置项
    this.settingItems.forEach(item => {
      if (item.show && !item.show(this.plugin.settings)) {
        return;
      }

      const setting = new Setting(this.containerEl)
        .setName(item.label);

      if (item.description) {
        setting.setDesc(item.description);
      }

      switch (item.type) {
        case 'text':
          setting.addText(text => {
            text.setValue(this.getStringSettingValue(item.id))
              .onChange(async value => {
                await this.updateSetting(item.id, value);
              });
          });
          break;

        case 'number':
          setting.addText(text => {
            text.inputEl.type = 'number';
            text.setValue(this.getStringSettingValue(item.id))
              .setPlaceholder(item.placeholder ?? '')
              .onChange(async value => {
                await this.updateSetting(item.id, value ? Number(value) : undefined);
              });
          });
          break;

        case 'toggle':
          setting.addToggle(toggle => {
            toggle.setValue(Boolean(this.getSettingValue(item.id)))
              .onChange(async value => {
                await this.updateSetting(item.id, value);
              });
          });
          break;

        case 'dropdown':
          if (item.options) {
            setting.addDropdown(dropdown => {
              dropdown.addOptions(
                Object.fromEntries(
                  item.options!.map(opt => [opt.value, opt.text])
                )
              )
                .setValue(this.getStringSettingValue(item.id))
                .onChange(async value => {
                  await this.updateSetting(item.id, value);
                });
            });
          }
          break;

        case 'color':
          setting.addColorPicker(picker => {
            picker.setValue(
              this.toStringValue(
                this.getSettingValue(item.id),
                this.toStringValue(item.defaultValue),
              ),
            )
              .onChange(async value => {
                await this.updateSetting(item.id, value);
              });
          });
          break;

        case 'file': {
          const containerDiv = createDiv({
            cls: 'setting-item-control',
            attr: {
              style: 'display: flex; flex-direction: column; align-items: flex-end; gap: 8px',
            },
          });

          const buttonContainer = containerDiv.createDiv({
            attr: { style: 'display: flex; gap: 8px' },
          });

          // 创建预览区域
          const previewDiv = buttonContainer.createDiv({
            cls: 'user-info-avatar',
            attr: {
              style: `position: relative; display: ${this.getSettingValue(item.id) ? 'block' : 'none'}`,
            },
          });

          if (this.getSettingValue(item.id)) {
            previewDiv.createEl('img', {
              attr: {
                src: String(this.getSettingValue(item.id)),
                alt: 'preview',
                style: 'width: 100%; height: 100%; object-fit: cover',
              },
            });
          }

          // 添加删除按钮
          const deleteButton = previewDiv.createDiv({
            attr: {
              style: `
                position: absolute;
                top: -10px;
                right: -10px;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: black;
                border-radius: 50%;
                cursor: pointer;
                --icon-size: 12px;
                --icon-color: var(--color-red);
                color: white;
              `,
            },
          });

          setIcon(deleteButton, 'x');
          deleteButton.onclick = () => {
            void this.updateSetting(item.id, undefined);
          };

          // 添加上传按钮
          const fileInput = createEl('input', {
            attr: {
              type: 'file',
              style: 'display: none',
            },
          });

          const uploadButton = buttonContainer.createEl('button', {
            text: L.setting.watermark.image.src.upload(),
          });

          uploadButton.onclick = () => fileInput.click();

          fileInput.onchange = () => {
            void (async () => {
              const file = fileInput.files?.[0];
              if (file) {
                const base64 = await fileToBase64(file);
                await this.updateSetting(item.id, base64);
                fileInput.value = '';
              }
            })();
          };

          // 添加选择按钮
          const selectButton = buttonContainer.createEl('button', {
            text: L.setting.watermark.image.src.select(),
          });

          selectButton.onclick = () => {
            const modal = new ImageSelectModal(this.app, (img) => {
              void this.updateSetting(item.id, img);
              modal.close();
            });
            modal.open();
          };

          // 添加 URL 输入按钮
          const urlButton = buttonContainer.createEl('button', {
            text: L.imageUrl(),
          });

          urlButton.onclick = () => {
            const modal = new Modal(this.app);
            modal.titleEl.setText(L.imageUrl());

            const inputContainer = modal.contentEl.createDiv({
              attr: {
                style: 'margin: 1em 0;'
              }
            });
            const input = inputContainer.createEl('input', {
              attr: {
                type: 'text',
                placeholder: L.imageUrl(),
                style: 'width: 100%'
              }
            });

            const commitUrl = () => {
              void this.updateSetting(item.id, input.value);
              modal.close();
            };

            input.onkeydown = (e) => {
              if (e.key === 'Enter') {
                commitUrl();
              } else if (e.key === 'Escape') {
                modal.close();
              }
            };

            const buttonDiv = modal.contentEl.createDiv({
              cls: 'modal-button-container',
              attr: {
                style: 'display: flex; justify-content: flex-end; gap: 8px; margin-top: 1em;'
              }
            });

            const confirmButton = buttonDiv.createEl('button', {
              text: L.confirm(),
              cls: 'mod-cta'
            });
            confirmButton.onclick = () => {
              commitUrl();
            };

            buttonDiv.createEl('button', { text: L.cancel() }).onclick = () => {
              modal.close();
            };

            modal.open();
            setTimeout(() => input.focus(), 0);
          };

          setting.settingEl.appendChild(containerDiv);
          break;
        }
      }
    });

    // 添加预览区域
    const previewEl = this.containerEl.createDiv();
    const render = await renderPreview(previewEl, this.app);
    render(this.plugin.settings);
  }
} 
