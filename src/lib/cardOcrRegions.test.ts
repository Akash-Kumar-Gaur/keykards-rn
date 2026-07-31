import {
  coverTransform,
  findFieldRegions,
  mapBox,
  mapRegionsToScreen,
  regionsWithinFrame,
  resolveImageSize,
  type OcrResultLike,
} from '@/lib/cardOcrRegions';
import { parseCardOcrText } from '@/lib/cardOcrParse';

const PAN = '4111111111111111';

function line(text: string, x: number, y: number, w: number, h: number) {
  return {
    text,
    boundingBox: { x, y, width: w, height: h },
    elements: text.split(' ').map((token, i) => ({
      text: token,
      boundingBox: {
        x: x + (w / text.split(' ').length) * i,
        y,
        width: w / text.split(' ').length,
        height: h,
      },
    })),
  };
}

function result(lines: ReturnType<typeof line>[]): OcrResultLike {
  return {
    text: lines.map((l) => l.text).join('\n'),
    blocks: [
      {
        text: lines.map((l) => l.text).join('\n'),
        boundingBox: { x: 0, y: 0, width: 1000, height: 600 },
        lines,
      },
    ],
  };
}

describe('findFieldRegions', () => {
  it('locates PAN, expiry and name from a single-line PAN', () => {
    const ocr = result([
      line('4111 1111 1111 1111', 60, 300, 800, 60),
      line('VALID THRU 09/29', 60, 420, 300, 40),
      line('ASHA MENON', 60, 480, 260, 40),
    ]);
    const parsed = parseCardOcrText(ocr.text)!;
    expect(parsed).not.toBeNull();

    const regions = findFieldRegions(ocr, parsed);
    const kinds = regions.map((r) => r.kind);

    expect(kinds).toContain('pan');
    expect(kinds).toContain('expiry');
    expect(kinds).toContain('name');

    const pan = regions.find((r) => r.kind === 'pan')!;
    expect(pan.box).toEqual({ x: 60, y: 300, width: 800, height: 60 });
  });

  it('unions element boxes when the PAN is split across groups', () => {
    const groups = line('4111 1111 1111 1111', 100, 200, 400, 50);
    // Drop the line-level text so only the element run can match.
    const ocr = result([{ ...groups, text: 'xxxx xxxx xxxx xxxx' }]);
    const parsed = parseCardOcrText('4111111111111111 09/29')!;

    const regions = findFieldRegions(ocr, parsed);
    const pan = regions.find((r) => r.kind === 'pan');

    expect(pan).toBeDefined();
    expect(pan!.box.x).toBeCloseTo(100);
    expect(pan!.box.width).toBeCloseTo(400);
  });

  it('omits fields it cannot trace back to recognized text', () => {
    const ocr = result([line('4111 1111 1111 1111', 0, 0, 100, 20)]);
    const parsed = parseCardOcrText('4111111111111111 09/29 ASHA MENON')!;

    const regions = findFieldRegions(ocr, parsed);

    expect(regions.map((r) => r.kind)).toEqual(['pan']);
  });

  it('reports the expiry exactly as parsed', () => {
    const ocr = result([
      line('4111 1111 1111 1111', 0, 0, 100, 20),
      line('09/29', 10, 40, 40, 15),
    ]);
    const parsed = parseCardOcrText(ocr.text)!;

    const expiry = findFieldRegions(ocr, parsed).find(
      (r) => r.kind === 'expiry',
    );

    expect(expiry?.text).toBe('09/29');
  });
});

describe('resolveImageSize', () => {
  const ocr = result([line('4111 1111 1111 1111', 100, 200, 800, 60)]);

  it('keeps reported dimensions when boxes fit inside them', () => {
    expect(resolveImageSize(3072, 4096, ocr)).toEqual({
      width: 3072,
      height: 4096,
    });
  });

  it('normalizes landscape sensor dimensions to portrait', () => {
    // skipProcessing reports pre-rotation dimensions; ML Kit recognised the
    // upright portrait image, so taking these at face value threw the mapping
    // hundreds of points to the left of the screen.
    expect(resolveImageSize(4096, 3072, ocr)).toEqual({
      width: 3072,
      height: 4096,
    });
  });

  it('transposes when boxes only fit the swapped dimensions', () => {
    // 960 wide can't hold a box ending at x=900 + rotation, but 4096 can.
    const wide = result([line('4111 1111 1111 1111', 100, 200, 3000, 60)]);
    expect(resolveImageSize(1000, 4096, wide)).toEqual({
      width: 4096,
      height: 1000,
    });
  });

  it('falls back to the detected extent when no size is reported', () => {
    expect(resolveImageSize(undefined, undefined, ocr)).toEqual({
      width: 900,
      height: 260,
    });
  });
});

describe('coverTransform', () => {
  it('center-crops horizontally when the image is wider than the view', () => {
    const t = coverTransform(200, 100, 100, 100);
    expect(t.scale).toBe(1);
    expect(t.offsetX).toBe(-50);
    expect(t.offsetY).toBe(0);
  });

  it('maps a box through scale and offset', () => {
    const t = coverTransform(100, 100, 200, 200);
    expect(mapBox({ x: 10, y: 20, width: 30, height: 40 }, t)).toEqual({
      x: 20,
      y: 40,
      width: 60,
      height: 80,
    });
  });
});

describe('mapRegionsToScreen', () => {
  it('returns nothing when the image size is unknown', () => {
    const regions = [
      { kind: 'pan' as const, text: PAN, box: { x: 0, y: 0, width: 1, height: 1 } },
    ];
    expect(mapRegionsToScreen(regions, null, 400, 800)).toEqual([]);
  });

  it('scales regions into view coordinates', () => {
    const regions = [
      {
        kind: 'pan' as const,
        text: PAN,
        box: { x: 50, y: 50, width: 100, height: 20 },
      },
    ];
    const mapped = mapRegionsToScreen(
      regions,
      { width: 200, height: 400 },
      400,
      800,
    );
    expect(mapped[0]!.box).toEqual({ x: 100, y: 100, width: 200, height: 40 });
  });
});

describe('regionsWithinFrame', () => {
  const frame = { x: 70, y: 400, width: 340, height: 214 };
  const region = (box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => ({ kind: 'pan' as const, text: PAN, box });

  it('keeps a field sitting on the framed card', () => {
    const inside = region({ x: 100, y: 500, width: 280, height: 30 });
    expect(regionsWithinFrame([inside], frame)).toHaveLength(1);
  });

  it('drops fields mapped off the left of the screen', () => {
    const offScreen = region({ x: -480, y: 500, width: 280, height: 30 });
    expect(regionsWithinFrame([offScreen], frame)).toEqual([]);
  });

  it('drops fields mapped far below the frame', () => {
    const belowFrame = region({ x: 100, y: 1400, width: 280, height: 30 });
    expect(regionsWithinFrame([belowFrame], frame)).toEqual([]);
  });

  it('drops a field wider than the framed card', () => {
    const tooWide = region({ x: 80, y: 500, width: 900, height: 30 });
    expect(regionsWithinFrame([tooWide], frame)).toEqual([]);
  });

  it('drops a field whose left edge is off the frame even when centred on it', () => {
    // Centre lands on the card, so a centre-only test would have kept it.
    const edgeOutside = region({ x: -60, y: 500, width: 380, height: 30 });
    const centerX = edgeOutside.box.x + edgeOutside.box.width / 2;
    expect(centerX).toBeGreaterThan(frame.x);
    expect(centerX).toBeLessThan(frame.x + frame.width);
    expect(regionsWithinFrame([edgeOutside], frame)).toEqual([]);
  });

  it('drops a field that clears the frame but not the display', () => {
    const viewport = { width: 480, height: 1000 };
    // Inside the padded frame, yet its left edge is off the screen.
    const offDisplay = region({ x: -10, y: 500, width: 300, height: 30 });
    expect(regionsWithinFrame([offDisplay], frame)).toHaveLength(1);
    expect(regionsWithinFrame([offDisplay], frame, { viewport })).toEqual([]);
  });

  it('keeps a field fully inside both the frame and the display', () => {
    const viewport = { width: 480, height: 1000 };
    const inside = region({ x: 100, y: 500, width: 280, height: 30 });
    expect(regionsWithinFrame([inside], frame, { viewport })).toHaveLength(1);
  });
});
