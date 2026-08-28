import { MAX_NAME_LENGTH, resultSentence } from "./challenge";

const SIZE = 1080;
const BG_SRC = "/share-bg.svg";

export interface ShareImageOptions {
  name: string;
  moves: number;
  timeSeconds: number;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY;
}

/**
 * Draws the result card entirely on a Canvas 2D context — a pre-made
 * background image via drawImage plus native fillText for the stats, never
 * a screenshot of the live WebGL canvas or an HTML-to-canvas rasterizer.
 */
export async function generateShareImage(opts: ShareImageOptions): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('800 90px "Baloo 2"'),
      document.fonts.load('700 46px "Nunito"'),
      document.fonts.load('600 36px "Nunito"'),
    ]);
  } catch {
    // custom fonts failing to load just falls back to system fonts below
  }

  const bg = await loadImage(BG_SRC);
  if (bg) {
    ctx.drawImage(bg, 0, 0, SIZE, SIZE);
  } else {
    ctx.fillStyle = "#0e2027";
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  const name = opts.name.trim().slice(0, MAX_NAME_LENGTH);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f4fbff";
  ctx.font = '800 78px "Baloo 2", sans-serif';
  ctx.fillText("STOP THE CHEATER", SIZE / 2, 150);

  ctx.fillStyle = "#ffc145";
  ctx.font = '800 56px "Baloo 2", sans-serif';
  ctx.fillText("YOU SAVED THEM", SIZE / 2, 420);

  ctx.fillStyle = "#f4fbff";
  ctx.font = '700 48px "Nunito", sans-serif';
  wrapText(ctx, resultSentence(name, opts.moves), SIZE / 2, 520, SIZE - 160, 58);

  ctx.fillStyle = "#9fc4d1";
  ctx.font = '600 36px "Nunito", sans-serif';
  ctx.fillText(`${opts.timeSeconds.toFixed(2)} seconds`, SIZE / 2, 610);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
