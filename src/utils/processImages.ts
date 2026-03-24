import { type App, requestUrl } from 'obsidian';
import { fileToBase64, delay } from '.';

const imageExtToMime: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	webp: 'image/webp',
	bmp: 'image/bmp',
	ico: 'image/x-icon',
	avif: 'image/avif',
};

function getMimeFromExtension(ext: string): string {
	return imageExtToMime[ext.toLowerCase()] || 'image/png';
}

/**
 * 等待 Obsidian 的嵌入后处理器完成图片解析。
 * MarkdownRenderer.render() 返回后，内部嵌入（![[image.png]]）
 * 是通过异步后处理器解析的，需要元素在 DOM 中才能工作。
 * 当嵌入解析完成时，Obsidian 会在 .internal-embed 元素上添加 is-loaded 类。
 */
export async function waitForEmbeds(
	container: HTMLElement,
	timeoutMs = 10_000,
): Promise<void> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		const pendingEmbeds = container.querySelectorAll(
			'.internal-embed:not(.is-loaded)',
		);
		if (pendingEmbeds.length === 0) {
			break;
		}

		await delay(100);
	}

	// 额外等待，确保 img 元素已插入 DOM
	await delay(200);
}

export async function waitForImages(
	container: HTMLElement,
	timeoutMs = 10_000,
): Promise<void> {
	const images = container.querySelectorAll('img');
	if (images.length === 0) {
		return;
	}

	const promises = Array.from(images).map(async img => {
		if (img.complete && img.naturalWidth > 0) {
			return;
		}

		if (!img.src) {
			return;
		}

		return new Promise<void>(resolve => {
			const timer = setTimeout(() => {
				resolve();
			}, timeoutMs);

			img.addEventListener('load', () => {
				clearTimeout(timer);
				resolve();
			}, { once: true });

			img.addEventListener('error', () => {
				clearTimeout(timer);
				resolve();
			}, { once: true });
		});
	});

	await Promise.allSettled(promises);
}

export async function convertImagesToBase64(
	container: HTMLElement,
	app: App,
	sourcePath: string,
): Promise<void> {
	const images = container.querySelectorAll('img');
	if (images.length === 0) {
		return;
	}

	const promises = Array.from(images).map(async img => {
		try {
			await convertSingleImage(img, app, sourcePath);
		} catch (error) {
			console.warn('[export-image-xhs] Failed to convert image:', img.src, error);
		}
	});

	await Promise.allSettled(promises);
}

async function convertSingleImage(
	img: HTMLImageElement,
	app: App,
	sourcePath: string,
): Promise<void> {
	const src = img.src;

	if (!src || src.startsWith('data:')) {
		return;
	}

	if (src.startsWith('app://') || src.startsWith('capacitor://')) {
		await convertVaultImage(img, app, sourcePath);
	} else if (src.startsWith('http://') || src.startsWith('https://')) {
		await convertRemoteImage(img);
	}
}

async function convertVaultImage(
	img: HTMLImageElement,
	app: App,
	sourcePath: string,
): Promise<void> {
	// 方式1：通过父元素 .internal-embed[src] 获取 vault 链接路径
	const embedParent = img.closest('.internal-embed[src]');
	if (embedParent) {
		const linkPath = embedParent.getAttribute('src');
		if (linkPath) {
			const resolved = app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
			if (resolved) {
				const binary = await app.vault.readBinary(resolved);
				const mimeType = getMimeFromExtension(resolved.extension);
				const blob = new Blob([binary], { type: mimeType });
				const dataUrl = await fileToBase64(blob);
				img.src = dataUrl;
				return;
			}
		}
	}

	// 方式2：从 app:// URL 解析文件路径
	try {
		await convertVaultImageByUrl(img, app);
	} catch {
		// 方式3：通过 img.alt 属性尝试解析（Obsidian 通常将文件名设为 alt）
		const alt = img.getAttribute('alt');
		if (alt) {
			await convertVaultImageByAlt(img, app, sourcePath, alt);
		}
	}
}

async function convertVaultImageByAlt(
	img: HTMLImageElement,
	app: App,
	sourcePath: string,
	alt: string,
): Promise<void> {
	const resolved = app.metadataCache.getFirstLinkpathDest(alt, sourcePath);
	if (!resolved) {
		return;
	}

	const binary = await app.vault.readBinary(resolved);
	const mimeType = getMimeFromExtension(resolved.extension);
	const blob = new Blob([binary], { type: mimeType });
	const dataUrl = await fileToBase64(blob);
	img.src = dataUrl;
}

async function convertVaultImageByUrl(
	img: HTMLImageElement,
	app: App,
): Promise<void> {
	const src = img.src;

	let filePath: string;
	try {
		const url = new URL(src);
		filePath = decodeURIComponent(url.pathname);
	} catch {
		throw new Error('Cannot parse URL: ' + src);
	}

	// 移除开头的 /
	if (filePath.startsWith('/')) {
		filePath = filePath.slice(1);
	}

	// 获取 vault 根路径，计算相对路径
	const adapter = app.vault.adapter as { getBasePath?: () => string };
	if (typeof adapter.getBasePath === 'function') {
		const basePath = adapter.getBasePath();
		if (basePath && filePath.startsWith(basePath)) {
			filePath = filePath.slice(basePath.length);
			if (filePath.startsWith('/')) {
				filePath = filePath.slice(1);
			}
		}
	}

	const extension = filePath.split('.').pop() || 'png';
	const mimeType = getMimeFromExtension(extension);

	const binary = await app.vault.adapter.readBinary(filePath);
	const blob = new Blob([binary], { type: mimeType });
	const dataUrl = await fileToBase64(blob);
	img.src = dataUrl;
}

async function convertRemoteImage(img: HTMLImageElement): Promise<void> {
	const response = await requestUrl({
		url: img.src,
		method: 'GET',
	});
	const mimeType = response.headers['content-type'] || 'image/png';
	const blob = new Blob([response.arrayBuffer], { type: mimeType });
	const dataUrl = await fileToBase64(blob);
	img.src = dataUrl;
}
