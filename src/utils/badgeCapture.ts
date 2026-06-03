import domToImage from 'dom-to-image-more';

const SCALE = 300 / 96;

export async function captureHtmlToPng(html: string): Promise<string> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const dataUrl = await domToImage.toPng(container, {
      scale: SCALE,
      quality: 1,
      style: {
        transform: 'none',
      },
    });
    return dataUrl;
  } finally {
    document.body.removeChild(container);
  }
}
