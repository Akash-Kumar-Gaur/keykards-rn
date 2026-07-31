/**
 * Locate parsed card fields inside the raw OCR result, and map image-space
 * boxes onto the camera preview.
 *
 * ML Kit reports bounding boxes in captured-image pixels. The preview is
 * center-cropped to fill the screen, so every box needs the same cover
 * transform the preview applies before it can be drawn over the live frame.
 *
 * Only text the recognizer actually read is returned — nothing is synthesised.
 */

import { digitsOnly, formatExpiry } from '@/lib/cardUtils';
import type { CardOcrParseResult } from '@/lib/cardOcrParse';

export type Box = { x: number; y: number; width: number; height: number };

export type OcrFieldKind = 'pan' | 'expiry' | 'name';

export type OcrFieldRegion = {
  kind: OcrFieldKind;
  /** Text as the recognizer read it, used for the travelling label. */
  text: string;
  box: Box;
};

/** Minimal shape of the `expo-mlkit-ocr` result we depend on. */
export type OcrElementLike = { text: string; boundingBox: Box };
export type OcrLineLike = {
  text: string;
  boundingBox: Box;
  elements?: OcrElementLike[];
};
export type OcrBlockLike = {
  text: string;
  boundingBox: Box;
  lines?: OcrLineLike[];
};
export type OcrResultLike = { text: string; blocks?: OcrBlockLike[] };

function isUsableBox(box: Box | undefined | null): box is Box {
  return (
    !!box &&
    Number.isFinite(box.x) &&
    Number.isFinite(box.y) &&
    Number.isFinite(box.width) &&
    Number.isFinite(box.height) &&
    box.width > 0 &&
    box.height > 0
  );
}

function unionBoxes(boxes: Box[]): Box | null {
  const usable = boxes.filter(isUsableBox);
  if (usable.length === 0) return null;
  const left = Math.min(...usable.map((b) => b.x));
  const top = Math.min(...usable.map((b) => b.y));
  const right = Math.max(...usable.map((b) => b.x + b.width));
  const bottom = Math.max(...usable.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function allLines(result: OcrResultLike): OcrLineLike[] {
  const lines: OcrLineLike[] = [];
  for (const block of result.blocks ?? []) {
    for (const line of block.lines ?? []) lines.push(line);
  }
  return lines;
}

/**
 * PAN box. A card number may arrive as one line ("4111 1111 1111 1111") or as
 * separate 4-digit elements, so single lines are tried before element runs.
 */
function findPanBox(result: OcrResultLike, pan: string): Box | null {
  const lines = allLines(result);

  for (const line of lines) {
    if (digitsOnly(line.text) === pan && isUsableBox(line.boundingBox)) {
      return line.boundingBox;
    }
  }

  for (const line of lines) {
    if (digitsOnly(line.text).includes(pan) && isUsableBox(line.boundingBox)) {
      return line.boundingBox;
    }
  }

  // Consecutive elements whose digits concatenate to the full PAN.
  for (const line of lines) {
    const elements = (line.elements ?? []).filter((el) =>
      isUsableBox(el.boundingBox),
    );
    for (let start = 0; start < elements.length; start += 1) {
      let digits = '';
      const run: Box[] = [];
      for (let i = start; i < elements.length; i += 1) {
        digits += digitsOnly(elements[i]!.text);
        run.push(elements[i]!.boundingBox);
        if (digits.length > pan.length) break;
        if (digits === pan) return unionBoxes(run);
      }
    }
  }

  return null;
}

function expiryMatches(text: string, month: number, year: number): boolean {
  const match = text.match(/(\d{1,2})\s*[/\-.]\s*(\d{2,4})/);
  if (!match) return false;
  let parsedYear = Number(match[2]);
  if (parsedYear < 100) parsedYear += 2000;
  return Number(match[1]) === month && parsedYear === year;
}

function findExpiryBox(
  result: OcrResultLike,
  month: number,
  year: number,
): Box | null {
  for (const line of allLines(result)) {
    for (const el of line.elements ?? []) {
      if (expiryMatches(el.text, month, year) && isUsableBox(el.boundingBox)) {
        return el.boundingBox;
      }
    }
    if (expiryMatches(line.text, month, year) && isUsableBox(line.boundingBox)) {
      return line.boundingBox;
    }
  }
  return null;
}

function normalizeName(value: string): string {
  return value.toUpperCase().replace(/\s+/g, ' ').trim();
}

function findNameBox(result: OcrResultLike, name: string): Box | null {
  const target = normalizeName(name);
  for (const line of allLines(result)) {
    if (normalizeName(line.text) === target && isUsableBox(line.boundingBox)) {
      return line.boundingBox;
    }
  }
  for (const line of allLines(result)) {
    if (
      normalizeName(line.text).includes(target) &&
      isUsableBox(line.boundingBox)
    ) {
      return line.boundingBox;
    }
  }
  return null;
}

/**
 * Regions for whichever parsed fields could be traced back to recognized text.
 * Fields the recognizer placed ambiguously are simply omitted.
 */
export function findFieldRegions(
  result: OcrResultLike,
  parsed: CardOcrParseResult,
): OcrFieldRegion[] {
  const regions: OcrFieldRegion[] = [];

  const panBox = findPanBox(result, parsed.panDigits);
  if (panBox) {
    regions.push({ kind: 'pan', text: parsed.panDigits, box: panBox });
  }

  if (parsed.expiryMonth != null && parsed.expiryYear != null) {
    const expiryBox = findExpiryBox(
      result,
      parsed.expiryMonth,
      parsed.expiryYear,
    );
    if (expiryBox) {
      regions.push({
        kind: 'expiry',
        text: formatExpiry(parsed.expiryMonth, parsed.expiryYear),
        box: expiryBox,
      });
    }
  }

  if (parsed.cardholderName) {
    const nameBox = findNameBox(result, parsed.cardholderName);
    if (nameBox) {
      regions.push({
        kind: 'name',
        text: parsed.cardholderName,
        box: nameBox,
      });
    }
  }

  return regions;
}

/**
 * True image dimensions as the recognizer saw them.
 *
 * `takePictureAsync({ skipProcessing: true })` returns pre-rotation sensor
 * dimensions — expo-camera documents this as "orientation uncertainty" — while
 * ML Kit applies EXIF orientation before recognising. The app is portrait-locked,
 * so the upright image is always portrait; taking the reported values at face
 * value yields landscape dimensions and pushes every mapped box off-screen.
 */
export function resolveImageSize(
  reportedWidth: number | undefined,
  reportedHeight: number | undefined,
  result: OcrResultLike,
): { width: number; height: number } | null {
  const boxes = allLines(result)
    .map((line) => line.boundingBox)
    .filter(isUsableBox);

  const extent = unionBoxes(boxes);
  const w = reportedWidth ?? 0;
  const h = reportedHeight ?? 0;

  if (w <= 0 || h <= 0) {
    // No reported size — fall back to the detected extent so mapping still works.
    if (!extent) return null;
    return { width: extent.x + extent.width, height: extent.y + extent.height };
  }

  let width = Math.min(w, h);
  let height = Math.max(w, h);

  // Detected geometry beats the portrait assumption when the two disagree.
  if (extent) {
    const needW = extent.x + extent.width;
    const needH = extent.y + extent.height;
    const overflows = needW > width || needH > height;
    const fitsTransposed = needW <= height && needH <= width;
    if (overflows && fitsTransposed) {
      return { width: height, height: width };
    }
  }

  return { width, height };
}

export type CoverTransform = { scale: number; offsetX: number; offsetY: number };

/**
 * Transform matching a preview that fills the view and center-crops overflow
 * (`resizeMode: cover`), which is how `CameraView` renders.
 */
export function coverTransform(
  imageWidth: number,
  imageHeight: number,
  viewWidth: number,
  viewHeight: number,
): CoverTransform {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.max(viewWidth / imageWidth, viewHeight / imageHeight);
  return {
    scale,
    offsetX: (viewWidth - imageWidth * scale) / 2,
    offsetY: (viewHeight - imageHeight * scale) / 2,
  };
}

export function mapBox(box: Box, transform: CoverTransform): Box {
  return {
    x: box.x * transform.scale + transform.offsetX,
    y: box.y * transform.scale + transform.offsetY,
    width: box.width * transform.scale,
    height: box.height * transform.scale,
  };
}

/**
 * Regions in screen coordinates. Returns an empty list when the image size
 * can't be resolved, so callers can fall back to a plain confirmation.
 */
export function mapRegionsToScreen(
  regions: OcrFieldRegion[],
  imageSize: { width: number; height: number } | null,
  viewWidth: number,
  viewHeight: number,
): OcrFieldRegion[] {
  if (!imageSize) return [];
  const transform = coverTransform(
    imageSize.width,
    imageSize.height,
    viewWidth,
    viewHeight,
  );
  return regions.map((region) => ({
    ...region,
    box: mapBox(region.box, transform),
  }));
}

/**
 * Drop regions that can't plausibly belong to the card the user framed.
 *
 * Mapping assumes the preview crop matches the captured image. When a device
 * reports something unexpected the result is boxes outside the frame, so
 * discarding them makes the reveal fall back to a plain fade-in rather than
 * flying labels in from off-screen.
 *
 * Every edge is tested, not just the centre: a wide PAN box can sit centred on
 * the card while its left edge is still off the display, which is exactly what
 * made labels and detect outlines start from outside the screen. Pass `viewport`
 * so a box that clears the frame check but not the display is dropped too.
 */
export function regionsWithinFrame(
  regions: OcrFieldRegion[],
  frame: { x: number; y: number; width: number; height: number },
  options: {
    /** Screen size in the same units as the mapped boxes. */
    viewport?: { width: number; height: number };
    tolerance?: number;
  } = {},
): OcrFieldRegion[] {
  const { viewport, tolerance = 0.25 } = options;
  const padX = frame.width * tolerance;
  const padY = frame.height * tolerance;
  const minX = frame.x - padX;
  const maxX = frame.x + frame.width + padX;
  const minY = frame.y - padY;
  const maxY = frame.y + frame.height + padY;

  return regions.filter(({ box }) => {
    // A single field larger than the framed card means the mapping is wrong.
    if (box.width > frame.width * 1.2) return false;
    if (box.height > frame.height * 0.6) return false;

    if (box.x < minX || box.x + box.width > maxX) return false;
    if (box.y < minY || box.y + box.height > maxY) return false;

    if (viewport) {
      if (box.x < 0 || box.y < 0) return false;
      if (box.x + box.width > viewport.width) return false;
      if (box.y + box.height > viewport.height) return false;
    }

    return true;
  });
}
