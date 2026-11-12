import { useEffect, useState } from 'react';

const sprites = new Map<string, Promise<string>>();

// Composite the existing art onto the card's theme. Only beige pixels connected
// to the outside of the image are masked, so light walls and windows stay intact.
function sprite(source: string) {
  const existing = sprites.get(source);
  if (existing) return existing;
  const result = new Promise<string>(resolve => {
    const image = new Image();
    image.onerror = () => resolve(source);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const width = canvas.width = image.naturalWidth;
      const height = canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return resolve(source);
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, width, height);
      const { data } = pixels;
      const corners = [0, width - 1, width * (height - 1), width * height - 1].map(pixel => 4 * pixel);
      if (corners.some(index => data[index + 3] < 240)) return resolve(source);
      const visited = new Uint8Array(width * height);
      const queue = new Uint32Array(width * height);
      let size = 0;
      function visit(pixel: number) {
        if (visited[pixel]) return;
        visited[pixel] = 1;
        const index = 4 * pixel;
        const r = data[index], g = data[index + 1], b = data[index + 2];
        if (r < 198 || g < 173 || b < 138 || r < g || g < b ||
          !corners.some(corner => Math.abs(r - data[corner]) + Math.abs(g - data[corner + 1]) + Math.abs(b - data[corner + 2]) < 72)) return;
        queue[size++] = pixel;
        data[index + 3] = 0;
      }
      for (let x = 0; x < width; x++) {
        visit(x);
        visit((height - 1) * width + x);
      }
      for (let y = 1; y < height - 1; y++) {
        visit(y * width);
        visit(y * width + width - 1);
      }
      for (let i = 0; i < size; i++) {
        const pixel = queue[i];
        const x = pixel % width;
        if (x > 0) visit(pixel - 1);
        if (x < width - 1) visit(pixel + 1);
        if (pixel >= width) visit(pixel - width);
        if (pixel + width < width * height) visit(pixel + width);
      }
      context.putImageData(pixels, 0, 0);
      canvas.toBlob(blob => resolve(blob ? URL.createObjectURL(blob) : source), 'image/webp', .91);
    };
    image.src = source;
  });
  sprites.set(source, result);
  return result;
}

export function BuildingArt({ source }: { source?: string }) {
  const [rendered, setRendered] = useState<{ source: string; url: string }>();
  useEffect(() => {
    if (!source) return;
    let current = true;
    void sprite(source).then(url => { if (current) setRendered({ source, url }); });
    return () => { current = false; };
  }, [source]);
  const ready = rendered?.source === source;
  return <img src={ready ? rendered?.url : source} data-sprite-pending={!ready || undefined} alt="" decoding="async" draggable={false} />;
}
