(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Frame sequences: fold 1 exported 1:1 from "fold 1.mp4"; fold 2 is the
  // macro move through the dishes and the bill book drop (Higgsfield), which
  // starts on fold 1's last frame.
  //
  // Everything is laid out in one shared coordinate frame, 1718 x 1080 (the
  // old fold 2's picture). Fold 1 and fold 2 are the same 1920 x 1080 framing,
  // 101px wider on the left, so both are drawn at x = -101.
  // ---------------------------------------------------------------------------
  const FRAME_W = 1718;
  const FRAME_H = 1080;

  const SEQUENCES = {
    fold1: { count: 193, fps: 24, rect: { x: -101, y: 0, w: 1920, h: 1080 } },
    fold2: { count: 230, fps: 15, rect: { x: -101, y: 0, w: 1920, h: 1080 } },
  };

  // Fold 1, 0:00–0:04 plays on load; everything after it is driven by scroll.
  const INTRO_END = 4 * SEQUENCES.fold1.fps; // frame index at 0:04: the landing view (its frames load before anything plays)
  const INTRO_LAST = SEQUENCES.fold1.count - 1; // the top view of the table (fold 1's last frame)

  // ---------------------------------------------------------------------------
  // Fold 3: the hand holding the credit card ("Fold 3/Fold 3 hand.png", cut out
  // of its background as layers/hand.webp, 2268 x 1550), placed, sized and
  // turned to match "Fold 3/Fold 3 hand ref.png". `place` is in fold 3 px (the
  // 1720 x 1116 frame, cover-fitted like fold3.jpg): where the image's centre
  // goes, its rotation, and fold 3 px per image px.
  // ---------------------------------------------------------------------------
  const LAYERS = {
    arm: { src: 'layers/hand.webp', w: 2268, h: 1550, place: { x: 290.6, y: 645.0, rot: -30.6, scale: 0.5833 } },
    // (the card is painted into hand.webp, the gradient one; for a crisp card layer with a light
    // sweep, add `card: { src, box }` here: drawCardSweep() draws it. The last ones are in higgsfield outputs/hand_painted/)
  };
  const FOLD3_W = 1720; // "fold3.jpg" minus the 2px strip at the bottom
  const FOLD3_H = 1116;

  // The scroll timeline. Everything after the landing view is scrubbed by the
  // scroll: each stretch of scroll plays one part, forwards going down and
  // backwards going up, and holds still when the scroll does. Units are
  // "timeline seconds" (fold 1 runs at its own 24 fps); SCROLL_VH_PER_S sets
  // how much scrolling one of them takes.
  const SCROLL_VH_PER_S = 28;
  const F1_SCROLL_TIME = (SEQUENCES.fold1.count - 1) / SEQUENCES.fold1.fps;
  // Fold 2: the camera's glide through the dishes (frames 0-170), compressed so
  // the trip from the table to the bill book takes much less scrolling, then
  // the hand placing the bill book (frames 170-229).
  // Not every frame gets the same share of the scroll: the video has repeated
  // frames (nothing changes from one to the next) and near-still stretches
  // (the camera easing to a stop just after it tips down from the top view to
  // the table top; the table holding still before the hand comes in; the
  // hand resting on the bill book before it pulls back), which read as the
  // scroll hesitating. Those get little of it, so the move carries on evenly.
  // (Frame-to-frame change measured on the frames; k is the step k -> k+1.)
  const F2_DUPS = [7, 12, 14, 19, 24, 33, 36, 43, 61, 80, 94, 118, 146, 172, 174, 177, 179, 182, 192, 194, 195,
    198, 200, 202, 205, 207, 208, 209, 219, 223, 224, 226, 228];
  const F2_STILL = [[53, 61, 0.45], [158, 180, 0.3], [195, 212, 0.3]]; // [from step, to step, share of the scroll]
  const F2_ACC = (() => {
    const steps = SEQUENCES.fold2.count - 1, acc = [0];
    for (let k = 0; k < steps; k++) {
      let w = F2_DUPS.includes(k) ? 0.08 : 1;
      for (const [a, b, f] of F2_STILL) if (k >= a && k < b) w *= f;
      acc.push(acc[k] + w);
    }
    return acc;
  })();
  const F2_GLIDE_TO = 170;
  // The glide (to frame 170) and the hand each keep their own speed for the
  // frames that move (the glide 170 frames to 4 s, the hand 59 to 3 s); only
  // the repeats and the still stretches are taken out of their lengths.
  const F2_LAST = SEQUENCES.fold2.count - 1;
  const F2 = {
    glide: { to: F2_GLIDE_TO, len: (4 * F2_ACC[F2_GLIDE_TO]) / F2_GLIDE_TO },
    hand: { len: (3 * (F2_ACC[F2_LAST] - F2_ACC[F2_GLIDE_TO])) / (F2_LAST - F2_GLIDE_TO) },
  };
  const F2_SCROLL_TIME = F2.glide.len + F2.hand.len;
  const VIDEO_END = F1_SCROLL_TIME + F2_SCROLL_TIME;
  function fold2Frame(t) { // timeline seconds into fold 2 -> frame position
    const last = F2_LAST, G = F2_ACC[F2_GLIDE_TO];
    const want = t <= F2.glide.len                // even through the weighted frames
      ? (Math.max(0, t) / F2.glide.len) * G
      : G + (Math.min(1, (t - F2.glide.len) / F2.hand.len)) * (F2_ACC[last] - G);
    let k = 0;
    while (k < last - 1 && F2_ACC[k + 1] < want) k++;
    return k + (want - F2_ACC[k]) / (F2_ACC[k + 1] - F2_ACC[k]);
  }
  // The rest, one stretch after another (start, length); the gaps between
  // them are for reading the text that comes with each.
  const SEG = {};
  {
    let at = VIDEO_END;
    const add = (name, gap, len) => { at += gap; SEG[name] = [at, at + len]; at += len; };
    add('rest', 0, 1.0);     // the bill book at rest, "introducing, dining pass."
    add('fold3', 0.4, 2.0);  // the hand with the card comes in
    // the images pop in: the first one as the card comes to rest (just over half way
    // through the hand's stretch, where its ease-out looks settled), no pause
    add('collage', -0.9, 1.0);
    add('facade', 0.9, 1.2); // the facade stamp zooms up
    add('gate', 0.1, 2.6);   // through the gate into the gallery
    add('dive', 1.5, 1.5);   // the camera pushes into the painting in the frame, as through a window
    add('f5', 0, 1.7);       // the map, unfolding over the painting
    add('f6', 0.9, 3.5);     // the receipts
    add('f7', 1.0, 1.0);     // bon appetit.
    SEG.end = at + 1.2;
  }
  const T = { rest: SEG.rest, fold3: SEG.fold3 };
  const SCROLL_TIME = SEG.end;
  const START_TIME = 0; // the top of the scroll: 0:00, the closed curtains (the page starts at the landing view, LANDING_TIME)
  const SCROLL_SPAN = SCROLL_TIME - START_TIME;
  // Some parts get more scroll distance per second than the rest, so their
  // frames follow the scroll closely and can be scrubbed through by hand: the
  // glide from the top of the table down to the bill book (fold 1.2 -> 2), and
  // the facade zoom and the way through the gate (fold 3 -> 4). [from, to, weight]
  const SCROLL_WEIGHTS = [[F1_SCROLL_TIME, VIDEO_END, 2.5], [SEG.facade[0], SEG.gate[1], 2.5]];
  // timeline seconds <-> scroll units (a second of weight 1 is one unit)
  function tToU(t) {
    let u = t - START_TIME;
    for (const [a, b, w] of SCROLL_WEIGHTS) u += (w - 1) * Math.max(0, Math.min(t, b) - a);
    return u;
  }
  const SCROLL_U = tToU(SCROLL_TIME);
  function uToT(u) {
    let t = START_TIME, left = u;
    const marks = [...SCROLL_WEIGHTS].sort((x, y) => x[0] - y[0]);
    for (const [a, b, w] of marks) {
      if (left <= a - t) return t + left;            // before this weighted stretch
      left -= a - t; t = a;
      if (left <= (b - a) * w) return t + left / w;  // inside it
      left -= (b - a) * w; t = b;
    }
    return Math.min(SCROLL_TIME, t + left);
  }
  // Stretches where the scroll is manual (no snap while the page stops inside
  // them). None at the moment: fold 3 -> 4 is magnetic again.
  const MANUAL = [];
  // Fold 2's first frame is fold 1's last, but its second lands 18.5 x 16.5 video px off it (the camera
  // jumps). Instead of a dissolve, the first frames are drawn shifted back by that much, the correction
  // easing to nothing by frame `until`, so the camera sets off from exactly where fold 1 stopped.
  const F2_JUMP = { dx: 18.5, dy: 16.5, until: 12 };
  function f2Shift(i) {
    if (i <= 0 || i >= F2_JUMP.until) return null;
    const e = 1 - smoothstep(1, F2_JUMP.until, i);
    return [F2_JUMP.dx * e, F2_JUMP.dy * e];
  }
  // The collage sequence (one timed moment, run by screenT).
  const COLLAGE_INTERVAL_MS = 65;  // between pops (twice the "fold 3.5" reference's rhythm)
  const COLLAGE_START = 0.04; // seconds into the sequence: a short beat after the hand is in
  const SCREEN_LEN = COLLAGE_START + (9 * COLLAGE_INTERVAL_MS) / 1000 + 0.1; // until the last of the 9 images is in

  // Facade close-up. layers/facade.webp is "Buidling facade.jpg" (1720 x 1118,
  // minus a 2px strip at the bottom), shown full-screen (cover fit) at the
  // end. `window` is the stamp's picture area in stamp.webp px (573 x 900).
  const FACADE = { src: 'layers/facade.webp', w: 1720, h: 1116, stamp: 'stamp', window: { x: 50, y: 45, w: 474, h: 815 } };
  const FACADE_ZOOM_MS = 1100; // length of the zoom
  const FACADE_CUT = 0.5;      // how far into the zoom the stamp picture hard-cuts to the close-up

  // Fly-through layers (layers/f3d), cut from "Buidling facade.jpg" upscaled
  // with Higgsfield (whole image 2.4x, gate area 7x) plus a Nano Banana plate
  // with the pillars and canopy soffit removed, so the wall behind them can be
  // revealed. Rects are in close-up px (1720 x 1116); `z` is depth (wall = 1).
  const F3D = {
    focus: { x: 849.5, y: 960.5 }, // centre of the gate doors
    wall: { src: 'layers/f3d/wall.webp', rect: { x: 0, y: 0, w: 1720, h: 1116 }, z: 1 },
    gate: { src: 'layers/f3d/gate.webp', rect: { x: 560, y: 620, w: 580, h: 496 }, z: 1 },
    canopy: { src: 'layers/f3d/canopy.webp', rect: { x: 0, y: 422, w: 1720, h: 196 }, z: 0.82 },
    pillarL: { src: 'layers/f3d/pillar_l.webp', rect: { x: 450, y: 494, w: 80, h: 622 }, z: 0.62 },
    pillarR: { src: 'layers/f3d/pillar_r.webp', rect: { x: 1178, y: 494, w: 80, h: 622 }, z: 0.62 },
    doorL: { src: 'layers/f3d/door_l.webp' },
    doorR: { src: 'layers/f3d/door_r.webp' },
    door: { x: 738, y: 840, w: 223, h: 241, split: 849.5 },
  };
  // Behind the doorway: the gallery, fold 4 (after "fold 4.mp4"). The room is
  // "gallery painted.png" (5056 x 3392, the painted version of "Fold4/fold4 bg.png"),
  // split into layers at different depths (Nano Banana painted the wall in
  // behind the frame), seen through the doors
  // close to its final size and settling, with a little parallax, into the
  // framing of "Fold4.png" (frame on the right, copy on the left); the frame
  // holds the painting from "fold4.2 bg.png" (upscaled with Higgsfield). The
  // next scroll pushes into that painting (see `dive`).
  // Positions are in room px.
  const GALLERY = {
    w: 5056, h: 3392,
    views: [ // what fills the screen at rest
      { x: 329, y: 588, w: 3281, h: 2121 },
    ],
    layers: [ // back to front; `d` is the distance from the stopped camera (the facade wall is 1 from the start)
      { key: 'gWall', src: 'layers/gallery/wall.webp', d: 2.0 },  // back wall and wainscot (frame taken out)
      { key: 'gFrame', src: 'layers/gallery/frame.webp', d: 1.85, rect: { x: 1847, y: 1057, w: 1258, h: 1018 } }, // frame + part 1 painting + its painted shadow
      { key: 'gPainting2', src: 'layers/gallery/painting2.webp', d: 1.85, rect: { x: 2130, y: 1270, w: 762, h: 518 }, swap: true }, // the painting shown in the frame ("fold4.2 bg.png")
      { key: 'gShell', src: 'layers/gallery/shell.webp', d: 1.7 },  // side walls and cornice
      { key: 'gFloor', src: 'layers/gallery/floor.webp', d: 1.5 },  // the floor
    ],
    stopZ: 1.4, // where the camera stops
  };
  // Fold 5 (after "Fold5/Fold 5.mp4"), from "Fold5/": the map unfolds over the
  // gallery from the bottom-right corner, the grid-paper card drops in at the
  // bottom left, its copy types itself out, then the pins pop in one by one.
  // Map positions are in "map.png" px (10633 x 6273; layers/fold5/map.webp is
  // it at 0.4x). `view` is what fills the screen (the video's last frame).
  // Pins: `x`, `y` is where the tip lands, in the order they pop.
  const FOLD5 = {
    map: { src: 'layers/fold5/map.webp', w: 10633, h: 6273 },
    view: { x: 968, y: 308, w: 8700, h: 5655 },
    pin: { src: 'layers/fold5/pin.webp', w: 430, tip: { x: 0.499, y: 0.998 }, grain: 1.6, grainFill: 0.22 }, // "Fold5/map pin.png"; width in map px; tip as a share of the image; grain: width of the grainy edge (px); grainFill: strength of the grain over it
    pins: [
      { x: 4433, y: 3813 }, { x: 4812, y: 3915 }, { x: 2531, y: 4107 }, { x: 3386, y: 4309 }, { x: 8530, y: 4977 },
      { x: 2637, y: 1790 }, { x: 9071, y: 4597 }, { x: 9046, y: 3813 }, { x: 9086, y: 5230 },
      { x: 6776, y: 4572 }, { x: 7021, y: 4979 }, // added where marked
    ],
    card: { src: 'layers/fold5/grid.webp', w: 840 / 1720, h: 458 / 1720, drop: 50, slant: 3, grainFill: 0.05, lineGrain: 0.45 }, // grainFill: the grain's strength (±5%); lineGrain: how far the grain lifts the grid lines toward the paper // wide enough for "restaurants in Bengaluru" // share of the screen width, anchored bottom left; slant in degrees (anticlockwise)
    ms: 1550,                 // the whole sequence
    unfold: [0, 0.55],        // seconds: the map unfolding
    cardIn: [0.5, 0.88],      // the card unfolding in from beyond the bottom-left corner
    copyAt: 0.85,             // seconds: the card's copy slides in (as the card finishes opening)
    pinsAt: [0.95, 0.05],     // first pin (straight after the copy, no pause), then one every ... (all 11 in by the end of ms)
  };
  // Fold 6 (after "copy placement/6.png" and "6.2.png"): a white page wipes up
  // over the map, then the receipt ("Fold6/Receipt.png", cut out with a torn
  // bottom edge) pops in rolled up at the top of the screen (no fade) and
  // unrolls downward: the roll travels down, shrinking as it pays out paper,
  // and is gone once the receipt hangs flat. Three more receipts pop in and
  // unroll beside it in quick succession; before the last is out, the view
  // zooms in on the first one's total (the bill turning 20 degrees
  // anticlockwise), the others sweeping out of the frame as it moves, in
  // parallax. The total counts down from 4,149 to 3,319 (the digits are cut
  // from the receipt's own print), then the "thank you for visiting" block
  // rolls up out of sight inside its own patch of the bill, and "THE LAST
  // COURSE IS ON US." rolls up into it, set from the letters printed on the
  // bill itself (see makePrint).
  // Positions are shares of the screen; receipt positions are in receipt px
  // (the strip at 761 x 2040, whatever the image's own resolution).
  const FOLD6 = {
    receipt: { src: 'layers/fold6/receipt.webp', w: 761, h: 2040 },
    rest: { cx: 0.1597, top: 0.0995, h: 0.768 * 1.15 * 1.15 }, // two rounds of 15% larger than the reference // the first receipt: centre x (share of the width); top and height (shares of the height)
    bills: 4,                                     // how many unroll
    // where the others lie, after "Fold6/bills layout" (the reference): the middle of each one's top edge
    // (shares of the width and height) and its turn (degrees, clockwise); drawn in this order, the first one last (on top)
    others: [
      { x: 0.4825, top: 0.2154, deg: 19.5 },
      { x: 0.7035, top: 0.1123, deg: -1.4 },
      { x: 0.876, top: 0.163, deg: -8.5 },
    ],
    order: [2, 3, 1, 0],
    stagger: 0.072,                               // seconds between one receipt popping in and the next
    roll: { r0: 0.05, r1: 0.012 },                 // the roll's radius, full and at the end (shares of the height)
    ms: 3400,
    wipe: [0, 0.3],          // seconds: the white page sliding up
    unroll: [0.3, 0.69],     // the receipt unrolling down (it pops in, rolled up, as this starts)
    zoom: [0.7, 1.015],      // zooming in on the first receipt's total (the last receipt is still unrolling); the camera takes in all of them
    parallax: 0.9,           // how much further than the camera the others travel (share of the screen width; the further ones more)
    count: [1.35, 2.225],    // the total counting down (a quarter of a second after the zoom lands)
    // where the total ends up (share of the screen), how much bigger, the turn (degrees, anticlockwise)
    zoomTo: { x: 0.352, y: 0.156, scale: 2.545 / (1.15 * 1.15), deg: 20 }, // (over the larger bills: the same close-up) // as in "6.2.png": the bottom of the bill in view
    total: {
      focus: { x: 632, y: 1442 },                 // the middle of "4,149.00" on the TOTAL line
      from: 4149, to: 3319,
      cols: [578, 612.5, 631, 650.5],             // digit cells: thousands, hundreds, tens, units (centres)
      half: 9.5,                                  // half a cell's width
      rows: [[1424, 1462], [1577, 1614]],         // both TOTAL lines (top, bottom)
      blankX: 300,                                // a stretch of blank paper on the same lines
      glyphs: {                                   // where each digit is printed elsewhere: [cell centre, row top, row bottom]
        0: [650.5, 843, 879], 1: [612.5, 1424, 1462], 2: [650, 1218, 1256], 3: [578, 1218, 1256], 4: [631, 1424, 1462],
        5: [631, 843, 879], 6: [688.5, 1286, 1320], 7: [612, 1218, 1256], 8: [631, 1286, 1320], 9: [650.5, 1424, 1462],
      },
    },
    // the "thank you for visiting" block (receipt px: the patch it rolls within), and what replaces it
    swap: {
      mask: [1785, 2026],    // top and bottom of the patch
      paper: [1766, 1800],   // a band of blank paper to fill it with
      out: [2.57, 2.92],     // the old block rolling up out of sight
      in: [2.82, 3.27],      // the new text rolling up into place
      lines: ['THE LAST COURSE', 'IS ON US.'],
      x: 47, base: [1884, 1950], cap: 38, // left edge, baselines, capital height (receipt px)
      // set in the receipt's own print: each letter cut from a line printed on it
      // (receipt px: where the line's first character cell starts, its rows, the text)
      pitch: 18.15,
      from: [
        { x0: 46, top: 1728, bottom: 1766, text: 'CARDHOLDER: LYN :-)' },
        { x0: 46, top: 1686, bottom: 1718, text: 'AUTH CODE: 123421' },
        { x0: 171, top: 1807, bottom: 1841, text: 'THANK YOU FOR VISITING!' },
      ],
      ink: [71, 68, 63],     // the colour of the print
    },
    head: [1.05, 0.35],       // seconds: the body on the right sliding in (start, duration)
    body: [0.7, 0.35],
  };
  // Fold 7 ("Fold 7/fold 7 bg.mp4" on loop, copy after "Fold 7 ref.png"): the
  // video wipes up over fold 6 like the white page before it, then the copy
  // eases in (fade + rise), heading then the line under it.
  const FOLD7 = { ms: 1000, wipe: [0, 0.55], head: [0.45, 0.8], body: [0.6, 0.95] };
  const GATE_MS = 2900;   // the whole fly-through, from the close-up to rest in front of the painting
  // The camera travels one straight line at constant speed from the close-up
  // into the doorway. The doors open while it travels, over this share of GATE_MS.
  const GATE_DOORS_OPEN = [0.35, 0.82]; // camera depth (wall = 1) over which the doors swing open
  const GATE_EASE_IN = 0.1;        // share of GATE_MS spent getting up to speed from rest
  const GATE_EASE_OUT = 0.4;       // share of GATE_MS spent slowing to a stop in the gallery (where the parallax shows most)
  const DOOR_OPEN_DEG = 80;
  const LANDING_TIME = INTRO_END / SEQUENCES.fold1.fps;
  const INTRO_FADE_MS = 700;      // the landing animation fading in from black behind it

  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const progress = (t, [a, b]) => clamp01((t - a) / (b - a));
  const within = (p, a, b) => clamp01((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------------------
  // Collage ("IMAGE SCROLL"), laid out after "Fold 3/fold 3 new ref.png": a
  // diagonal from the card up to the top right. Centres and widths are in
  // fold 3 px; rot in degrees. Listed in the order they pop, which is also
  // their stacking order.
  // ---------------------------------------------------------------------------
  const COLLAGE = [ // after "Fold 3/fold 3 new ref.png"
    { name: 'party', x: 382, y: 456, w: 279, rot: -18.8 },
    { name: 'ramen', x: 516, y: 585, w: 289, rot: 3.0 },
    { name: 'stamp', x: 685, y: 681, w: 249, rot: 9.6 },
    { name: 'canapes', x: 871, y: 530, w: 269, rot: -3.9 },
    { name: 'tray', x: 1105, y: 408, w: 279, rot: 3.0 },
    { name: 'badge', x: 978, y: 392, w: 88, rot: -50.9 }, // "Dining badge 2.png", the realistic gold coin
    { name: 'stamp-round', x: 1250, y: 638, w: 251, rot: -0.3 },
    { name: 'table-bw', x: 1388, y: 445, w: 303, rot: -2.4 },
    { name: 'plate', x: 1492, y: 235, w: 404, rot: 0.8 },
  ];

  // ---------------------------------------------------------------------------
  // Mobile (phones, under 768px wide), after "dining mobile ref/": the same
  // folds and timing, laid out for a portrait screen. Positions on the canvas
  // are in the references' px (390 x 844), scaled to the screen's width and
  // centred top to bottom; the text is placed in styles.css.
  // ---------------------------------------------------------------------------
  const MOBILE_QUERY = window.matchMedia('(max-width: 767px)');
  let isMobile = MOBILE_QUERY.matches;
  const MOBILE = {
    W: 390, H: 844,
    // fold 1 and 2 frames (1920 x 1080): the point at the centre of the screen
    // and how much closer than a full-height fit; fold 2 eases from fold 1's
    // framing to the bill book's over the move
    frame: { fold1: { x: 960, y: 540, zoom: 1 }, fold2end: { x: 848, y: 534, zoom: 1080 / 1020 } },
    arm: { x: 133, y: 656.8, rot: -31.5, scale: 658.83 / 2268 }, // after "mob/FOLD3.png"
    collage: [ // after "Dining Folds bg/mob/FOLD3.png": the collage below the heading, about each image's own centre
      { name: 'party', x: 141, y: 523.5, w: 121, rot: -14.3 },
      { name: 'ramen', x: 205.5, y: 508.5, w: 113, rot: 170 },
      { name: 'stamp', x: 307, y: 470, w: 101, rot: 5.4 },
      { name: 'canapes', x: 265, y: 415, w: 82.5, rot: -3 },
      { name: 'tray', x: 220, y: 360, w: 85, rot: -25 },
      { name: 'badge', x: 100, y: 296, w: 29, rot: -42.8, top: true }, // drawn over everything
      { name: 'stamp-round', x: 129, y: 339, w: 93.5, rot: -5 },
      { name: 'table-bw', x: 189.3, y: 254.6, w: 86.5, rot: 6.2 },
      { name: 'plate', x: 273.5, y: 254, w: 184.3, rot: -1 }, // 20% larger, 5 degrees clockwise (and 10px lower, clear of the heading)
    ],
    // the gallery: the frame low, the cornice above, in room px;
    // the wall below the frame is made taller on a phone (wallExtend room px from wallCut down, a mirrored
    // copy of the wall above it), so the wainscot sits low as in the references
    // fold 4: the frame frameMargin px from either edge of the screen, in its bottom half (the view
    // is worked out from the screen in drawGateFlythrough); the wall is made taller upwards (wall
    // added at wallTopCut, above the frame, as much as the screen needs, the cornice moving up with
    // the top of the room) and downwards (wallExtend room px at wallCut, below the frame)
    gallery: [{ x: 1684.7, y: -1002.9, w: 1582.7, h: 3425.1 }],
    frameMargin: 40,
    frameBottom: 140, // px from the bottom of the screen to the frame's gilded bottom edge (not its shadow)
    frameGold: { x: 131, y: 64, w: 1061, h: 800 }, // the gilded frame inside frame.webp (the rest is its shadow)
    wallCut: 2140, wallExtend: 710,
    wallTopCut: 700,
    // the wall painted into the gap above with Higgsfield (Nano Banana 2.1, upscaled; 1003 room px tall
    // as painted, fitted to the gap), room px; its top and bottom 60px overlap the wall around it and
    // fade out, so it blends in
    wallTop: { src: 'layers/gallery/wall_top_m.webp', x: 1400, w: 2150, h: 1123, overlap: 60 },
    f5: {
      view: { x: 2670, y: 0, w: 2782, h: 6021 },
      pinW: 357,
      pins: [{ x: 3933, y: 1106 }, { x: 3112, y: 3538 }, { x: 4154, y: 3638 }, { x: 4674, y: 3709 }, { x: 4896, y: 3752 }, { x: 4896, y: 4473 }],
      card: { w: 250 / 390, h: 229 / 390 },
    },
    // one receipt, centred ("mob/FOLD6.png"), and the zoom of "mob/FOLD6.2.png": the foot of the bill in view, turned anticlockwise
    f6: { bills: 1, rest: { cx: 0.5, top: 122 / 844, h: 602 / 844 }, zoomTo: { x: 0.79, y: 0.2055, scale: 1.955, deg: 14.2 } },
  };
  // desktop values, kept to switch back
  const DESKTOP = {
    arm: { ...LAYERS.arm.place }, collage: COLLAGE.map((c) => ({ top: false, ...c })),
    gallery: null, f5: null, f6: null,
  };
  function applyLayout() {
    const m = isMobile;
    Object.assign(LAYERS.arm.place, m ? MOBILE.arm : DESKTOP.arm);
    const src = m ? MOBILE.collage : DESKTOP.collage;
    src.forEach((c, i) => Object.assign(COLLAGE[i], c));
    if (!DESKTOP.gallery) {
      DESKTOP.gallery = GALLERY.views.map((v) => ({ ...v }));
      DESKTOP.f5 = { view: { ...FOLD5.view }, pinW: FOLD5.pin.w, pins: FOLD5.pins.slice(), card: { w: FOLD5.card.w, h: FOLD5.card.h } };
      DESKTOP.f6 = { bills: FOLD6.bills, rest: { ...FOLD6.rest }, zoomTo: { ...FOLD6.zoomTo } };
    }
    (m ? MOBILE.gallery : DESKTOP.gallery).forEach((v, i) => Object.assign(GALLERY.views[i], v));
    const f5 = m ? MOBILE.f5 : DESKTOP.f5;
    Object.assign(FOLD5.view, f5.view); FOLD5.pin.w = f5.pinW; FOLD5.pins = f5.pins; Object.assign(FOLD5.card, f5.card);
    const f6 = m ? MOBILE.f6 : DESKTOP.f6;
    FOLD6.bills = f6.bills; Object.assign(FOLD6.rest, f6.rest); Object.assign(FOLD6.zoomTo, f6.zoomTo);
  }

  const base = 'frames/';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.documentElement;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const scrolly = document.getElementById('scrolly');
  // The screen height the scroll is measured against: the small viewport, which
  // doesn't change as a phone's address bar slides in and out (so the folds
  // don't jump when it does).
  const vhProbe = document.getElementById('vhProbe');
  const stableVH = () => vhProbe.offsetHeight || window.innerHeight;
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loaderBar');

  scrolly.style.setProperty('--scrub-length', `${(SCROLL_U * SCROLL_VH_PER_S).toFixed(1)}vh`);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  // --- Loading ----------------------------------------------------------------

  const frames = { fold1: [], fold2: [] };

  function frameUrl(name, i) {
    return `${base}${name}/${String(i + 1).padStart(4, '0')}.webp`;
  }

  // A large image kept decoded: the browser may drop an <img>'s decoded
  // pixels and decode it again mid-move (a 100-300 ms stall on the frame it is
  // drawn); an ImageBitmap keeps them. It answers to naturalWidth/Height like
  // the image it replaces.
  function keepDecoded(img) {
    if (!img || !window.createImageBitmap) return Promise.resolve(img);
    return createImageBitmap(img).then((b) => {
      b.naturalWidth = b.width; b.naturalHeight = b.height; b.src = img.src;
      return b;
    }).catch(() => img);
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => resolve(img));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Loads frames [from, to] of a sequence with limited concurrency, in order.
  function loadRange(name, from, to, onProgress) {
    const list = frames[name];
    const total = to - from + 1;
    let next = from;
    let done = 0;
    const worker = async () => {
      while (next <= to) {
        const i = next++;
        list[i] = await loadImage(frameUrl(name, i));
        done++;
        if (onProgress) onProgress(done / total, i);
      }
    };
    return Promise.all(Array.from({ length: 6 }, worker));
  }

  // --- Drawing ----------------------------------------------------------------

  let view = { w: 0, h: 0, dpr: 1, scale: 1, ox: 0, oy: 0 };
  let view3 = { scale: 1, ox: 0, oy: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    isMobile = MOBILE_QUERY.matches;
    applyLayout();
    const scale = Math.max(w / FRAME_W, h / FRAME_H); // cover
    view = { w, h, dpr, scale, ox: (w - FRAME_W * scale) / 2, oy: (h - FRAME_H * scale) / 2 };
    if (isMobile) { // fold 3 laid out in the mobile reference's px, scaled to fit the screen, centred
      const s3 = Math.min(w / MOBILE.W, h / MOBILE.H);
      view3 = { scale: s3, ox: (w - MOBILE.W * s3) / 2, oy: (h - MOBILE.H * s3) / 2 };
    } else {
      const s3 = Math.max(w / FOLD3_W, h / FOLD3_H); // fold 3 is laid out on its own cover fit
      view3 = { scale: s3, ox: (w - FOLD3_W * s3) / 2, oy: (h - FOLD3_H * s3) / 2 };
    }
    ctx.imageSmoothingQuality = 'high';
    lastDrawn = null;
    render(true);
  }

  // Draws one image of a sequence in the shared frame (with optional alpha).
  function drawFrame(name, img, alpha, shift) {
    const r = SEQUENCES[name].rect;
    const { dpr, scale, ox, oy } = view;
    ctx.globalAlpha = alpha;
    const nw = img.naturalWidth || img.width;
    const sh = (k) => (shift ? [shift[0] * k, shift[1] * k] : [0, 0]); // video px -> device px
    if (isMobile) { // portrait: a crop of the frame around a moving focus point
      const F = MOBILE.frame, a = F.fold1, b = F.fold2end;
      const p = name === 'fold2' ? smoothstep(0, 1, (Math.min(scrubPos, VIDEO_END) - F1_SCROLL_TIME) / F2_SCROLL_TIME) : 0;
      const fx = lerp(a.x, b.x, p), fy = lerp(a.y, b.y, p), zoom = lerp(a.zoom, b.zoom, p);
      const { w: vw, h: vh } = view;
      const s = Math.max(vw / r.w, vh / r.h) * zoom;
      const dx = Math.min(0, Math.max(vw - r.w * s, vw / 2 - fx * s)), dy = Math.min(0, Math.max(vh - r.h * s, vh / 2 - fy * s));
      const [sx, sy] = sh((r.w * s * dpr) / nw);
      ctx.drawImage(img, dx * dpr + sx, dy * dpr + sy, r.w * s * dpr, r.h * s * dpr);
      ctx.globalAlpha = 1;
      return;
    }
    const [sx, sy] = sh((r.w * scale * dpr) / nw);
    ctx.drawImage(
      img,
      (ox + r.x * scale) * dpr + sx,
      (oy + r.y * scale) * dpr + sy,
      r.w * scale * dpr,
      r.h * scale * dpr
    );
    ctx.globalAlpha = 1;
  }

  // Nearest loaded frame at or before i (falls back forward if needed).
  function nearest(name, i) {
    const list = frames[name];
    for (let j = i; j >= 0; j--) if (list[j]) return list[j];
    for (let j = i + 1; j < list.length; j++) if (list[j]) return list[j];
    return null;
  }

  // Renders sequence `name` at fractional frame position `pos`,
  // cross-fading between neighbouring frames for smooth scrubbing.
  function paint(name, pos) {
    const count = SEQUENCES[name].count;
    pos = Math.max(0, Math.min(count - 1, pos));
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, count - 1);
    const t = pos - i0;
    const a = nearest(name, i0);
    if (!a) return false;
    const b = t > 0.01 && frames[name][i1];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shiftA = name === 'fold2' ? f2Shift(i0) : null, shiftB = name === 'fold2' ? f2Shift(i1) : null;
    if (shiftA || shiftB) { const f0 = nearest('fold2', 0); if (f0) drawFrame(name, f0, 1); } // fills the edge a shifted frame leaves
    drawFrame(name, a, 1, shiftA);
    if (b) drawFrame(name, b, t, shiftB);
    return true;
  }

  // --- The bill book at rest + fold 3 ---------------------------------------------

  const layers = {};

  // Draws `img` with its centre at (cx, cy) CSS px, size w x h, optional
  // rotation (radians) about the image's bottom-left corner.
  function drawLayer(img, cx, cy, w, h, alpha = 1, rot = 0) {
    const { dpr } = view;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (rot) {
      ctx.translate(cx - w / 2, cy + h / 2);
      ctx.rotate(rot);
      ctx.translate(-(cx - w / 2), -(cy + h / 2));
    }
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  // Fold 3 layer at its resting place, in CSS px.
  function fold3Box(rect, offset = { x: 0, y: 0 }) {
    const { scale, ox, oy } = view3;
    return {
      cx: ox + (rect.x + offset.x + rect.w / 2) * scale,
      cy: oy + (rect.y + offset.y + rect.h / 2) * scale,
      w: rect.w * scale,
      h: rect.h * scale,
    };
  }


  // t = seconds past the end of fold 2 (the macro move and the bill book).
  function paintScene(t) {
    const { arm } = layers;
    const last = frames.fold2[SEQUENCES.fold2.count - 1];
    if (!arm || !last) {
      return paint('fold2', SEQUENCES.fold2.count - 1); // layers still loading
    }
    const now = VIDEO_END + t;
    const f3 = progress(now, T.fold3);
    const { h: vh } = view;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // The bill book at rest (fold 2's last frame), fading to fold 3's white as fold 3 arrives.
    drawFrame('fold2', last, 1);
    const white = easeInOut(within(f3, 0, 0.5));
    if (white > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${white})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // The hand with the card slides in from the bottom-left with an ease-out,
    // turning up into place.
    if (f3 > 0) {
      const p = easeOut(within(f3, 0.05, 0.85));
      const A = LAYERS.arm, P = A.place, s3 = view3.scale;
      const cx = view3.ox + P.x * s3 - view.w * 0.45 * (1 - p); // from off the bottom-left
      const cy = view3.oy + P.y * s3 + view.h * 0.75 * (1 - p);
      const k = P.scale * s3;
      ctx.save();
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.translate(cx, cy);
      ctx.rotate(((P.rot - 12 * (1 - p)) * Math.PI) / 180);
      ctx.scale(k, k);
      ctx.translate(-A.w / 2, -A.h / 2); // now in hand.webp px
      ctx.drawImage(arm, 0, 0, A.w, A.h);
      drawCardSweep(within(f3, CARD_SWEEP[0], CARD_SWEEP[1]));
      ctx.restore();

      drawCollage();

      drawFacadeZoom(); // in front of everything
      drawGateFlythrough(); // covers the screen once it starts
      drawFold5();          // the map, over the gallery
      drawFold6();          // the receipt, over the map
    }
    return true;
  }

  // The card in her hand, drawn over the hand (in hand.webp px), with a soft
  // band of light sweeping across it, and only it, as the hand comes to rest.
  const CARD_SWEEP = [0.5, 0.95]; // share of the hand's stretch over which the light crosses the card
  const cardSweep = { c: null, t: null };
  function drawCardSweep(k) {
    const img = layers.card; if (!img) return;
    const B = LAYERS.card.box;
    if (!cardSweep.c) { // the card, cropped to its box
      cardSweep.c = document.createElement('canvas'); cardSweep.c.width = B.w; cardSweep.c.height = B.h;
      cardSweep.c.getContext('2d').drawImage(img, B.x, B.y, B.w, B.h, 0, 0, B.w, B.h);
      cardSweep.t = document.createElement('canvas'); cardSweep.t.width = B.w; cardSweep.t.height = B.h;
    }
    if (k <= 0 || k >= 1) { ctx.drawImage(cardSweep.c, B.x, B.y); return; }
    const g = cardSweep.t.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, B.w, B.h); g.drawImage(cardSweep.c, 0, 0);
    // a diagonal band, from beyond the card's left edge to beyond its right
    const e = easeInOut(k), span = B.w + B.h, cx = -B.h * 0.5 + e * span, band = B.w * 0.26;
    const grad = g.createLinearGradient(cx - band, 0, cx + band, band * 0.9);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = grad; g.fillRect(0, 0, B.w, B.h);
    ctx.drawImage(cardSweep.t, B.x, B.y);
  }

  // --- Collage ------------------------------------------------------------------

  const collageImages = {};
  let screenT = 0; // seconds into the phone video + collage sequence (runs backwards on the way up)

  // How many images are showing: the first pops COLLAGE_START into the
  // sequence, then one every COLLAGE_INTERVAL_MS. Run backwards, they go
  // away last-first in the same rhythm.
  function collageCount() {
    if (screenT < COLLAGE_START) return 0;
    const n = 1 + Math.floor(((screenT - COLLAGE_START) * 1000) / COLLAGE_INTERVAL_MS + 1e-6);
    return Math.min(COLLAGE.length, n);
  }


  // Keeping the copy clear (desktop): the collage is laid out on its own fit
  // to the screen and the copy on the screen's width, so on some screen
  // shapes an image would run into the heading or the line under it. Any
  // image whose painted pixels come within COLLAGE_CLEAR px of the copy is
  // shrunk about its own centre until it doesn't, and if that isn't enough
  // (very wide or short screens) moved up or down, away from it (worked out
  // once per screen size, from a grid of points on each image's opaque pixels).
  const COLLAGE_CLEAR = 15;
  const COLLAGE_MIN_FIT = 0.7;    // the smallest an image is made before it is moved instead
  const collageShape = {};       // name -> opaque points, [u, v] from the image's centre in shares of its size
  const collageFits = { key: '', f: [] };
  function opaquePoints(img) {
    const N = 40, c = document.createElement('canvas'); c.width = N; c.height = N;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data, pts = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 60) pts.push([(x + 0.5) / N - 0.5, (y + 0.5) / N - 0.5]);
    return pts;
  }
  function copyBoxes() { // the fold 3 copy's line boxes at rest, in CSS px, padded
    const boxes = [];
    for (const el of copyBill.querySelectorAll('.ln')) {
      const m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform || ''), dy = m ? +m[1] : 0; // its slide in or out
      const r = document.createRange(); r.selectNodeContents(el);
      for (const b of r.getClientRects()) {
        if (b.width < 1) continue;
        boxes.push({ l: b.left - COLLAGE_CLEAR, r: b.right + COLLAGE_CLEAR, t: b.top - dy - COLLAGE_CLEAR, b: b.bottom - dy + COLLAGE_CLEAR });
      }
    }
    return boxes;
  }
  function collageFit(i) {
    if (isMobile) return { f: 1, dy: 0 };       // the phone layout is laid out with its copy (mob/FOLD3.png)
    const key = `${view.w}x${view.h}`;
    if (collageFits.key !== key) {
      const boxes = copyBoxes(), s3 = view3.scale;
      if (!boxes.length) return { f: 1, dy: 0 };
      collageFits.key = key;
      collageFits.f = COLLAGE.map((item) => {
        const img = collageImages[item.name];
        if (!img) { collageFits.key = ''; return { f: 1, dy: 0 }; } // not in yet: work it out again later
        const pts = collageShape[item.name] || (collageShape[item.name] = opaquePoints(img));
        const cx = view3.ox + item.x * s3, cy = view3.oy + item.y * s3, a = (item.rot * Math.PI) / 180;
        const cos = Math.cos(a), sin = Math.sin(a), W0 = item.w * s3, H0 = W0 * (img.naturalHeight / img.naturalWidth);
        const hit = (f, dy) => {                                 // the copy box it runs into, if any
          for (const [u, v] of pts) {
            const x = u * W0 * f, y = v * H0 * f, X = cx + x * cos - y * sin, Y = cy + dy + x * sin + y * cos;
            const b = boxes.find((q) => X > q.l && X < q.r && Y > q.t && Y < q.b);
            if (b) return b;
          }
          return null;
        };
        // shrink it (to 70% at most), then if it still crowds the copy, move it away from it, up or down
        let f = 1, b = hit(1, 0);
        while (b && f > COLLAGE_MIN_FIT) { f -= 0.01; b = hit(f, 0); }
        if (!b) return { f, dy: 0 };
        const dir = cy > (b.t + b.b) / 2 ? 1 : -1;
        for (let d = 2; d < view.h * 0.5; d += 2) if (!hit(f, dir * d)) return { f, dy: dir * d };
        return { f, dy: 0 };
      });
    }
    return collageFits.f[i] ?? { f: 1, dy: 0 };
  }
  if (document.fonts) document.fonts.ready.then(() => { collageFits.key = ''; });

  // Desktop: the images shy away from the mouse, as if magnetically repelled:
  // each is pushed straight away from the cursor, the nearer the more, by
  // REPEL.max px at most, easing in and back (a mouse only; not on phones,
  // nor with reduced motion).
  const REPEL = { max: 10, reach: 160, ease: 0.18 }; // px; reach: how far past an image's edge the cursor still pushes it
  const repel = { x: -1e4, y: -1e4, on: false, off: COLLAGE.map(() => ({ x: 0, y: 0 })), raf: 0 };
  function repelTarget(i) {
    const item = COLLAGE[i], img = collageImages[item.name];
    if (!repel.on || !img || isMobile || reduceMotion || facadeStep() > 0) return { x: 0, y: 0 };
    const fit = collageFit(i), s3 = view3.scale;
    const cx = view3.ox + item.x * s3, cy = view3.oy + item.y * s3 + fit.dy;
    const w = item.w * s3 * fit.f, h = w * (img.naturalHeight / img.naturalWidth);
    const dx = cx - repel.x, dy = cy - repel.y, d = Math.hypot(dx, dy) || 1;
    const edge = Math.max(0, d - Math.min(w, h) / 2);           // roughly how far the cursor is from the image
    const k = Math.max(0, 1 - edge / REPEL.reach);
    const m = REPEL.max * k * k;                                // stronger the nearer, soft at the far end
    return { x: (dx / d) * m, y: (dy / d) * m };
  }
  function repelTick() {
    repel.raf = 0;
    if (phase !== 'scroll' || !collageCount()) { repel.off.forEach((o) => { o.x = 0; o.y = 0; }); return; }
    let moving = false;
    repel.off.forEach((o, i) => {
      const t = repelTarget(i);
      o.x += (t.x - o.x) * REPEL.ease; o.y += (t.y - o.y) * REPEL.ease;
      if (Math.abs(t.x - o.x) > 0.05 || Math.abs(t.y - o.y) > 0.05) moving = true;
      else { o.x = t.x; o.y = t.y; }
    });
    render(true);
    if (moving) repel.raf = requestAnimationFrame(repelTick);
  }
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || isMobile || reduceMotion) return;
    repel.x = e.clientX; repel.y = e.clientY; repel.on = true;
    if (!repel.raf && collageCount()) repel.raf = requestAnimationFrame(repelTick);
  }, { passive: true });
  document.addEventListener('mouseleave', () => { repel.on = false; if (!repel.raf && collageCount()) repel.raf = requestAnimationFrame(repelTick); });

  // Each image pops in at its final place, size and angle, fully opaque, in
  // an instant: no movement, no fade.
  function drawCollage() {
    const count = collageCount();
    if (!count) return;
    const s3 = view3.scale;
    const order = COLLAGE.map((item, i) => i).sort((a, b) => (COLLAGE[a].top ? 1 : 0) - (COLLAGE[b].top ? 1 : 0)); // `top` ones last, over the rest
    order.forEach((i) => {
      const item = COLLAGE[i];
      const img = collageImages[item.name];
      if (!img || i >= count) return;
      if (item.name === FACADE.stamp && facadeStep() > 0) return; // drawn on top by drawFacadeZoom
      const fit = collageFit(i), rp = isMobile ? { x: 0, y: 0 } : repel.off[i]; // (the mouse's push, desktop)
      const cx = view3.ox + item.x * s3 + rp.x, cy = view3.oy + item.y * s3 + fit.dy + rp.y;
      const w = item.w * s3 * fit.f;
      const h = w * (img.naturalHeight / img.naturalWidth);
      ctx.save();
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.translate(cx, cy);
      ctx.rotate((item.rot * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    });
  }

  function loadCollage() {
    return Promise.all(
      COLLAGE.map(({ name }) => loadImage(`layers/collage/${name}.webp`).then((img) => { collageImages[name] = img; }))
    );
  }

  // --- Facade close-up ------------------------------------------------------------

  const facade = { img: null, pos: 0 }; // pos 0..1 through the zoom, advanced by tick()

  // Progress through the zoom: smooth, at the screen's own frame rate like the
  // gate's parallax right after it (it used to step at a low frame rate).
  function facadeStep() {
    return facade.pos;
  }

  // The stamp comes to the front, straightens and scales up until its picture
  // fills the screen. Its picture acts as a window onto the close-up, which
  // sits full-screen behind it: partway through (FACADE_CUT) the picture
  // cuts to that view, with no fade, so the zoom ends exactly on the
  // full-screen close-up.
  function drawFacadeZoom() {
    const img = collageImages[FACADE.stamp];
    if (facadeStep() <= 0 || !img) return;
    const item = COLLAGE.find((c) => c.name === FACADE.stamp);
    const e = easeInOut(facadeStep());
    const { w: vw, h: vh, dpr } = view;
    const s3 = view3.scale;
    const IW = img.naturalWidth, IH = img.naturalHeight;
    const fw = FACADE.window;
    const fit = collageFit(COLLAGE.indexOf(item));
    const k0 = (item.w * s3 * fit.f) / IW;        // stamp px -> CSS px in the collage
    const k1 = Math.max(vw / fw.w, vh / fw.h);    // picture area covers the screen
    const k = k0 * Math.pow(k1 / k0, e);          // even zoom feel
    const pcx = fw.x + fw.w / 2 - IW / 2, pcy = fw.y + fw.h / 2 - IH / 2; // picture centre vs stamp centre
    const cx = lerp(view3.ox + item.x * s3, vw / 2 - pcx * k1, e);
    const cy = lerp(view3.oy + item.y * s3 + fit.dy, vh / 2 - pcy * k1, e);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(cx, cy);
    ctx.rotate(((item.rot * (1 - e)) * Math.PI) / 180);
    ctx.drawImage(img, (-IW * k) / 2, (-IH * k) / 2, IW * k, IH * k);
    if (e >= FACADE_CUT && facade.img) {
      ctx.beginPath();
      ctx.rect((-IW * k) / 2 + fw.x * k, (-IH * k) / 2 + fw.y * k, fw.w * k, fw.h * k);
      ctx.clip(); // the stamp's picture area...
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fs = Math.max(vw / FACADE.w, vh / FACADE.h); // ...onto the full-screen close-up
      ctx.drawImage(facade.img, (vw - FACADE.w * fs) / 2, (vh - FACADE.h * fs) / 2, FACADE.w * fs, FACADE.h * fs);
    }
    ctx.restore();
  }

  function loadFacade() {
    return loadImage(FACADE.src).then((img) => { facade.img = img; });
  }

  // --- Gate fly-through -----------------------------------------------------------

  const gate = { pos: 0, img: {} }; // pos 0..1 through the fly-through, advanced by tick()
  const dive = { pos: 0 };          // pos 0..1 pushing into the painting until it fills the screen

  // Camera travel along the fly-through, 0..1: speeds up briefly from rest,
  // holds a constant speed, then slows to a stop in front of the painting.
  function gateTravel(p) {
    const a = GATE_EASE_IN, b = GATE_EASE_OUT, v = 1 / (1 - a / 2 - b / 2);
    if (p < a) return (v * p * p) / (2 * a);
    if (p < 1 - b) return v * (p - a / 2);
    const q = 1 - p;
    return 1 - (v * q * q) / (2 * b);
  }

  // A real camera move: the camera travels in a straight line, at constant
  // speed, from where the close-up is seen from to the centre of the gate.
  // Distances are in units of the camera's starting distance to the wall
  // (wall z = 1); nearer layers have smaller z. Each layer is projected with
  // perspective, so nearer ones (pillars, canopy) grow and slide away faster
  // than the wall: the parallax comes from the geometry, not from tuning.
  function drawGateFlythrough() {
    const p = gate.pos;
    if (p <= 0) return;
    const L = gate.img;
    if (!L.wall) return;
    const { w: vw, h: vh, dpr } = view;
    const fs = Math.max(vw / FACADE.w, vh / FACADE.h); // close-up cover fit
    const ox = (vw - FACADE.w * fs) / 2, oy = (vh - FACADE.h * fs) / 2;

    // Camera: starts looking at the close-up as framed and travels one
    // straight line that passes through the centre of the doorway (at the
    // wall, z = 1) and stops inside the gallery, at GALLERY.stopZ.
    const c0 = { x: (vw / 2 - ox) / fs, y: (vh / 2 - oy) / fs }; // close-up px at screen centre
    const F = F3D.focus;
    const cz = GALLERY.stopZ * gateTravel(p); // how far forward
    const cx = lerp(c0.x, F.x, cz), cy = lerp(c0.y, F.y, cz);

    // Project a rect (close-up px) on a layer at depth z. Layers are sized so
    // that at the start they line up exactly with the close-up image.
    const project = (r, z) => {
      const k = (fs * z) / (z - cz);
      return {
        x: vw / 2 + (fs * ((r.x - c0.x) * z + c0.x - cx)) / (z - cz),
        y: vh / 2 + (fs * ((r.y - c0.y) * z + c0.y - cy)) / (z - cz),
        w: r.w * k,
        h: r.h * k,
      };
    };
    const drawAt = (img, r, z) => {
      const q = project(r, z);
      if (q.x > vw || q.y > vh || q.x + q.w < 0 || q.y + q.h < 0) return;
      ctx.drawImage(img, q.x, q.y, q.w, q.h);
    };

    // The gallery: each layer is a plane its `d` beyond where the camera
    // stops, sized and placed so that from there it lines up exactly with the
    // original picture filling the screen. Before that, nearer layers are
    // relatively smaller and grow faster as the camera comes in: parallax.
    // Seen through the doorway on the way in.
    const E = { x: lerp(c0.x, F.x, GALLERY.stopZ), y: lerp(c0.y, F.y, GALLERY.stopZ) }; // where the camera stops
    let V = { ...GALLERY.views[0] }; // the one view of the gallery (fold 4)
    let DT = 0;                       // phones: how much wall is added above the frame (room px)
    if (isMobile) {
      // the frame 40px from either edge of the screen, centred in its bottom half (the copy is in
      // the top half, see .ln--g* in styles.css); whatever the screen's shape
      // (the gilded frame's own edge, not its painted shadow: MOBILE.frameGold, in frame.webp px)
      const F = GALLERY.layers.find((l) => l.key === 'gFrame').rect, G = MOBILE.frameGold, M = MOBILE.frameMargin;
      const s = Math.max(1, vw - 2 * M) / G.w;              // screen px per room px
      const top = vh - MOBILE.frameBottom - G.h * s;          // the gilded bottom edge frameBottom px above the screen's bottom
      V = { x: F.x + G.x - M / s, y: F.y + G.y - top / s, w: vw / s, h: vh / s };
      DT = Math.max(0, -V.y);                                // the cornice stays at the top of the screen
    }
    if (dive.pos > 0) { // then the camera pushes into the painting until it fills the screen (a little inside its edges)
      const P = GALLERY.layers.find((l) => l.key === 'gPainting2').rect, inset = 0.06;
      const pw = P.w * (1 - inset), ph = P.h * (1 - inset);
      const tw = vw / vh > pw / ph ? pw : (ph * vw) / vh, th = vw / vh > pw / ph ? (pw * vh) / vw : ph; // the screen's shape, inside the painting
      const k = easeInOut(dive.pos), zw = V.w * Math.pow(tw / V.w, k);  // an even push (size changes geometrically)
      const m = (V.w - zw) / (V.w - tw || 1);                           // how far along, in the same terms
      const cx0 = V.x + V.w / 2, cy0 = V.y + V.h / 2, cx1 = P.x + P.w / 2, cy1 = P.y + P.h / 2;
      V = { w: zw, h: zw * (V.h / V.w), x: lerp(cx0, cx1, m) - zw / 2, y: lerp(cy0, cy1, m) - (zw * (V.h / V.w)) / 2 };
    }
    const g = Math.max(vw / V.w, vh / V.h); // screen px per room px at rest
    const swap = 1; // the frame holds the painting from "fold4.2 bg.png" throughout
    const drawGallery = () => {
      for (const layer of GALLERY.layers) {
        const img = L[layer.key];
        const z = GALLERY.stopZ + layer.d;
        const a = layer.swap ? swap : 1;
        if (!img || z - cz < 0.02 || a <= 0) continue;
        const sw = (g * layer.d) / fs; // world units per room px on this layer
        const k = fs / (z - cz);
        const r = layer.rect || { x: 0, y: 0, w: GALLERY.w, h: GALLERY.h };
        const X = (rx) => vw / 2 + (E.x + (rx - V.x - V.w / 2) * sw - cx) * k;
        const Y = (ry) => vh / 2 + (E.y + (ry - V.y - V.h / 2) * sw - cy) * k;
        ctx.globalAlpha = a;
        if (isMobile && !layer.rect) {
          // full-room layer, split at two cuts: above the top one moves up (the cornice), below the
          // bottom one moves down (the wainscot), and the gaps are wall
          const C = MOBILE.wallCut, D = MOBILE.wallExtend, q = img.naturalHeight / GALLERY.h, iw = img.naturalWidth;
          const CT = MOBILE.wallTopCut;
          const x0 = X(0), w0 = GALLERY.w * sw * k;
          ctx.drawImage(img, 0, 0, iw, CT * q, x0, Y(-DT), w0, Y(CT - DT) - Y(-DT));
          ctx.drawImage(img, 0, CT * q, iw, (C - CT) * q, x0, Y(CT), w0, Y(C) - Y(CT));
          ctx.drawImage(img, 0, C * q, iw, (GALLERY.h - C) * q, x0, Y(C + D), w0, Y(GALLERY.h + D) - Y(C + D));
          if (layer.key === 'gWall' && DT > 0) { // the extra wall above: the stretch below the top cut, mirrored, then the right way up, ... (under the painted one)
            const B = Math.min(DT, 640);
            for (let y = CT, n = 0; y > CT - DT; y -= B, n++) {
              const h = Math.min(B, y - (CT - DT));
              if (n % 2 === 0) { // mirrored about y
                ctx.save(); ctx.translate(0, Y(y) * 2); ctx.scale(1, -1);
                ctx.drawImage(img, 0, CT * q, iw, h * q, x0, Y(y), w0, Y(y + h) - Y(y));
                ctx.restore();
              } else ctx.drawImage(img, 0, (CT + B - h) * q, iw, h * q, x0, Y(y - h), w0, Y(y) - Y(y - h));
            }
            // the painted wall, fitted to the gap (its 60px overlaps above and below kept as they are)
            const P = L.gWallTopM, R = MOBILE.wallTop;
            if (P) {
              const q2 = P.naturalHeight / R.h, ov = R.overlap, gap = R.h - 2 * ov, xw = R.w * sw * k, xl = X(R.x);
              ctx.drawImage(P, 0, 0, P.naturalWidth, ov * q2, xl, Y(CT - DT - ov), xw, Y(CT - DT) - Y(CT - DT - ov));
              ctx.drawImage(P, 0, ov * q2, P.naturalWidth, gap * q2, xl, Y(CT - DT), xw, Y(CT) - Y(CT - DT));
              ctx.drawImage(P, 0, (ov + gap) * q2, P.naturalWidth, ov * q2, xl, Y(CT), xw, Y(CT + ov) - Y(CT));
            }
          }
          if (layer.key === 'gWall') { // the extra wall: the stretch above the cut, mirrored, then again the right way up
            const B = Math.min(D, 640);
            ctx.save(); ctx.translate(0, Y(C) * 2); ctx.scale(1, -1);
            ctx.drawImage(img, 0, (C - B) * q, iw, B * q, x0, Y(C - B), w0, Y(C) - Y(C - B));
            ctx.restore();
            if (D > B) ctx.drawImage(img, 0, (C - (D - B)) * q, iw, (D - B) * q, x0, Y(C + B), w0, Y(C + D) - Y(C + B));
          }
        } else {
          ctx.drawImage(img, X(r.x), Y(r.y), r.w * sw * k, r.h * sw * k);
        }
        ctx.globalAlpha = 1;
      }
    };

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);

    // Once the camera is through the doorway, only the gallery is in front of it.
    if (cz >= 0.985) {
      drawGallery();
      ctx.restore();
      return;
    }

    // wall, with the sharper gate close-up on top of it
    drawAt(L.wall, F3D.wall.rect, 1);
    if (L.gate) drawAt(L.gate, F3D.gate.rect, 1);

    // the doors: the gallery seen through the doorway, leaves swinging inward on their hinges
    const o = easeInOut(within(cz, ...GATE_DOORS_OPEN));
    if (o > 0) {
      const dr = F3D.door;
      const q = project(dr, 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(q.x, q.y, q.w, q.h);
      ctx.clip();
      ctx.fillStyle = '#000';
      ctx.fillRect(q.x, q.y, q.w, q.h);
      drawGallery();
      ctx.restore();
      const theta = (o * DOOR_OPEN_DEG * Math.PI) / 180;
      drawLeaf(L.doorL, project({ x: dr.x, y: dr.y, w: dr.split - dr.x, h: dr.h }, 1), theta, false);
      drawLeaf(L.doorR, project({ x: dr.split, y: dr.y, w: dr.x + dr.w - dr.split, h: dr.h }, 1), theta, true);
    }

    // nearer layers: canopy, then the pillars in front of it
    for (const key of ['canopy', 'pillarL', 'pillarR']) {
      const layer = F3D[key];
      if (!L[key] || layer.z - cz < 0.04) continue; // passed the camera
      drawAt(L[key], layer.rect, layer.z);
    }
    ctx.restore();
  }

  // One door leaf turning `theta` around its hinge (left leaf: hinge on its
  // left edge; right leaf: on its right), drawn in vertical strips so the
  // far edge shrinks with perspective. Leaves darken as they turn away.
  function drawLeaf(img, q, theta, hingeRight) {
    if (!img) return;
    const N = 48;
    const persp = (z) => 1 / (1 + z / (q.w * 2.6)); // z in the same px as q.w
    const hingeX = hingeRight ? q.x + q.w : q.x;
    const cy = q.y + q.h / 2;
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N;              // 0 at the hinge .. 1 at the free edge
      const px = (u) => {
        const g = persp(u * q.w * Math.sin(theta));
        return hingeX + (hingeRight ? -1 : 1) * u * q.w * Math.cos(theta) * g;
      };
      const x0 = px(u0), x1 = px(u1);
      const g = persp(((u0 + u1) / 2) * q.w * Math.sin(theta));
      const h = q.h * g;
      const sxu = hingeRight ? 1 - u1 : u0;             // source strip (image runs left to right)
      ctx.drawImage(img, sxu * img.naturalWidth, 0, img.naturalWidth / N + 0.5, img.naturalHeight,
        Math.min(x0, x1), cy - h / 2, Math.abs(x1 - x0) + 0.6, h);
    }
    // shade the leaf as it turns away from the light
    const shade = Math.sin(theta) * 0.55;
    if (shade > 0) {
      const xA = hingeX, xB = hingeX + (hingeRight ? -1 : 1) * q.w * Math.cos(theta) * persp(q.w * Math.sin(theta));
      const hB = q.h * persp(q.w * Math.sin(theta));
      ctx.fillStyle = `rgba(0,0,0,${shade})`;
      ctx.beginPath();
      ctx.moveTo(xA, q.y);
      ctx.lineTo(xB, cy - hB / 2);
      ctx.lineTo(xB, cy + hB / 2);
      ctx.lineTo(xA, q.y + q.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function loadGate() {
    const keys = ['wall', 'gate', 'canopy', 'pillarL', 'pillarR', 'doorL', 'doorR'];
    const extra = [...GALLERY.layers.map((l) => [l.key, l.src]), ['gWallTopM', MOBILE.wallTop.src]];
    return Promise.all([
      ...keys.map((k) => loadImage(F3D[k].src).then(keepDecoded).then((img) => { gate.img[k] = img; })),
      ...extra.map(([k, src]) => loadImage(src).then(keepDecoded).then((img) => { gate.img[k] = img; })),
    ]).then(() => warmUp(Object.values(gate.img)));
  }

  // While the close-up sits still, draw a frame of the fly-through (doors
  // half open, so every layer is used) and paint the close-up back over it in
  // the same frame. The browser does its one-off image preparation now, so
  // the real move starts without a stall. Nothing of it reaches the screen.
  let gatePrimed = false;
  function primeGate() {
    if (gatePrimed || gate.pos > 0 || !gate.img.wall) return;
    gatePrimed = true;
    for (const p of [0.002, 0.3, 0.45, 0.62, 0.8, 1]) { // start, doors opening, gallery through the doorway, coming to rest
      gate.pos = p;
      render(true);
    }
    gate.pos = 0;
    render(true);
  }

  // Draws each image once into a 1px clip of the stage so the browser uploads
  // it to the GPU now, rather than stalling on the first frame of the move.
  function warmUp(imgs) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(0, 0, 1, 1);
    ctx.clip();
    for (const img of imgs) if (img) ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
    ctx.restore();
    render(true);
  }

  // --- Fold 5: the map ------------------------------------------------------------

  const f5 = { pos: 0, img: {} }; // pos 0..1 through the sequence, advanced by tick()

  function loadFold5() {
    return Promise.all([['map', FOLD5.map.src], ['pin', FOLD5.pin.src], ['card', FOLD5.card.src]].map(([k, src]) =>
      loadImage(src).then(keepDecoded).then((img) => { f5.img[k] = img; }))).then(() => warmUp(Object.values(f5.img)));
  }

  // The grid card's outline: straight left and bottom edges (they run off the
  // screen), the top and right edges wavering a little like torn paper. A
  // fixed pattern (it never shimmers), a few px deep on the reference screen.
  const cardOutlineCache = { key: '', path: null };
  function cardOutline(x0, y0, W, H, k) {
    const key = [x0, y0, W, H].map((v) => v.toFixed(1)).join(',');
    if (cardOutlineCache.key === key) return cardOutlineCache.path;
    const amp = 2.4 * k, step = 3 * k;
    const wob = (u, seed) => amp * (0.5 * Math.sin(u * 0.045 + seed) + 0.27 * Math.sin(u * 0.13 + seed * 2.3) + 0.15 * Math.sin(u * 0.41 + seed * 5.1) + 0.12 * Math.sin(u * 1.37 + seed * 7.7));
    const p = new Path2D();
    p.moveTo(x0, y0 + H);
    p.lineTo(x0, y0 + wob(0, 1));
    for (let x = step; x < W; x += step) p.lineTo(x0 + x, y0 + wob(x / k, 1));            // top edge
    p.lineTo(x0 + W + wob(0, 4), y0 + wob(W / k, 1));
    for (let y = step; y < H; y += step) p.lineTo(x0 + W + wob(y / k, 4), y0 + y);         // right edge
    p.lineTo(x0 + W + wob(H / k, 4), y0 + H);
    p.closePath();
    cardOutlineCache.key = key; cardOutlineCache.path = p;
    return p;
  }

  // Breaks up a canvas's edge into fine grain over `band` device px: pixels
  // near the edge drop out at random, more of them the nearer the edge (a
  // fixed pattern, so it never shimmers).
  function grainEdge(c, band) {
    const w = c.width, h = c.height, g = c.getContext('2d', { willReadFrequently: true });
    const id = g.getImageData(0, 0, w, h), d = id.data;
    const soft = document.createElement('canvas'); soft.width = w; soft.height = h;
    const sg = soft.getContext('2d', { willReadFrequently: true });
    sg.filter = `blur(${band}px)`; sg.drawImage(c, 0, 0);
    const sd = sg.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!d[i + 3]) continue;
      const a = sd[i + 3] / 255;
      if (a >= 0.92) continue;
      const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      const keep = smoothstep(0.25, 0.92, a);
      d[i + 3] = Math.abs(n) < keep ? d[i + 3] : 0;
    }
    g.putImageData(id, 0, 0);
  }
  // Film-like grain over a canvas's painted pixels: each grain (`cell` device
  // px) lightened or darkened at random by up to `amount` (a fixed pattern,
  // so it never shimmers); transparent pixels are left alone.
  function grainFill(c, amount, cell) {
    const w = c.width, h = c.height, g = c.getContext('2d', { willReadFrequently: true });
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!d[i + 3]) continue;
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      const n = Math.abs((Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453) % 1) - 0.5; // -0.5 .. 0.5
      const k = 1 + 2 * amount * n;
      d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
    }
    g.putImageData(id, 0, 0);
  }
  // Grain on the dark grid lines of the card: each grain of a line pixel is
  // lifted toward the paper by a random share (up to `amount`), so the lines
  // break up softly in the grain without losing their place or width.
  function grainLines(c, amount, cell) {
    const w = c.width, h = c.height, g = c.getContext('2d', { willReadFrequently: true });
    const id = g.getImageData(0, 0, w, h), d = id.data, paper = [242, 234, 216];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!d[i + 3]) continue;
      const L = (d[i] + d[i + 1] + d[i + 2]) / 3, dark = Math.max(0, Math.min(1, (215 - L) / 60)); // 0 on paper, 1 on a line's core
      if (!dark) continue;
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      const n = Math.abs((Math.sin(gx * 91.7 + gy * 47.3) * 24634.6345) % 1);  // 0 .. 1
      const k = dark * amount * n;
      for (let ch = 0; ch < 3; ch++) d[i + ch] += (paper[ch] - d[i + ch]) * k;
    }
    g.putImageData(id, 0, 0);
  }
  // The pin at the size it's drawn, with its grainy edge and grain over it (made once per size).
  const pinCache = { key: '', c: null };
  function pinSprite(pin, pw, ph, dpr) {
    const key = `${Math.round(pw * dpr)}x${Math.round(ph * dpr)}`;
    if (pinCache.key === key) return pinCache.c;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(pw * dpr)); c.height = Math.max(1, Math.round(ph * dpr));
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(pin, 0, 0, c.width, c.height);
    grainEdge(c, FOLD5.pin.grain * dpr);
    grainFill(c, FOLD5.pin.grainFill, Math.max(1, Math.round(dpr)));
    pinCache.key = key; pinCache.c = c;
    return c;
  }

  // The card with its torn outline as one image, its edge blurred by 1px
  // (made once per size).
  const cardLayerCache = { key: '', c: null, pad: 0 };
  function cardLayer(card, s, x0, y0, W, H, rough, dpr) {
    const key = [W, H, dpr].map((v) => v.toFixed(1)).join(',');
    if (cardLayerCache.key === key) return cardLayerCache;
    const pad = 4, c = document.createElement('canvas');
    c.width = Math.ceil((W + 2 * pad) * dpr); c.height = Math.ceil((H + 2 * pad) * dpr);
    const g = c.getContext('2d');
    const m = document.createElement('canvas'); m.width = c.width; m.height = c.height;
    const mg = m.getContext('2d');
    mg.setTransform(dpr, 0, 0, dpr, (pad - x0) * dpr, (pad - y0) * dpr);
    mg.fillStyle = '#000'; mg.fill(rough);
    grainEdge(m, 2 * dpr);                                        // a slightly grainy edge, like the paper's torn fibres
    g.setTransform(dpr, 0, 0, dpr, (pad - x0) * dpr, (pad - y0) * dpr);
    g.drawImage(card, 0, 0, W / s, H / s, x0, y0, W, H);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(m, 0, 0);
    grainFill(c, FOLD5.card.grainFill, Math.max(1, Math.round(dpr))); // a fine grain over the paper
    grainLines(c, FOLD5.card.lineGrain, Math.max(1, Math.round(dpr))); // ...and over the grid lines, so they read a little softer
    Object.assign(cardLayerCache, { key, c, pad });
    return cardLayerCache;
  }

  // The map is a sheet that unfolds over the gallery from the bottom-right
  // corner: first a tilted flap swings in behind a straight fold line, then it
  // flattens out with the fold curling away to the top-left corner. Then the
  // card, the copy (in the page) and the pins, as in the video.
  function drawFold5() {
    const t = (f5.pos * FOLD5.ms) / 1000;
    if (f5.pos <= 0) return;
    const { map, pin, card } = f5.img;
    if (!map) return;
    const { w: vw, h: vh, dpr } = view;
    const V = FOLD5.view, g = Math.max(vw / V.w, vh / V.h); // screen px per map px
    const ox = vw / 2 - (V.x + V.w / 2) * g, oy = vh / 2 - (V.y + V.h / 2) * g;
    const u = within(t, ...FOLD5.unfold);
    const e = easeInOut(u);

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // the fold line: sweeps from the bottom-right corner to beyond the top-left,
    // turning from 34deg to 50deg and bending as it goes (the paper curling)
    const diag = Math.hypot(vw, vh);
    const reach = lerp(-0.05, 1.18, e) * diag;               // distance from the bottom-right corner, along the diagonal
    const ang = (lerp(34, 52, e) * Math.PI) / 180;           // the fold's angle (up and to the right)
    const dx = -vw / diag, dy = -vh / diag;                  // unit vector toward the top-left
    const cx = vw + dx * reach, cy = vh + dy * reach;        // a point on the fold
    const fx = Math.cos(ang), fy = -Math.sin(ang);           // along the fold
    const nx = -fy, ny = fx;                                  // normal, toward the bottom-right (the map side)
    const bend = Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.16 * diag * smoothstep(0.35, 0.7, u);
    const L = diag * 1.5;
    const fold = (c) => { // the fold as a path from one end to the other
      c.moveTo(cx - fx * L, cy - fy * L);
      c.quadraticCurveTo(cx - nx * bend, cy - ny * bend, cx + fx * L, cy + fy * L);
    };

    if (u < 1) {
      ctx.beginPath();
      fold(ctx);
      ctx.lineTo(cx + fx * L + nx * L, cy + fy * L + ny * L);
      ctx.lineTo(cx - fx * L + nx * L, cy - fy * L + ny * L);
      ctx.closePath();
      ctx.clip();
    }
    // the map, tilted while it swings in, flat once it has unfolded
    const tilt = ((-24 * (1 - e)) * Math.PI) / 180, grow = lerp(1.18, 1, e);
    ctx.translate(vw, vh); ctx.rotate(tilt); ctx.scale(grow, grow); ctx.translate(-vw, -vh);
    ctx.fillStyle = '#f2e8d5';
    ctx.fillRect(-vw, -vh, vw * 3, vh * 3);
    ctx.drawImage(map, ox, oy, FOLD5.map.w * g, FOLD5.map.h * g);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (u < 1) {
      // shading along the fold: a soft shadow on the map side, a light edge on the paper
      const sh = 26 + 40 * (1 - e);
      const gr = ctx.createLinearGradient(cx, cy, cx + nx * sh, cy + ny * sh);
      gr.addColorStop(0, 'rgba(60,40,20,0.35)'); gr.addColorStop(1, 'rgba(60,40,20,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(-vw, -vh, vw * 3, vh * 3);
      ctx.restore();
      // the back of the folded-over flap, on the far side of the fold, narrowing as it opens out
      const flap = (0.16 * (1 - e) + 0.02) * Math.min(vw, vh);
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.beginPath();
      fold(ctx);
      ctx.lineTo(cx + fx * L - nx * flap, cy + fy * L - ny * flap);
      ctx.lineTo(cx - fx * L - nx * flap, cy - fy * L - ny * flap);
      ctx.closePath();
      const fg = ctx.createLinearGradient(cx, cy, cx - nx * flap, cy - ny * flap);
      fg.addColorStop(0, '#fbf4e4'); fg.addColorStop(0.7, '#e7dbc2'); fg.addColorStop(1, 'rgba(120,100,70,0.0)');
      ctx.fillStyle = fg;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // pins, one after another, each appearing at once (no scaling), with a
    // slightly grainy edge so they sit in the painted map
    if (pin) {
      const pw = FOLD5.pin.w * g, ph = (pw * pin.naturalHeight) / pin.naturalWidth;
      const sprite = pinSprite(pin, pw, ph, dpr);
      FOLD5.pins.forEach((p, i) => {
        if (t < FOLD5.pinsAt[0] + i * FOLD5.pinsAt[1]) return;
        const tx = ox + p.x * g, ty = oy + p.y * g;
        ctx.drawImage(sprite, tx - FOLD5.pin.tip.x * pw, ty - FOLD5.pin.tip.y * ph, pw, ph);
      });
    }

    // the grid-paper card, bottom left, slanted a few degrees about its centre
    // (drawn larger than the corner it covers, so the slant never shows a gap
    // along the screen edges). It turns in like a page from the bottom-left
    // corner: the face of the card grows out from that corner while the rest
    // of the page lies folded back over it (its back showing, mirrored across
    // the fold); the fold travels to the top right until the page lies flat.
    const ci = within(t, ...FOLD5.cardIn);
    if (card && ci > 0) {
      const ce = easeInOut(ci);
      const cw = FOLD5.card.w * vw, chh = FOLD5.card.h * vw;
      const over = 0.25 * chh;                                   // extra off the left and bottom edges
      const W = cw + over, H = chh + over;
      const s = Math.max(W / card.naturalWidth, H / card.naturalHeight);
      const x0 = -cw / 2 - over, y0 = -chh / 2;                  // the card's outline (local coords)
      const rough = cardOutline(x0, y0, W, H, vw / 1728);      // slightly torn top and right edges
      const layer = cardLayer(card, s, x0, y0, W, H, rough, dpr); // ...softened by 1px so it sits into the map
      const drawCard = () => ctx.drawImage(layer.c, x0 - layer.pad, y0 - layer.pad, W + 2 * layer.pad, H + 2 * layer.pad);
      ctx.save();
      ctx.translate(cw / 2, vh - chh / 2 + FOLD5.card.drop);     // sits `drop` px lower than flush with the bottom edge (the copy with it)
      ctx.rotate((-FOLD5.card.slant * Math.PI) / 180);
      if (ci >= 1) drawCard();
      else {
        const Cx = x0, Cy = y0 + H;                              // the bottom-left corner the page turns from
        const dl = Math.hypot(W, H), ux = W / dl, uy = -H / dl; // toward the opposite corner
        const dd = ce * dl;                                      // how far the fold has travelled
        const Qx = Cx + ux * dd, Qy = Cy + uy * dd;              // a point on the fold
        // the card's outline cut by the fold: the face side (near the corner) and the folded side
        const rect = [[x0, y0], [x0 + W, y0], [x0 + W, y0 + H], [x0, y0 + H]];
        const cut = (keepNear) => {
          const side = ([x, y]) => (x - Cx) * ux + (y - Cy) * uy - dd; // < 0: corner side
          const out = [];
          for (let i = 0; i < 4; i++) {
            const a = rect[i], b = rect[(i + 1) % 4], sa = side(a), sb = side(b);
            const inA = keepNear ? sa <= 0 : sa >= 0, inB = keepNear ? sb <= 0 : sb >= 0;
            if (inA) out.push(a);
            if (inA !== inB) { const k = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
          }
          return out;
        };
        const path = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
        const face = cut(true), rest = cut(false);
        // the face of the card, with a soft shade toward the fold
        if (face.length > 2) {
          ctx.save(); path(face); ctx.clip(); drawCard();
          const sh = 0.1 * Math.min(cw, chh);
          const g1 = ctx.createLinearGradient(Qx, Qy, Qx - ux * sh, Qy - uy * sh);
          g1.addColorStop(0, 'rgba(70,50,30,0.28)'); g1.addColorStop(1, 'rgba(70,50,30,0)');
          ctx.fillStyle = g1; ctx.fillRect(x0, y0, W, H);
          ctx.restore();
        }
        // the folded-back part: the rest of the page mirrored across the fold, its back showing
        if (rest.length > 2) {
          const tx = -uy, ty = ux;                               // along the fold
          const m00 = 2 * tx * tx - 1, m01 = 2 * tx * ty, m11 = 2 * ty * ty - 1;
          ctx.save();
          ctx.transform(m00, m01, m01, m11, Qx - (m00 * Qx + m01 * Qy), Qy - (m01 * Qx + m11 * Qy));
          ctx.clip(rough);                                       // the same torn edges, mirrored with the page
          path(rest);
          ctx.save();
          ctx.shadowColor = 'rgba(40,28,15,0.35)'; ctx.shadowBlur = 14 * dpr; ctx.fillStyle = '#efe4cf'; ctx.fill();
          ctx.restore();
          ctx.clip();
          ctx.globalAlpha = 0.18; drawCard(); ctx.globalAlpha = 1;   // the grid faintly through the paper
          const g2 = ctx.createLinearGradient(Qx, Qy, Qx + ux * dl * 0.5, Qy + uy * dl * 0.5);
          g2.addColorStop(0, 'rgba(255,250,238,0.55)'); g2.addColorStop(1, 'rgba(180,155,120,0.25)');
          ctx.fillStyle = g2; ctx.fillRect(x0 - dl, y0 - dl, W + 2 * dl, H + 2 * dl);
          ctx.restore();
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // --- Fold 6: the receipt ------------------------------------------------------------

  const f6 = { pos: 0, img: null }; // pos 0..1 through the sequence, advanced by tick()

  function loadFold6() {
    return loadImage(FOLD6.receipt.src).then((img) => {
      // the receipt as drawn (f6.img), a copy whose total can be reprinted
      const k = img.naturalWidth / FOLD6.receipt.w, T = FOLD6.total;
      const mk = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; return c; };
      const src = mk(), sg = src.getContext('2d', { willReadFrequently: true });
      sg.drawImage(img, 0, 0);
      // the lowest inked row in a cell (receipt px in, image px out): lines the digits up on their baseline
      const inkBottom = (cx, top, bottom) => {
        const x0 = Math.round((cx - T.half) * k), y0 = Math.round(top * k), w = Math.round(2 * T.half * k), h = Math.round((bottom - top) * k);
        const d = sg.getImageData(x0, y0, w, h).data;
        for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4] < 150) return y0 + y;
        return y0 + h - 1;
      };
      const glyphs = {};
      for (const [n, [cx, top, bottom]] of Object.entries(T.glyphs)) glyphs[n] = { cx, top, bottom, base: inkBottom(cx, top, bottom) };
      const bases = T.rows.map(([top, bottom]) => inkBottom(T.cols[2], top, bottom)); // the "4" of 4,149 on each line
      const out = mk();
      Object.assign(f6, { img: out, src, k, glyphs, bases, shown: null });
      f6.print = makePrint(sg, k);
      setReceiptTotal(T.from);
    }).catch(() => {});
  }

  // "THE LAST COURSE / IS ON US." set from the receipt's own print: each
  // letter's cell cut from a line printed on the receipt, turned into ink
  // (alpha from how dark it is), scaled up to the size of the new text and
  // sat on its baseline. Returns the patch (mask) as an image, receipt px x k.
  function makePrint(sg, k) {
    const X = FOLD6.swap, p = X.pitch, [y0, y1] = X.mask, RW = FOLD6.receipt.w;
    const cells = {};
    for (const L of X.from) [...L.text].forEach((ch, i) => { if (ch !== ' ' && !cells[ch]) cells[ch] = { x: L.x0 + i * p, top: L.top, bottom: L.bottom }; });
    if (cells[':']) cells['.'] = { ...cells[':'], top: (cells[':'].top + cells[':'].bottom) / 2 + 2 }; // the full stop: the lower dot of a colon
    const glyph = {};
    const ink = (ch) => {
      if (glyph[ch]) return glyph[ch];
      const C = cells[ch]; if (!C) return null;
      const w = Math.round(p * k), h = Math.round((C.bottom - C.top) * k);
      const d = sg.getImageData(Math.round(C.x * k), Math.round(C.top * k), w, h);
      let bottom = 0, top = h;
      for (let i = 0; i < w * h; i++) {
        const L = (d.data[i * 4] + d.data[i * 4 + 1] + d.data[i * 4 + 2]) / 3;
        const a = Math.max(0, Math.min(1, (232 - L) / 160));
        d.data[i * 4] = X.ink[0]; d.data[i * 4 + 1] = X.ink[1]; d.data[i * 4 + 2] = X.ink[2]; d.data[i * 4 + 3] = Math.round(a * 255);
        if (a > 0.35) { const y = Math.floor(i / w); bottom = Math.max(bottom, y); top = Math.min(top, y); }
      }
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(d, 0, 0);
      return (glyph[ch] = { c, bottom: bottom / k, top: top / k });
    };
    const H = ink('H'); if (!H) return null;
    const S = X.cap / (H.bottom - H.top);                 // from the print's capital height to the new one
    const out = document.createElement('canvas'); out.width = Math.round(RW * k); out.height = Math.round((y1 - y0) * k);
    const g = out.getContext('2d'); g.imageSmoothingQuality = 'high';
    X.lines.forEach((line, n) => {
      [...line].forEach((ch, j) => {
        const G = ink(ch); if (!G) return;
        const x = X.x + j * p * S, yb = X.base[n] - y0;
        g.drawImage(G.c, x * k, (yb - G.bottom * S) * k, p * S * k, (G.c.height / k) * S * k);
      });
    });
    return out;
  }

  // Reprints the total on both TOTAL lines (the printed one when it's 4,149).
  function setReceiptTotal(v) {
    if (f6.shown === v) return;
    f6.shown = v;
    const T = FOLD6.total, k = f6.k, g = f6.img.getContext('2d');
    g.drawImage(f6.src, 0, 0);
    if (v === T.from) return;
    const digits = String(v).padStart(4, '0').split('');
    const w = 2 * T.half * k;
    T.rows.forEach(([top, bottom], r) => {
      T.cols.forEach((cx, i) => {
        const x = (cx - T.half) * k, y = (top - 3) * k, h = (bottom - top + 6) * k;
        g.drawImage(f6.src, (T.blankX - T.half) * k, y, w, h, x, y, w, h);      // blank paper over the old digit
        const G = f6.glyphs[digits[i]];
        const gy = G.top * k, gh = (G.bottom - G.top) * k;
        g.drawImage(f6.src, (G.cx - T.half) * k, gy, w, gh, x, gy + (f6.bases[r] - G.base), w, gh);
      });
    });
  }

  // The roll, seen side-on against the page: a paper cylinder (blank: the
  // printed side rolls up inside) shaded from a soft top light, with a few
  // faint show-through bands that turn as it rolls, and a contact shadow.
  function drawRoll(cx, w, yAxis, r, turned, alpha) {
    const x0 = cx - w / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    // contact shadow on the page and the paper above it
    ctx.fillStyle = 'rgba(40, 32, 24, 0.16)';
    ctx.filter = `blur(${Math.max(2, r * 0.45).toFixed(1)}px)`;
    ctx.fillRect(x0 + r * 0.15, yAxis + r * 0.35, w - r * 0.3, r * 0.95);
    ctx.filter = 'none';
    // the cylinder
    const g = ctx.createLinearGradient(0, yAxis - r, 0, yAxis + r);
    g.addColorStop(0, '#d9d6d0');
    g.addColorStop(0.18, '#f6f4f0');
    g.addColorStop(0.42, '#ffffff');
    g.addColorStop(0.78, '#e2ded7');
    g.addColorStop(1, '#a8a299');
    ctx.fillStyle = g;
    ctx.fillRect(x0, yAxis - r, w, 2 * r);
    // faint bands on the turning surface (front half only)
    ctx.strokeStyle = 'rgba(70, 60, 50, 0.07)';
    ctx.lineWidth = Math.max(1, r * 0.06);
    for (let i = 0; i < 6; i++) {
      const a = turned + (i * Math.PI) / 3;            // angle round the roll, 0 = facing the viewer
      const c = Math.cos(a);
      if (c <= 0.1) continue;
      const y = yAxis - r * Math.sin(a);
      ctx.beginPath(); ctx.moveTo(x0 + 2, y); ctx.lineTo(x0 + w - 2, y); ctx.stroke();
    }
    // the edges of the roll catch a thin dark line
    ctx.strokeStyle = 'rgba(60, 50, 40, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, yAxis - r + 0.5, w - 1, 2 * r - 1);
    ctx.restore();
  }

  // In receipt px (inside the receipt's transform): the "thank you for
  // visiting" block rolls up out of its patch of paper, then the new text
  // rolls up into it, both clipped to the patch.
  function drawReceiptSwap(t) {
    const X = FOLD6.swap, img = f6.img, k = img.width / FOLD6.receipt.w;
    const po = easeInOut(within(t, ...X.out)), pi = easeInOut(within(t, ...X.in));
    if (po <= 0 && pi <= 0) return;
    const [y0, y1] = X.mask, mh = y1 - y0, RW = FOLD6.receipt.w;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, RW, mh); ctx.clip();
    // blank paper over the patch, then the old block, moved up
    const [p0, p1] = X.paper, ph = p1 - p0;
    ctx.fillStyle = 'rgb(245, 245, 245)';                        // the paper's tone underneath, so no old print shows at a seam
    ctx.fillRect(0, y0, RW, mh);
    for (let y = y0, n = 0; y < y1; y += ph, n++) {               // tiled, every other copy flipped, so the seams match
      if (n % 2) { ctx.save(); ctx.translate(0, 2 * y + ph); ctx.scale(1, -1); }
      ctx.drawImage(img, 0, p0 * k, img.width, ph * k, 0, y - 0.5, RW, ph + 1);
      if (n % 2) ctx.restore();
    }
    if (po < 1) ctx.drawImage(img, 0, y0 * k, img.width, mh * k, 0, y0 - po * mh, RW, mh);
    // the new text, in the receipt's own print
    if (pi > 0 && f6.print) ctx.drawImage(f6.print, 0, y0 + (1 - pi) * mh, RW, mh);
    ctx.restore();
  }

  function drawFold6() {
    if (f6.pos <= 0) return;
    const t = (f6.pos * FOLD6.ms) / 1000;
    const { w: vw, h: vh, dpr } = view;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the white page, sliding up from the bottom edge
    const w = easeInOut(within(t, ...FOLD6.wipe));
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, vh * (1 - w), vw, vh * w + 1);
    // the receipts, the first one last (on top). The zoom is a camera move
    // over all of them: about the first one's total, from where it sits on
    // the hanging receipt to where it ends up, growing and turning
    // anticlockwise; the others, nearer the camera, sweep out of the frame to
    // the upper right as it moves (parallax), the further ones faster.
    const img = f6.img, R = FOLD6.rest, RL = FOLD6.roll;
    if (img) {
      const H = R.h * vh, W = H * (FOLD6.receipt.w / FOLD6.receipt.h), top = R.top * vh;
      const T = FOLD6.total, Z = FOLD6.zoomTo, k0 = H / FOLD6.receipt.h;
      setReceiptTotal(Math.round(lerp(T.from, T.to, easeOut(within(t, ...FOLD6.count)))));
      const z = easeInOut(within(t, ...FOLD6.zoom));
      const sx0 = R.cx * vw - W / 2 + T.focus.x * k0, sy0 = top + T.focus.y * k0; // the total, at rest
      const camera = () => {
        if (z <= 0) return;
        ctx.translate(lerp(sx0, Z.x * vw, z), lerp(sy0, Z.y * vh, z));
        ctx.rotate((-Z.deg * z * Math.PI) / 180);
        ctx.scale(Math.pow(Z.scale, z), Math.pow(Z.scale, z));
        ctx.translate(-sx0, -sy0);
      };
      const a = (-Z.deg * Math.PI) / 180;                        // the way out: along the turned bill, to the upper right
      for (const i of FOLD6.order) {
        if (i >= FOLD6.bills) continue;
        if (i > 0 && z >= 1) continue;                            // out of the frame by the end of the zoom
        const dt = i * FOLD6.stagger;
        if (t - dt < FOLD6.unroll[0]) continue;                   // each pops in, rolled up, as its unrolling starts
        const O = i > 0 ? FOLD6.others[i - 1] : null;
        const cx = O ? 0 : R.cx * vw;                              // the others are drawn about their own top edge, turned
        const u = easeOut(within(t - dt, ...FOLD6.unroll));       // share of the paper paid out
        const S = u * H;                                           // flat length on screen
        const r = vh * Math.sqrt(RL.r1 * RL.r1 + (RL.r0 * RL.r0 - RL.r1 * RL.r1) * (1 - u)); // the roll thins as it pays out
        const alpha = 1;
        ctx.save();
        if (i > 0 && z > 0) {                                      // the parallax: further than the camera alone carries it
          const d = z * vw * FOLD6.parallax * (1 + 0.35 * (i - 1));
          ctx.translate(d * Math.cos(a), d * Math.sin(a));
        }
        camera();
        if (O) { ctx.translate(O.x * vw, O.top * vh); ctx.rotate((O.deg * Math.PI) / 180); ctx.translate(0, -top); }
        ctx.globalAlpha = alpha;
        // the flat part, with a soft shadow so white reads on white
        if (S > 0.5) {
          ctx.save();
          ctx.shadowColor = 'rgba(40, 32, 24, 0.2)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 3;
          ctx.translate(cx - W / 2, top);
          ctx.scale(k0, k0);
          const src = i === 0 ? img : f6.src;                      // only the first one's total counts down
          ctx.drawImage(src, 0, 0, src.width, (S / H) * src.height, 0, 0, FOLD6.receipt.w, (S / H) * FOLD6.receipt.h);
          if (i === 0 && z > 0) { ctx.shadowColor = 'transparent'; drawReceiptSwap(t); }
          ctx.restore();
        }
        // the roll, its axis just in front of where the paper leaves it
        const fade = (1 - smoothstep(0.93, 1, u)) * alpha;          // the last turn lies down flat
        if (fade > 0) drawRoll(cx, W * 1.01, top + S, r, S / r, fade);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // --- Fold 7: the looping video ----------------------------------------------------

  const f7 = { pos: 0 }; // pos 0..1 through the entrance, advanced by tick()
  const f7bg = document.getElementById('f7bg');

  // The video is an element over the canvas: clipped from the bottom up as it
  // wipes in, playing only while any of it is on screen.
  function updateFold7() {
    const t = (f7.pos * FOLD7.ms) / 1000;
    const w = easeInOut(within(t, ...FOLD7.wipe));
    if (f6.pos > 0 && f7bg.preload !== 'auto') { f7bg.preload = 'auto'; f7bg.load(); } // fetch it while fold 6 plays
    f7bg.style.clipPath = `inset(${((1 - w) * 100).toFixed(2)}% 0 0 0)`;
    const on = w > 0;
    f7bg.style.visibility = on ? 'visible' : 'hidden';
    if (on && f7bg.paused) f7bg.play().catch(() => {});
    else if (!on && !f7bg.paused) { f7bg.pause(); f7bg.currentTime = 0; }
  }

  function loadLayers() {
    return Promise.all(
      Object.entries(LAYERS).map(([name, { src }]) => loadImage(src).then((img) => { layers[name] = img; }))
    );
  }

  // --- State ------------------------------------------------------------------

  let phase = 'loading'; // loading -> intro -> scroll
  let introFade = 1;      // black over the landing animation as it starts (1 = all black)
  let introPos = 0;
  let scrubTarget = 0; // seconds along the scroll timeline
  let scrubPos = 0;
  let lastDrawn = null;

  // Copy (text in the page, over the canvas). Every block comes in and goes
  // out the same way: it fades in while sliding up into place, and fades out
  // while carrying on upwards, heading first, the line under it a beat later.
  // All of it follows the scroll and the timed moments, so it runs backwards
  // too. (The landing line comes in while the landing animation plays, see
  // LANDING_IN, and leaves the same way as the rest.)
  const copyLanding = document.getElementById('copyLanding');
  const copyPass = document.getElementById('copyPass');
  const copyBill = document.getElementById('copyBill');
  const copyG1 = document.getElementById('copyG1');
  const copyF5 = document.getElementById('copyF5');
  const copyF6 = document.getElementById('copyF6');
  const copyF7 = document.getElementById('copyF7');
  const COPY_SLIDE = 40 / 1728; // how far it travels in and out, as a share of the screen width
  const easeIn = (t) => t * t * t;

  // Each line's way in and out is a stretch of the scroll too, so the text
  // moves with the scroll like everything else (and runs backwards going up).
  // A block's body follows its heading a beat behind.
  const COPY_LAG = 0.08; // timeline seconds between a heading and the line under it

  // `inP` 0..1 = how far it has come in, `outP` 0..1 = how far it has gone out.
  function slide(el, inP, outP) {
    const i = easeOut(clamp01(inP)), o = easeIn(clamp01(outP));
    const d = COPY_SLIDE * view.w;
    el.style.opacity = (i * (1 - o)).toFixed(3);
    el.style.transform = `translateY(${(d * (1 - i) - d * o).toFixed(1)}px)`;
  }
  // in / out: [start, end] on the timeline (out may be null: it stays)
  function textBlock(box, t, inR, outR) {
    box.style.opacity = '1';
    [...box.children].forEach((el, k) => {
      const lag = k * COPY_LAG;
      slide(el, progress(t, [inR[0] + lag, inR[1] + lag]), outR ? progress(t, [outR[0] + lag, outR[1] + lag]) : 0);
    });
  }

  // Where the page comes to rest once a scroll stops: on a fold with its text
  // fully in, halfway between its scene having finished (and the text having
  // arrived) and the text starting to leave for the next part.
  const segIn = (name, a, len = 0.3) => { const [s0, s1] = SEG[name]; const at = s0 + a * (s1 - s0); return [at, at + len]; };
  const before = (name) => [SEG[name][0] - 0.45, SEG[name][0] - 0.15]; // gone just before the next part starts
  const RESTS = (() => {
    const mid = (sceneEnd, textIn, next) => (Math.max(sceneEnd, textIn[1] + COPY_LAG) + before(next)[0]) / 2;
    return [
      LANDING_TIME,                                                                        // the landing view, the landing line (where the landing animation ends)
      F1_SCROLL_TIME,                                                                      // the top view of the table, the line still there
      mid(VIDEO_END, [VIDEO_END - 0.35, VIDEO_END - 0.05], 'fold3'),                       // Introducing Dining Pass
      mid(SEG.collage[1], segIn('fold3', 0.35), 'facade'),                                 // fold 3, the collage in
      mid(SEG.gate[1], segIn('gate', 0.85), 'dive'),                                       // your bill arrives with good news, and its body
      mid(SEG.f5[1], segIn('f5', FOLD5.copyAt / (FOLD5.ms / 1000)), 'f6'),                 // the map
      mid(SEG.f6[1], segIn('f6', FOLD6.head[0] / (FOLD6.ms / 1000)), 'f7'),                // the receipt, counted down
      Math.max(SEG.f7[1], segIn('f7', FOLD7.head[0] / (FOLD7.ms / 1000), 0.4)[1] + COPY_LAG) + 0.3, // bon appetit.
    ];
  })();

  // the landing line comes in, line by line, as the curtains open (seconds into fold 1)
  const LANDING_IN = [2.2, 2.8];
  const f5Num = document.getElementById('f5Num');
  const f5Plus = document.getElementById('f5Plus');
  const F5_REST = RESTS.find((r) => r > SEG.f5[0]); // the map's resting place
  function updateCopy() {
    if (phase === 'loading') return;
    const t = phase === 'scroll' ? scrubPos : introPos / SEQUENCES.fold1.fps;
    textBlock(copyLanding, t, LANDING_IN, [F1_SCROLL_TIME + 0.05, F1_SCROLL_TIME + 0.5]);
    textBlock(copyPass, t, [VIDEO_END - 0.35, VIDEO_END - 0.05], before('fold3'));
    textBlock(copyBill, t, segIn('fold3', 0.35), before('facade'));
    textBlock(copyG1, t, segIn('gate', 0.85), before('dive'));
    textBlock(copyF5, t, segIn('f5', FOLD5.copyAt / (FOLD5.ms / 1000)), before('f6'));
    // "600+" counts up from 0 as it comes in, slowing as it nears 600, and the
    // "+" appears the moment it gets there (by the time the page comes to rest)
    const c = easeOut(progress(t, [segIn('f5', FOLD5.copyAt / (FOLD5.ms / 1000))[0], F5_REST - 0.05]));
    const n = String(Math.round(600 * c));
    if (f5Num.textContent !== n) f5Num.textContent = n;
    f5Plus.style.opacity = n === '600' ? '1' : '0'; // the moment it reads 600
    textBlock(copyF6, t, segIn('f6', FOLD6.head[0] / (FOLD6.ms / 1000)), before('f7'));
    textBlock(copyF7, t, segIn('f7', FOLD7.head[0] / (FOLD7.ms / 1000), 0.4), null);
  }

  function render(force) {
    updateCopy();
    updateFold7();
    let key, ok;
    if (phase === 'scroll') {
      key = 's:' + scrubPos.toFixed(4) + ':' + screenT.toFixed(4) + ':' + collageCount() + ':' + facadeStep() + ':' + gate.pos.toFixed(5) + ':' + dive.pos.toFixed(5) + ':' + f5.pos.toFixed(5) + ':' + f6.pos.toFixed(5) + ':' + f7.pos.toFixed(5);
      if (!force && key === lastDrawn) return;
      // Fold 1, then fold 2 (the macro move and the bill book), then fold 3.
      // Fold 2 starts on fold 1's last frame, so that hand-off is invisible.
      if (scrubPos <= F1_SCROLL_TIME) {
        ok = paint('fold1', scrubPos * SEQUENCES.fold1.fps);
      } else if (scrubPos <= VIDEO_END) {
        ok = paint('fold2', fold2Frame(scrubPos - F1_SCROLL_TIME)); // its first frame is fold 1's last: no dissolve
      } else {
        ok = paintScene(scrubPos - VIDEO_END);
      }
    } else if (phase === 'loading') {
      // the start is on black: nothing is drawn until the landing animation begins
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ok = false;
    } else {
      key = 'i:' + introPos;
      if (!force && key === lastDrawn) return;
      ok = paint('fold1', introPos);
      if (ok && introFade > 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(0,0,0,${introFade.toFixed(3)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    lastDrawn = ok ? key : null;
  }

  function scrollProgress() {
    const total = scrolly.offsetHeight - stableVH();
    if (total <= 0) return 0;
    const y = window.scrollY - scrolly.offsetTop;
    return Math.max(0, Math.min(1, y / total));
  }

  // Scroll position (px) that corresponds to a time on the scroll timeline.
  function scrollYForTime(time) {
    const total = scrolly.offsetHeight - stableVH();
    return scrolly.offsetTop + (tToU(time) / SCROLL_U) * total;
  }

  // --- Coming to rest ---------------------------------------------------------
  // Magnetic scroll: the scroll moves freely (every frame of every part sits
  // at its own spot along it), and when it stops (trackpad momentum included)
  // the page eases on to the next resting place (a fold with its text fully
  // in) in the direction it was scrolling: down to the next one below, up to
  // the next one above. Dragging the scrollbar settles the same way when it's
  // let go. Any wheel, touch or key input stops a settle at once.
  const SETTLE_IDLE_MS = 140;   // no scroll events for this long = the scroll has stopped
  const ON_REST = 0.02;         // this close to a resting place counts as on it
  let settling = 0, idleTimer = 0, dragging = false, lastY = 0, scrollDir = 1;
  const nearestRest = (t) => RESTS.reduce((a, r) => (Math.abs(r - t) < Math.abs(a - t) ? r : a), RESTS[0]);
  function restAhead(t, dir) {
    const on = RESTS.find((r) => Math.abs(r - t) <= ON_REST);
    if (on !== undefined) return on;
    const r = dir > 0 ? RESTS.find((x) => x > t) : [...RESTS].reverse().find((x) => x < t);
    return r !== undefined ? r : nearestRest(t);
  }
  // The snap plays what it passes through at a speed that can be followed:
  // each part at its own natural length (seconds), the pauses between them
  // briskly; it eases in as it sets off and out as it arrives.
  const NATURAL_S = () => ({
    fold1: 1.6,                 // the landing view down to the top of the table
    glide: 2.0 * F2.glide.len / 4, hand: 1.6 * F2.hand.len / 3, // the camera's glide to the bill book, the hand placing it (each at the pace it had before the stills were taken out)
    fold3: 1.0, collage: SCREEN_LEN + 0.2,
    facade: FACADE_ZOOM_MS / 1000 + 0.1, gate: GATE_MS / 1000 * 0.8, // the facade zoom, through the gate into the gallery (the snap carries through both, fold 3 -> 4)
    dive: 1.6,                  // pushing into the painting
    f5: FOLD5.ms / 1000 + 0.4,  // the map
    f6: FOLD6.ms / 1000 + 0.6,  // the receipt
    f7: FOLD7.ms / 1000,
  });
  const GAP_PACE = 1.6;         // timeline seconds per second through the pauses with nothing moving
  function paceAt(t) {
    const n = NATURAL_S();
    if (t >= LANDING_TIME && t < F1_SCROLL_TIME) return (F1_SCROLL_TIME - LANDING_TIME) / n.fold1;
    if (t >= F1_SCROLL_TIME && t < F1_SCROLL_TIME + F2.glide.len) return F2.glide.len / n.glide;
    if (t >= F1_SCROLL_TIME + F2.glide.len && t < VIDEO_END) return F2.hand.len / n.hand;
    for (const name of ['fold3', 'collage', 'facade', 'gate', 'dive', 'f5', 'f6', 'f7']) {
      const [a, b] = SEG[name];
      if (t >= a && t < b) return (b - a) / n[name];
    }
    return GAP_PACE;
  }
  function settle() {
    if (phase !== 'scroll' || dragging) return;
    const from = uToT(scrollProgress() * SCROLL_U);
    if (MANUAL.some(([a, b]) => from > a + 0.02 && from < b - 0.02)) return; // stopped inside a manual stretch: stay put
    let to = restAhead(from, scrollDir);
    // never carried through a manual stretch: short of it, back to the fold it was left from
    if (MANUAL.some(([a, b]) => Math.min(from, to) < b && Math.max(from, to) > a)) to = restAhead(from, -scrollDir);
    if (Math.abs(scrollYForTime(to) - window.scrollY) < 1) return;
    const dir = Math.sign(to - from);
    let t = from, last = 0, start = 0;
    const stepS = (now) => {
      if (!settling) return;
      if (!start) start = last = now;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const pace = paceAt(dir > 0 ? t : t - 1e-6) * (dir < 0 ? 1.4 : 1); // a little quicker going back up
      const easeIn = Math.min(1, 0.25 + (now - start) / 350);              // setting off
      const easeOut = Math.max(0.12, Math.min(1, Math.abs(to - t) / (pace * 0.45))); // arriving
      t += dir * pace * easeIn * easeOut * dt;
      const done = dir > 0 ? t >= to : t <= to;
      if (done) t = to;
      window.scrollTo(0, Math.round(scrollYForTime(t)));
      if (!done) settling = requestAnimationFrame(stepS);
      else settling = 0;
    };
    settling = requestAnimationFrame(stepS);
  }
  function stopSettling() {
    if (settling) { cancelAnimationFrame(settling); settling = 0; }
  }

  function onScroll() {
    if (phase !== 'scroll') return;
    if (!settling) {
      const y = window.scrollY;
      if (y !== lastY) scrollDir = y > lastY ? 1 : -1; // the way the scroll is going (not the settle's own movement)
      if (!dragging) { clearTimeout(idleTimer); idleTimer = setTimeout(settle, SETTLE_IDLE_MS); }
    }
    lastY = window.scrollY;
    scrubTarget = uToT(scrollProgress() * SCROLL_U);
    kick();
  }

  // The one animation loop: the scene follows the scroll position, every frame
  // of every part tied to its own spot along the scroll, with a light
  // smoothing so a wheel's steps glide rather than jump. Nothing plays on its
  // own: scroll and it moves, stop and it stops, scroll back and it runs back.
  let rafId = 0;
  let lastTick = 0;
  const SMOOTH = 0.82; // share of the remaining distance still left after 1/60 s

  function setMoments(t) {
    screenT = progress(t, SEG.collage) * SCREEN_LEN;
    facade.pos = progress(t, SEG.facade);
    gate.pos = progress(t, SEG.gate);
    dive.pos = progress(t, SEG.dive);
    f5.pos = progress(t, SEG.f5);
    f6.pos = progress(t, SEG.f6);
    f7.pos = progress(t, SEG.f7);
    if (facade.pos > 0) primeGate();
  }

  function tick(now) {
    rafId = 0;
    const dt = lastTick ? Math.min(0.05, (now - lastTick) / 1000) : 1 / 60;
    lastTick = now;
    const diff = scrubTarget - scrubPos;
    if (Math.abs(diff) < 0.0005) scrubPos = scrubTarget;
    else scrubPos += diff * (1 - Math.pow(SMOOTH, dt * 60));
    setMoments(scrubPos);
    render(false);
    if (scrubPos !== scrubTarget) kick();
    else lastTick = 0;
  }
  function kick() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  // --- The start: the landing line assembling on black ------------------------------

  // --- Fold 1, 0:00–0:04: landing animation ----------------------------------

  // Plays fold 1 to 0:04 (the landing view) at its own speed, fading in from
  // black; the landing line comes in as it plays. The rest of fold 1 (down
  // to the top view of the table) is the first scroll.
  function playIntro(fold1Loaded) {
    phase = 'intro';
    const { fps } = SEQUENCES.fold1;
    if (reduceMotion) {
      introPos = INTRO_END; introFade = 0; render(true);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let start = null, last = 0, acc = 0;
      const step = (now) => {
        if (start === null) start = last = now;
        acc += ((now - last) / 1000) * fps; last = now;
        let ready = introPos;
        while (ready < INTRO_END && frames.fold1[ready + 1] !== undefined) ready++;
        acc = Math.min(acc, ready + 0.999, INTRO_END);
        introPos = Math.floor(acc);
        introFade = 1 - easeInOut(Math.min(1, (now - start) / INTRO_FADE_MS));
        render(introFade > 0);
        if (introPos < INTRO_END) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  function enableScroll() {
    phase = 'scroll';
    root.classList.remove('is-intro');
    resize(); // the scrollbar may have changed the canvas size
    // Park the page at 0:04 so the landing view is where the intro ended.
    window.scrollTo(0, Math.round(scrollYForTime(LANDING_TIME)));
    scrubPos = scrubTarget = LANDING_TIME;
    setMoments(scrubPos);
    render(true);
    window.addEventListener('scroll', onScroll, { passive: true });
    for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.addEventListener(ev, stopSettling, { passive: true });
    // a press on the scrollbar (outside the page's own width) drags freely, then settles on the nearest fold
    window.addEventListener('mousedown', (e) => { if (e.clientX >= document.documentElement.clientWidth) dragging = true; });
    window.addEventListener('mouseup', () => { if (dragging) { dragging = false; settle(); } });
    onScroll();
  }

  // --- Boot -------------------------------------------------------------------

  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize); // a phone's address bar sliding in and out
  resize();

  // The landing animation starts once its 0:00–0:04 frames are in, and the
  // landing line assembles over it as it fades in from black.
  loadRange('fold1', 0, INTRO_END, (p) => {
    loaderBar.style.transform = `scaleX(${p})`;
    loader.setAttribute('aria-valuenow', Math.round(p * 100));
    if (phase === 'loading') render(true);
  })
    .then(() => {
      loader.classList.add('is-done');
      // Fetch the scroll-driven frames while the landing animation plays.
      const redraw = () => { if (phase === 'scroll') render(true); };
      const fold1Loaded = loadRange('fold1', INTRO_END + 1, INTRO_LAST, redraw);
      fold1Loaded
        .then(() => loadRange('fold2', 0, SEQUENCES.fold2.count - 1, redraw))
        .then(() => Promise.all([loadLayers(), loadCollage(), loadFacade(), loadGate(), loadFold5(), loadFold6()]))
        .then(redraw);
      return playIntro(fold1Loaded);
    })
    .then(enableScroll);
})();
