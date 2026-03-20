import {
  Plugin,
  PluginSettingTab,
  type App,
  TFile,
  Notice,
  TFolder,
  Editor,
  MarkdownView,
} from 'obsidian';
import L from './L';
import { isMarkdownFile, getMetadata } from './utils';
import { DEFAULT_SETTINGS } from './settings';
import exportFolder from './components/folder/exportFolder';
import { createSettingConfig } from './formConfig';
import { SettingRenderer } from './SettingRenderer';
import exportImage from './components/file/exportImage';
import { normalizeAuthorFontFamily } from './utils/authorInfo';

export default class ExportImagePlugin extends Plugin {
  settings: ISettings;

  async epxortFile(file: TFile) {
    const frontmatter = getMetadata(file, this.app);
    const markdown = await this.app.vault.cachedRead(file);
    await exportImage(this.app, this.settings, markdown, file, frontmatter, 'file');
  }

  async onload() {
    await this.loadSettings();

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (file instanceof TFile && isMarkdownFile(file)) {
          menu.addItem(item => {
            item
              .setTitle(L.exportImage())
              .setIcon('image-down')
              .onClick(async () => {
                await this.epxortFile(file);
              });
          });
        } else if (file instanceof TFolder) {
          menu.addItem(item => {
            item
              .setTitle(L.exportFolder())
              .setIcon('image-down')
              .onClick(async () => {
                await exportFolder(this.app, this.settings, file);
              });
          });
        }
      }),
    );

    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          return;
        }
        const frontmatter = getMetadata(file, this.app);

        if (editor.somethingSelected()) {
          menu.addItem(item => {
            item
              .setTitle(L.exportSelectionImage())
              .setIcon('text-select')
              .onClick(async () =>
                exportImage(
                  this.app,
                  this.settings,
                  editor.getSelection(),
                  file,
                  frontmatter,
                  'selection',
                ),
              );
          });
        }

        menu.addItem(item => {
          item
            .setTitle(L.exportImage())
            .setIcon('image-down')
            .onClick(async () =>
              exportImage(
                this.app,
                this.settings,
                editor.getValue(),
                file,
                frontmatter,
                'file',
              ),
            );
        });
      }),
    );

    this.addCommand({
      id: 'export-image',
      name: L.command(),
      checkCallback: (checking: boolean) => {
        // If checking is true, we're simply "checking" if the command can be run.
        // If checking is false, then we want to actually perform the operation.
        if (!checking) {
          void (async () => {
            const activeFile = this.app.workspace.getActiveFile();
            if (
              !activeFile
              || !['md', 'markdown'].includes(activeFile.extension)
            ) {
              new Notice(L.noActiveFile());
              return;
            }

            const frontmatter = getMetadata(activeFile, this.app);
            const markdown = await this.app.vault.cachedRead(activeFile);
            await exportImage(
              this.app,
              this.settings,
              markdown,
              activeFile,
              frontmatter,
              'file',
            );
          })().catch(error => {
            console.error(error);
          });
        }
        // This command will only show up in Command Palette when the check function returns true
        return true;
      },
    });

    this.addCommand({
      id: 'export-image-selection',
      name: L.exportSelectionImage(),
      editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
        const file = view.file;
        if (!file || !['md', 'markdown'].includes(file.extension)) {
          return false;
        }
        const frontmatter = getMetadata(file, this.app);
        const selection = editor.getSelection();
        if (!selection) {
          return false;
        }
        if (!checking) {
          void exportImage(
            this.app,
            this.settings,
            selection,
            file,
            frontmatter,
            'selection',
          ).catch(error => {
            console.error(error);
          });
        }
        return true;
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new ImageSettingTab(this.app, this));
  }

  onunload() {
    // Empty
  }

  async loadSettings() {
    const data = await this.loadData() as Partial<ISettings> | null;
    const authorInfo = {
      ...DEFAULT_SETTINGS.authorInfo,
      ...(data?.authorInfo ?? {}),
    };

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(data ?? {}),
      padding: {
        ...DEFAULT_SETTINGS.padding,
        ...(data?.padding ?? {}),
      },
      authorInfo: {
        ...authorInfo,
        nameFontFamily: normalizeAuthorFontFamily(authorInfo.nameFontFamily),
        remarkFontFamily: normalizeAuthorFontFamily(authorInfo.remarkFontFamily),
      },
      watermark: {
        ...DEFAULT_SETTINGS.watermark,
        ...(data?.watermark ?? {}),
        text: {
          ...DEFAULT_SETTINGS.watermark.text,
          ...(data?.watermark?.text ?? {}),
        },
        image: {
          ...DEFAULT_SETTINGS.watermark.image,
          ...(data?.watermark?.image ?? {}),
        },
      },
      split: {
        ...DEFAULT_SETTINGS.split,
        ...(data?.split ?? {}),
      },
    };

    if ((this.settings.split.mode as string) === 'xiaohongshu35') {
      this.settings.split.mode = 'xiaohongshu';
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class ImageSettingTab extends PluginSettingTab {
  plugin: ExportImagePlugin;
  settingRenderer: SettingRenderer;

  constructor(app: App, plugin: ExportImagePlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.settingRenderer = new SettingRenderer(app, plugin, this.containerEl);
  }

  display(): void {
    void this.renderSettings();
  }

  private async renderSettings(): Promise<void> {
    await this.settingRenderer.render(await createSettingConfig(this.app));
  }
}
