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
  function toPng(node: HTMLElement, options?: Options): Promise<string>;
  function toJpeg(node: HTMLElement, options?: Options): Promise<string>;
  function toBlob(node: HTMLElement, options?: Options): Promise<Blob>;
  function toPixelData(node: HTMLElement, options?: Options): Promise<Uint8ClampedArray>;
  function toSvg(node: HTMLElement, options?: Options): Promise<string>;
  function toCanvas(node: HTMLElement, options?: Options): Promise<HTMLCanvasElement>;
  const _default: {
    toPng: typeof toPng;
    toJpeg: typeof toJpeg;
    toBlob: typeof toBlob;
    toPixelData: typeof toPixelData;
    toSvg: typeof toSvg;
    toCanvas: typeof toCanvas;
  };
  export default _default;
}
