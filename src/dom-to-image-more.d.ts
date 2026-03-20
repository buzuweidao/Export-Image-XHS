declare module 'dom-to-image-more' {
  type DomToImageOptions = {
    width?: number;
    height?: number;
    quality?: number;
    scale?: number;
    type?: string;
    requestUrl?: unknown;
  };

  type DomToImageApi = {
    toBlob(node: HTMLElement, options?: DomToImageOptions): Promise<Blob>;
    toPng(node: HTMLElement, options?: DomToImageOptions): Promise<string>;
    toJpeg(node: HTMLElement, options?: DomToImageOptions): Promise<string>;
    toSvg(node: HTMLElement, options?: DomToImageOptions): Promise<string>;
  };

  const domToImage: DomToImageApi;

  export default domToImage;
}
