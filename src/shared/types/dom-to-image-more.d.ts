declare module 'dom-to-image-more' {
  interface Options {
    width?: number;
    height?: number;
    style?: Record<string, string>;
    quality?: number;
    scale?: number;
    filter?: (node: Node) => boolean;
    bgcolor?: string;
    cacheBust?: boolean;
    imagePlaceholder?: string;
  }
  const domToImageMore: {
    toPng(node: HTMLElement, options?: Options): Promise<string>;
    toJpeg(node: HTMLElement, options?: Options): Promise<string>;
    toBlob(node: HTMLElement, options?: Options): Promise<Blob>;
    toPixelData(node: HTMLElement, options?: Options): Promise<Uint8ClampedArray>;
    toSvg(node: HTMLElement, options?: Options): Promise<string>;
    toCanvas(node: HTMLElement, options?: Options): Promise<HTMLCanvasElement>;
  };
  export default domToImageMore;
}
