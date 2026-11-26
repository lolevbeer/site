// Copied from lolevbeer/hq@3d7ac6b4c1ed0b0b30b853db899312af2415ec52 by scripts/sync-hq-model.mjs. Do not edit; re-run the script.
// lolev-model.js: the Lolev Beer brewery at 5247 Butler St as a three.js model, in one file that loads nothing itself: the
// caller hands it three.js, a renderer and a scene. Units: 1 = 1 ft, x east, y up, z south.
// GENERATED in lolevbeer/hq by tools/build_module.py: this is 3d/src/module.js with views.js and the MODEL sources
// (tools/scene_sources.py) put in at its two markers. Edit those sources and rebuild; see that repo's README, The model as a module.
// views.js: The named views: where the camera stands (p) and looks (t), in feet, and whether the ceilings and the upper floor show.
// On its own, with nothing before it: the viewer's View menu lists these (interaction/camera.js), and the module build exports them.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
const VIEWS = {
  'Overview':   { p: [118, 96, 150], t: [52, 0, 56], ceil: false, up: false },
  'Bar':        { p: [29.5, 5.4, 83.2], t: [57, 6.2, 71.5], ceil: true, up: true },
  'Seating':    { p: [89, 5.4, 92], t: [61, 5, 72], ceil: true, up: true },
  'Behind bar': { p: [31.5, 5.4, 66.8], t: [56, 4.8, 70], ceil: true, up: true },
  'Brewery':    { p: [62, 7, 44], t: [24, 5, 16], ceil: true, up: true },
  'Upstairs':   { p: [40, 62, 112], t: [42, 9, 64], ceil: false, up: true },   // looking down into the Level 2 rooms with the roof off
};
export { VIEWS };

/**
 * Build the model into `scene`, and resolve once its photos have loaded and its meshes are merged (about 40 draw calls).
 * It sets `renderer`'s shadow map and tone mapping (model-core.js) and `scene`'s background, environment and onBeforeRender,
 * and leaves the model lit as the Overview has it. Nothing moves afterwards, so draw a frame only after show() or a change of camera.
 *
 * @param {object} deps
 * @param deps.THREE          the three.js module (r187)
 * @param deps.addons         { mergeGeometries, RoomEnvironment } and, at 'full' only, { Reflector, RectAreaLightUniformsLib }
 * @param deps.renderer       a THREE.WebGLRenderer
 * @param deps.scene          a THREE.Scene
 * @param deps.textureUrl     name => URL of that file from dist/tex/, as in name => '/3d/hq/' + name. The model asks for
 *                            'brick-color.webp' at 'full' and 'brick-color.lite.webp' at 'lite'. WebGL must be allowed to read
 *                            the URLs: same origin, or CORS.
 * @param {'full' | 'lite'} deps.quality   'lite' is for phones: see model-core.js
 * @returns {Promise<{ groups: Record<'world' | 'furn' | 'canopy' | 'ceil' | 'up', THREE.Group>, show: (view: { ceil: boolean, up: boolean }) => void, dispose: () => void }>}
 */
export async function buildModel({ THREE, addons, renderer, scene, textureUrl, quality }) {
  const { mergeGeometries, RoomEnvironment, Reflector, RectAreaLightUniformsLib } = addons;
  // A photo the model knows as brick-color.jpg is dist/tex/brick-color.webp, or at 'lite' the half-size brick-color.lite.webp.
  const texURL = file => textureUrl(file.replace(/\.\w+$/, quality === 'lite' ? '.lite.webp' : '.webp'));
  const before = new Set(scene.children);   // dispose() takes out what is not in here
// model-core.js: The start of the model: how the renderer it is given shades it, the scene's sky and reflections, the model's
// groups, and the state its lighting reads. It is handed THREE, `renderer`, `scene` and the three.js addons it uses: by core.js
// on the viewer page, by the caller of the module build (tools/build_module.py).
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// `quality` is 'full', or 'lite' for a phone: no live mirrors (mirrors.js), solid glass block (catalog.js), no LED strip lights
// (lighting.js) and half-size drawn textures (textures.js).
if (quality === 'full') RectAreaLightUniformsLib.init();   // the LED strips (lighting.js) are RectAreaLights, which draw wrong without these tables
// The glass block (M.glassBlock) bends the view behind it, so three.js first draws the whole model, fully lit, into a picture for
// the blocks to look through: half of every frame's work (measured, 2026-11-13). The blocks are frosted and blur that picture
// anyway, so it is drawn at a quarter of the frame's width and height.
renderer.transmissionResolutionScale = .25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;      // soft since three r182, which retired PCFSoftShadowMap
renderer.shadowMap.autoUpdate = false;              // the scene is static: shadows are drawn once, and again only when a toggle changes what's visible
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
scene.background = new THREE.Color('#d9e2ea');
// The lighting was tuned on three r160's studio room: at the origin, its main light at 5. Since r183 the room sits 3.5 lower and
// that light is at 900, which washes every view out; put both back.
const studio = new RoomEnvironment();
studio.position.y = 0; studio.children.find(o => o.isPointLight).intensity = 5;
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(studio, 0.04).texture;

const groups = { world: new THREE.Group(), furn: new THREE.Group(), canopy: new THREE.Group(), ceil: new THREE.Group(), up: new THREE.Group() };
Object.values(groups).forEach(g => scene.add(g));

// What applyLight() (lighting.js) reads and sets. On the viewer page the toolbar's buttons change these; the module leaves them as they are.
let night = false;      // after dark: no sun, and the room lit only by its fixtures (the Night button)
let wire = false;       // the model is drawn as bare edges (the Wireframe button)
let dirty = true;       // the picture is out of date: whoever draws the model draws a new frame and clears it

// geometry.js: Shared plan geometry: walker solids (SOLIDS), and helpers for polygons, rectangles and distances (segDist).
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// What a walker cannot pass through (blocked(), interaction/walking.js): the plan outline and heights of every prism, and of the walls
// built from an elevation (solidRun).
const SOLIDS = [];   // { pts, y0, y1, box: [x0, z0, x1, z1] }
/** Record a solid: the plan polygon pts from height y0 to y1. */
function solid(pts, y0, y1) {
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  SOLIDS.push({ pts, y0, y1, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] });
}
/** Record a wall built from its elevation outline [[s, y], ...] (s along x, or along z when alongZ; w0..w1 its two faces on the
 *  other axis): each stretch that stands on the floor is solid to the wall's top. A doorway, a notch up from the floor, is not. */
function solidRun(profile, w0, w1, alongZ) {
  const top = Math.max(...profile.map(p => p[1]));
  profile.forEach(([s, y], i) => {
    const [s2, y2] = profile[(i + 1) % profile.length];
    if (y || y2 || s === s2) return;                                    // not an edge along the floor
    const a = Math.min(s, s2), b = Math.max(s, s2);
    solid(alongZ ? rect(w0, a, w1, b) : rect(a, w0, b, w1), 0, top);
  });
}
/** Vertical prism over a plan polygon [[x,z],...] from height y0 to y1. World UVs, so textures tile in feet.
 *  bevel (ft) rounds the top and bottom edges within the same outline, to that radius (owner, 2026-11-12: rounded, not a 45° bevel);
 *  a razor-sharp edge is what makes a counter look computer-made. */
function prism(pts, y0, y1, mat, parent = groups.world, shadow = true, bevel = 0) {
  solid(pts, y0, y1);
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0 - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 6, UVGenerator: THREE.ExtrudeGeometry.WorldUVGenerator });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + bevel, 0);
  // The rounded edge is built as 6 flat strips. Shade them as one quarter-round: on a strip (its flat normal is neither level
  // nor upright) give each vertex the round's own normal, which leans up or down by the vertex's height on the round.
  const P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; bevel > 0 && i < P.count; i++) {
    const flatUp = N.getY(i);
    if (Math.abs(flatUp) < .01 || Math.abs(flatUp) > .99) continue;                     // a side or a top/bottom face: leave flat
    const up = Math.max(-1, Math.min(1, (P.getY(i) - (flatUp > 0 ? y1 - bevel : y0 + bevel)) / bevel));
    const out = Math.sqrt(1 - up * up) / Math.hypot(N.getX(i), N.getZ(i));
    N.setXYZ(i, N.getX(i) * out, up, N.getZ(i) * out);
  }
  const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
}
const EDGE = .0104, EDGE_CONCRETE = .0208;            // radius of the rounded edge on the quartz tops, 1/8", and the concrete ones, 1/4" (owner, 2026-11-12)
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
/** Is the plan point (x, z) inside the polygon [[x, z], ...]? */
function inPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < xi + (xj - xi) * (z - zi) / (zj - zi)) inside = !inside;
  }
  return inside;
}
/** Quad strip along a line: from point a along unit u for length len, between offsets o0..o1 along unit n. */
function band(a, u, n, len, o0, o1) {
  const p = (s, o) => [a[0] + u[0] * s + n[0] * o, a[1] + u[1] * s + n[1] * o];
  return [p(0, o0), p(len, o0), p(len, o1), p(0, o1)];
}

/** A-01 sheet point (13.5 pt = 1 ft, origin at the trace's) to model feet, like the traced walls. */
const pt = (x, y) => [(x + 75) / 13.5, (y + 608) / 13.5];
const ptRect = (x0, y0, x1, y1) => { const [a, b] = pt(x0, y0), [c, d] = pt(x1, y1); return rect(a, b, c, d); };
/** Distance in plan from (x, z) to the segment a-b. */
const segDist = (x, z, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - t * dx, z - az - t * dz); };

// textures.js: Canvas texture primitives, deterministic noise, and photo loading.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// ---------- textures (1 texture unit = 1 ft via world UVs) ----------
function canvasTex(px, draw, feet) {
  let c = document.createElement('canvas'); c.width = c.height = px;
  draw(c.getContext('2d'), px);
  if (quality === 'lite') {   // the same drawing at half the size (the draw functions work in whole pixels, so it is scaled, not redrawn)
    const half = document.createElement('canvas'); half.width = half.height = px / 2;
    half.getContext('2d').drawImage(c, 0, 0, px / 2, px / 2); c = half;
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / feet, 1 / feet);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// Photo textures (Poly Haven, CC0; see README) load from wherever texURL() says: core.js's on the viewer page, the caller's in
// the module build. They load after the first frame and redraw when ready.
const loading = new THREE.LoadingManager();   // knows when every photo has arrived: the module build (module.js) waits for that
const loader = new THREE.TextureLoader(loading);
function photoTex(file, feet, colour = true) {
  const t = loader.load(texURL(file), () => applyLight());   // redraw, and retake the room's reflection with the photo in it
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / feet, 1 / feet); t.anisotropy = 8;
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// surface-textures.js: Procedural architectural surface maps, wear, grain, and wired glass.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
const BRICK_FT = 3.28;                               // the brick photo covers 1 m x 1 m of wall (14 courses), so bricks come out true size
const concreteTex = canvasTex(1024, (g, n) => {      // 16 ft square slab with saw-cut joint at the edge
  g.fillStyle = '#9a948d'; g.fillRect(0, 0, n, n);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${rnd() < .5 ? '60,55,50' : '235,230,222'},${rnd() * 0.05})`; const r = 4 + rnd() * 60; g.beginPath(); g.arc(rnd() * n, rnd() * n, r, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(40,36,32,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, n, n);
}, 16);
// Back-bar tile: grey 3x6 bevelled subway in a 45° herringbone, laid as in the owner's site photo (2026-11-09): the zigzags run across
// the wall (peaks side by side), so the tiles stand in upright strips 4¼" wide, every tile in a strip leaning the same way.
// In tile-width units a long tile starts where (x + y) % 4 == 0 and an upright one where it is 2, which covers the plane with
// no gaps (checked on a grid). Turned 45° (anticlockwise: clockwise lays the strips on their side), the pattern repeats every
// 2·√2 tile widths; the texture spans three repeats (25½").
const TILE_FT = 6 * Math.SQRT2 * 3 / 12;
/** Draw each tile face inside its grout joint, in pixels in a frame turned 45°. */
function herringbone(g, n, draw) {
  const u = n / (6 * Math.SQRT2), j = 4;                  // px per tile width; grout joint in px
  g.save(); g.rotate(-Math.PI / 4);
  for (let x = -8; x < 7; x++) for (let y = -2; y < 13; y++) {   // turned this way, the canvas spans x -6..6, y 0..12
    const k = ((x + y) % 4 + 4) % 4;
    if (k === 0) draw(x * u + j / 2, y * u + j / 2, 2 * u - j, u - j);
    if (k === 2) draw(x * u + j / 2, y * u + j / 2, u - j, 2 * u - j);
  }
  g.restore();
}
const tileTex = canvasTex(1024, (g, n) => {
  g.fillStyle = '#e4e3df'; g.fillRect(0, 0, n, n);       // light grout
  g.fillStyle = 'hsl(210, 6%, 66%)';
  herringbone(g, n, (x, y, w, h) => g.fillRect(x, y, w, h));
}, TILE_FT);
// The tiles are bevelled (owner, 2026-11-12, from a picture of bevelled subway tile): a flat face with a ½" bevel down to the
// joint on all four sides. Drawn as a normal map, not built: each bevel is filled with the colour of a normal leaning 18°
// outward (30° read as dark stripes). The colours are for this layout only: the tiles are turned 45°, so every bevel leans along
// a diagonal. The top and bottom bevels are drawn full width and the side ones over them, mitred. Very close up, each mitre
// shows as a hairline: the canvas blends the two bevels' colours along it, which is a normal facing between them.
const tileNormal = canvasTex(1024, (g, n) => {
  g.fillStyle = '#8080ff'; g.fillRect(0, 0, n, n);       // flat: the grout and the tiles' faces
  const b = n / (6 * Math.SQRT2) / 6;                    // ½" in px
  const mitred = (colour, ...pts) => { g.fillStyle = colour; g.beginPath(); pts.forEach(([x, y]) => g.lineTo(x, y)); g.fill(); };
  herringbone(g, n, (x, y, w, h) => {
    const X = x + w, Y = y + h;
    g.fillStyle = '#649cf9'; g.fillRect(x, y, w, b);                     // top and bottom, in the turned frame
    g.fillStyle = '#9c64f9'; g.fillRect(x, Y - b, w, b);
    mitred('#6464f9', [x, y], [x + b, y + b], [x + b, Y - b], [x, Y]);   // left and right
    mitred('#9c9cf9', [X, y], [X - b, y + b], [X - b, Y - b], [X, Y]);
  });
}, TILE_FT);
tileNormal.colorSpace = THREE.NoColorSpace;
// Slate 12x24 (site photo, Lolev Beer-9.jpg): charcoal, thin mid-grey grout, the long side running north-south (texture v = world z)
// in a half-offset running bond along that long side. 4 ft square = 4 columns of 1 ft, 2 courses of 2 ft.
const slateTex = canvasTex(1024, (g, n) => {
  g.fillStyle = '#5a5c5f'; g.fillRect(0, 0, n, n);
  const w = n / 4, h = n / 2, j = 2;
  for (let c = 0; c < 4; c++) for (let r = -1; r < 2; r++) {
    const x = c * w, y = r * h + (c % 2) * h / 2;
    g.fillStyle = `hsl(215,${4 + rnd() * 3}%,${22 + rnd() * 6}%)`; g.fillRect(x + j, y + j, w - 2 * j, h - 2 * j);
    for (let k = 0; k < 70; k++) {                      // cleft: faint streaks along the tile's length
      g.fillStyle = `rgba(${rnd() < .5 ? '0,0,0' : '255,255,255'},${rnd() * .05})`;
      g.fillRect(x + j + rnd() * (w - 2 * j - 4), y + j + rnd() * (h - 2 * j - 60), 1 + rnd() * 3, 20 + rnd() * 60);
    }
  }
}, 4);
// Terrazzo: pale ground with grey, black and warm marble chips. 4 ft square.
const terrazzoTex = canvasTex(1024, (g, n) => {
  g.fillStyle = '#e7e3dc'; g.fillRect(0, 0, n, n);
  const chips = ['#9a9893', '#6f6c68', '#2f2e2d', '#c9b8a0', '#b6b2ab', '#857a6c'];
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * n, y = rnd() * n, r = 1 + rnd() * rnd() * 9;
    g.fillStyle = chips[Math.floor(rnd() * chips.length)];
    g.beginPath(); g.ellipse(x, y, r, r * (.5 + rnd() * .5), rnd() * 3.14, 0, 7); g.fill();
  }
}, 4);
const fluteTex = canvasTex(64, (g, n) => {           // 1 ft: eight 1½" flutes
  for (let i = 0; i < 8; i++) { const gr = g.createLinearGradient(i * 8, 0, i * 8 + 8, 0); gr.addColorStop(0, '#0d0d0d'); gr.addColorStop(.5, '#2b2a29'); gr.addColorStop(1, '#0d0d0d'); g.fillStyle = gr; g.fillRect(i * 8, 0, 8, n); }
}, 1);

// Glass block (owner, 2026-11-09; made to refract, 2026-11-12): 8" blocks in white mortar. 2 ft = 3 x 3 blocks.
// One texture per job, all on the same grid: `mortar` fills the joints and `face(g, x, y, s)` paints each block's s-px square.
function glassBlockTex(mortar, face, color = false) {
  const t = canvasTex(384, (g, n) => {
    g.fillStyle = mortar; g.fillRect(0, 0, n, n);
    const s = n / 3, j = s / 24;                                         // j: half a ⅝" joint
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) face(g, i * s + j, k * s + j, s - 2 * j);
  }, 2);
  if (!color) t.colorSpace = THREE.NoColorSpace;                         // data, not a colour
  return t;
}
/** A block face as a flat middle inside a rim a tenth of the block wide: the block's edge wall, where the glass is thick and seen edge-on. */
const rimmed = (rim, mid) => (g, x, y, s) => { g.fillStyle = rim; g.fillRect(x, y, s, s); g.fillStyle = mid; g.fillRect(x + s / 10, y + s / 10, s * .8, s * .8); };
/** A block's height, white = proud: pillowed toward its middle, with eight fine ribs each way crossing into a small grid, as in
 *  the owner's photo of the Butler panel (2026-11-12; the rib count is a guess, the photo is too coarse to count them). */
function ribbedFace(g, x, y, s) {
  const dome = g.createRadialGradient(x + s / 2, y + s / 2, 0, x + s / 2, y + s / 2, s * .7);
  dome.addColorStop(0, '#fff'); dome.addColorStop(1, '#555'); g.fillStyle = dome; g.fillRect(x, y, s, s);
  g.globalAlpha = .4;
  for (const across of [false, true]) {
    const ribs = across ? g.createLinearGradient(x, 0, x + s, 0) : g.createLinearGradient(0, y, 0, y + s);
    for (let i = 0; i <= 16; i++) ribs.addColorStop(i / 16, i % 2 ? '#fff' : '#000');
    g.fillStyle = ribs; g.fillRect(x + s / 10, y + s / 10, s * .8, s * .8);
  }
  g.globalAlpha = 1;
}
// Aluminium tread plate (the Cold Storage door's kick plate): raised lugs 1¼" apart, leaning alternately each way. 2½" square.
const treadTex = canvasTex(128, (g, n) => {
  g.fillStyle = '#9fa3a6'; g.fillRect(0, 0, n, n);
  g.fillStyle = '#f4f5f6';
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    g.save(); g.translate((i + .5) * n / 2, (j + .5) * n / 2); g.rotate((i + j) % 2 ? Math.PI / 4 : -Math.PI / 4);
    g.beginPath(); g.ellipse(0, 0, 26, 7, 0, 0, 7); g.fill(); g.restore();
  }
}, 2.5 / 12);

// Wear and grain (2026-11-12, to make flat surfaces read as real ones): nothing here is from a photo of the building.
// They draw from their own random stream, so adding them leaves rnd()'s sequence, and with it the stools' scatter, as it was.
let seed2 = 99; const rnd2 = () => (seed2 = (seed2 * 16807) % 2147483647) / 2147483647;
/** Soft light and dark blobs, r0..r1 px across, over a canvas n px square: wrapped at the edges, so the texture tiles without a seam. */
function clouds(g, n, count, r0, r1, alpha) {
  for (let i = 0; i < count; i++) {
    const x = rnd2() * n, y = rnd2() * n, r = r0 + rnd2() * (r1 - r0), tone = rnd2() < .5 ? '0,0,0' : '255,255,255', a = rnd2() * alpha;
    for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) {
      const soft = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      soft.addColorStop(0, `rgba(${tone},${a})`); soft.addColorStop(1, `rgba(${tone},0)`);
      g.fillStyle = soft; g.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
    }
  }
}
/** canvasTex for a texture that is numbers, not colour (roughness, a normal map). */
function dataTex(px, draw, feet) { const t = canvasTex(px, draw, feet); t.colorSpace = THREE.NoColorSpace; return t; }
// How worn a floor or a top is, as a roughness map: mid grey with polished (dark) and scuffed (light) patches a foot or two
// across. A material's roughness multiplies it, so it is set to twice the roughness wanted on average.
const wearTex = dataTex(512, (g, n) => { g.fillStyle = '#808080'; g.fillRect(0, 0, n, n); clouds(g, n, 420, 12, 110, .22); }, 14);
// Walnut: the stain's colour with darker and lighter grain lines running along u, a board's length.
const walnutTex = canvasTex(512, (g, n) => {
  g.fillStyle = '#6a4228'; g.fillRect(0, 0, n, n);
  clouds(g, n, 60, 30, 140, .1);
  for (let i = 0; i < 260; i++) {
    const y = rnd2() * n, wave = 1 + Math.floor(rnd2() * 3), amp = rnd2() * 5, phase = rnd2() * 7;
    g.strokeStyle = `rgba(${rnd2() < .65 ? '38,20,10' : '150,104,70'},${.06 + rnd2() * .22})`; g.lineWidth = .6 + rnd2() * 2.4;
    g.beginPath();
    for (let x = 0; x <= n; x += 8) g.lineTo(x, y + amp * Math.sin(x / n * 2 * Math.PI * wave + phase));   // whole waves across, so the ends meet
    g.stroke();
  }
}, 4);

const glassBlockMap = glassBlockTex('#dedbd5', rimmed('#b4cdc9', '#eaf4f2'), true);
const glassBlockTransmission = glassBlockTex('#000', rimmed('#777', '#fff'));
const glassBlockBump = glassBlockTex('#000', ribbedFace);

// Wired glass: a see-through tile with a diamond mesh, 3" from point to point.
const wireGlassTex = canvasTex(128, (g, n) => {
  g.fillStyle = 'rgba(207, 225, 232, .18)'; g.fillRect(0, 0, n, n);
  g.strokeStyle = 'rgba(45, 55, 60, .9)'; g.lineWidth = 2;
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, k * n / 2); g.lineTo(n, k * n / 2 + n); g.moveTo(0, k * n / 2 + n); g.lineTo(n, k * n / 2); g.stroke(); }
}, 1);

// equipment-textures.js: Painted equipment labels, control panels, and gauge faces.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
const stopArrowsTex = canvasTex(128, c => {
  c.translate(64, 64); c.strokeStyle = c.fillStyle = '#f5f3eb'; c.lineWidth = 5;
  for (let i = 0; i < 3; i++) {
    c.rotate(2 * Math.PI / 3);
    c.beginPath(); c.arc(0, 0, 46, -.98, 0); c.stroke();
    c.beginPath(); c.moveTo(37, -2); c.lineTo(55, -2); c.lineTo(46, 10); c.closePath(); c.fill();
  }
}, 1);

const compressorFaceTex = canvasTex(512, (c, n) => {
  c.fillStyle = '#585e69'; c.fillRect(0, 0, n, n);
  c.fillStyle = '#0098b6'; c.fillRect(0, 0, 13, n);
  c.save(); c.translate(10, n - 8); c.rotate(-Math.PI / 2); c.fillStyle = '#fff';
  c.font = 'bold 10px sans-serif'; c.fillText('G7L FF', 0, 0); c.restore();
  c.fillStyle = '#252930'; for (const x of [244, 331]) c.fillRect(x, 0, 2, n);
  c.fillRect(265, 38, 38, 93);                          // controller and display
  c.fillStyle = '#46645c'; c.fillRect(270, 45, 28, 20);
  c.fillStyle = '#282c30'; c.fillRect(363, 304, 119, 179);
  c.fillStyle = '#828792';
  for (let x = 363; x < 482; x += 12) c.fillRect(x, 304, 2, 179);
  for (let y = 304; y < 483; y += 15) c.fillRect(363, y, 119, 3);
}, 1);

// The keg washer's operator panel, as its front view draws it: the name, the touch screen, and START and STOP either side of the selector.
const kwPanelTex = canvasTex(256, (c, n) => {
  c.fillStyle = '#d7d8d8'; c.fillRect(0, 0, n, n);
  c.strokeStyle = c.fillStyle = '#1d1d1b'; c.lineWidth = 3; c.strokeRect(8, 8, n - 16, n - 16);
  c.font = '700 26px sans-serif'; c.textAlign = 'center'; c.fillText('KEG WASHER', n / 2, 52);
  c.fillStyle = '#10293a'; c.fillRect(78, 88, 100, 76);
  for (const [x, colour] of [[88, '#2a8a3a'], [128, '#1d1d1b'], [168, '#b3261e']]) { c.fillStyle = colour; c.beginPath(); c.arc(x, 205, 11, 0, 2 * Math.PI); c.fill(); }
}, 1);

// Pressure gauge dial: a 270° scale on white, the needle a third of the way round.
const dialTex = canvasTex(128, (g, n) => {
  const tick = (a, r0, r1) => { g.beginPath(); g.moveTo(r0 * Math.cos(a), r0 * Math.sin(a)); g.lineTo(r1 * Math.cos(a), r1 * Math.sin(a)); g.stroke(); };
  g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, n, n); g.translate(n / 2, n / 2); g.strokeStyle = '#151515'; g.lineWidth = 3;
  for (let i = 0; i <= 12; i++) tick(Math.PI * (.75 + i / 8), 42, 56);
  g.lineWidth = 5; tick(Math.PI * 1.25, -10, 46);
}, 1);

// catalog.js: The shared finish catalog M, material variants, and reflection environment.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// TVs: screenshots of Lolev's menus on lolev.beer, cans (m/l-cans) and draft (m/l-draft), refreshed by tools/build_3d.py --menu.
const screenMat = file => new THREE.MeshStandardMaterial({ color: '#000', emissive: '#fff', emissiveMap: photoTex(file, 1), emissiveIntensity: .9 });

// Reading a material that isn't (yet) in M throws: three.js would otherwise draw a missing one as plain white, silently,
// which is what a source file loaded before the one that adds its material (scene_sources.py) would get.
const M = new Proxy({
  brick: new THREE.MeshStandardMaterial({ map: photoTex('brick-color.jpg', BRICK_FT), normalMap: photoTex('brick-normal.jpg', BRICK_FT, false), roughness: .9 }),
  mortar: new THREE.MeshStandardMaterial({ color: '#aaa398', roughness: 1 }),   // parged faces of cut brick
  blackPlaster: new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: .85 }),   // black plaster: the Seating Area's walls behind the banquette (owner, 2026-11-13); flat, no brick
  paint: new THREE.MeshStandardMaterial({ color: '#e6e0d7', roughness: .6 }),      // painted interior partitions: smooth sheetrock in eggshell, no texture (owner, 2026-11-13); .6 is the low sheen, tuned by eye
  cut: new THREE.MeshStandardMaterial({ color: '#2e2a27', roughness: 1 }),         // top face of the walls, where the model is sliced open
  floor: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: .48, roughnessMap: wearTex }),   // .24 on average, polished and scuffed in patches
  slate: new THREE.MeshStandardMaterial({ map: slateTex, roughness: .9, roughnessMap: wearTex }),   // honed: a soft sheen, as in the photo
  terrazzo: new THREE.MeshStandardMaterial({ map: terrazzoTex, roughness: .44, roughnessMap: wearTex }),
  walk: new THREE.MeshStandardMaterial({ color: '#b9b4ad', roughness: .95 }),
  street: new THREE.MeshStandardMaterial({ color: '#3d3f42', roughness: .95 }),
  tile: new THREE.MeshStandardMaterial({ map: tileTex, normalMap: tileNormal, roughness: .3 }),   // glazed grey subway, bevelled, herringbone
  quartz: new THREE.MeshStandardMaterial({ color: '#f1efea', roughness: .2 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#9b9892', roughness: 1.2, roughnessMap: wearTex }),   // poured concrete tops (owner, 2026-11-12); plain grey, its sheen worn in patches
  flute: new THREE.MeshStandardMaterial({ map: fluteTex, roughness: .55 }),
  cab: new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: .7 }),
  steel: new THREE.MeshStandardMaterial({ color: '#1f2022', roughness: .5, metalness: .3 }),   // low metalness: a full metal goes pure black indoors, where there is little to reflect
  beer: new THREE.MeshStandardMaterial({ color: '#c98a1e', roughness: .1, emissive: '#7a4a08', emissiveIntensity: .5 }),
  walnut: new THREE.MeshStandardMaterial({ map: walnutTex, roughness: .45 }),
  glass: new THREE.MeshStandardMaterial({ color: '#cfe1e8', roughness: .04, transparent: true, opacity: .16, depthWrite: false }),
  ceil: new THREE.MeshStandardMaterial({ color: '#efebe6', roughness: .95, side: THREE.DoubleSide, emissive: '#8c8378', emissiveIntensity: .3 }),   // emissive stands in for light bounced off the floor
  joist: new THREE.MeshStandardMaterial({ color: '#a98a63', roughness: .8, emissive: '#6b5238', emissiveIntensity: .4 }),   // exposed timber joists (assumed)
  lamp: new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffc983', emissiveIntensity: 3 }),                     // the lit face of a downlight
  tank: new THREE.MeshStandardMaterial({ color: '#dfe3e7', roughness: .15, metalness: 1 }),   // polished stainless (owner, 2026-11-09: shinier)
  // Chrome (the draft faucets; owner, 2026-11-11): a mirror like M.tank, but it keeps the neutral studio room as its reflection,
  // not the cellar photo, which this close turns small parts pink.
  chrome: new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: .06, metalness: 1 }),
  globe: new THREE.MeshStandardMaterial({ color: '#fff6e6', emissive: '#ffd9a0', emissiveIntensity: 2.2 }),
  cansScreen: screenMat('tv-cans.jpg'), draftScreen: screenMat('tv-draft.jpg'),
  door: new THREE.MeshStandardMaterial({ color: '#7b7f84', roughness: .6, metalness: .4 }),
  porcelain: new THREE.MeshStandardMaterial({ color: '#f5f4f1', roughness: .15 }),
  partition: new THREE.MeshStandardMaterial({ color: '#8e9296', roughness: .45, metalness: .2 }),    // powder-coated toilet partitions
  mirror: new THREE.MeshStandardMaterial({ color: '#d9e1e4', roughness: .02, metalness: 1 }),
  // The Seating Area's mirror wall mixes plain panes (M.mirror) with two tints (owner, 2026-11-14): dark, and a slight copper. Shades by eye from the photos, then a third lighter (owner, 2026-11-14: too dark).
  mirrorDark: new THREE.MeshStandardMaterial({ color: '#77797c', roughness: .02, metalness: 1 }),
  mirrorCopper: new THREE.MeshStandardMaterial({ color: '#b99f90', roughness: .02, metalness: 1 }),
  // Glass block lets light through but bends and blurs it (transmission, not opacity: see-through film showed the room behind
  // sharp). The mortar is solid (transmissionMap), and each block's ribs (bumpMap) bend the view their own way. Thickness is 4" in feet.
  // At 'lite' the blocks are solid, as a mirror shows them: looking through them has three draw the whole model a second time.
  glassBlock: quality === 'lite' ? new THREE.MeshStandardMaterial({ map: glassBlockMap, roughness: .35 }) : new THREE.MeshPhysicalMaterial({
    map: glassBlockMap, transmissionMap: glassBlockTransmission,
    bumpMap: glassBlockBump, bumpScale: 5, roughness: .35, transmission: 1, thickness: .33, ior: 1.5,
  }),
  // Glass block as a mirror shows it (mirrors.js): the same faces, solid. Looking through them would have three draw the room once more for every reflection.
  glassBlockSolid: new THREE.MeshStandardMaterial({ roughness: .35 }),
  garage: new THREE.MeshStandardMaterial({ color: '#f3f2ef', roughness: .45, metalness: .1 }),   // white steel; the section joints are modeled
  garageSeal: new THREE.MeshStandardMaterial({ color: '#c2c0ba', roughness: .9 }),   // light grey between white steel sections
  couch: new THREE.MeshStandardMaterial({ color: '#3d4046', roughness: .95 }),   // the Seating Area couch: charcoal fabric (a guess)
  // The Seating Area banquette, colours by eye from the owner's photos (2026-11-13): a glossy tan-orange vinyl seat and a lighter velvet back.
  banquetteSeat: new THREE.MeshStandardMaterial({ color: '#b5682d', roughness: .4 }),
  banquetteBack: new THREE.MeshStandardMaterial({ color: '#c8873f', roughness: .95 }),
  // Brushed stainless cladding (DG1's frame) and the Cold Storage door's hardware. Not M.tank: that one reflects the cellar photo, which is wrong on the street.
  // Half metal, like M.steel: a full metal goes near black seen from indoors, where there is little to reflect.
  stainless: new THREE.MeshStandardMaterial({ color: '#cdd1d4', roughness: .35, metalness: .5 }),
  // Plain stainless sheet, indoors: the Cold Storage door and the draft system. One even mid grey, with no brushed grain (owner, 2026-11-14;
  // until then it had hairlines up the sheet). Not M.stainless: indoors that one's pale grey reads as white paint, and it is tuned for the street.
  stainlessSheet: new THREE.MeshStandardMaterial({ color: '#a9aeb2', roughness: .4, metalness: .6 }),
  tread: new THREE.MeshStandardMaterial({ map: treadTex, bumpMap: treadTex, roughness: .35, metalness: .5 }),
}, {
  get(m, name) {
    if (typeof name === 'string' && !(name in m)) throw new Error(`no material M.${name}: add it to materials/catalog.js, or load its file earlier (scene_sources.py)`);
    return m[name];
  },
});
M.glassBlockSolid.map = M.glassBlock.map;   // the blocks' faces, as the see-through material has them
// The Cold Storage door's leaf: M.stainlessSheet under its own name, so the plan can leave the leaf out of its cuts (DOOR_MATS).
M.coolerLeaf = M.stainlessSheet.clone();
// The Butler entry's glass, likewise: M.glass under its own name (storefrontDoor, storefront.js).
M.doorGlass = M.glass.clone();
// The Seating Area's street door (owner, 2026-11-13): a black steel leaf (the Butler entry's leaf too: owner, 2026-11-17), and wired glass in its lite: clear glass with a diamond
// mesh of wire in it, the diamonds 3" from point to point. One tile is 6" square and see-through between the wires.
M.blackDoor = new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: .55, metalness: .3 });
M.wireGlass = new THREE.MeshStandardMaterial({ map: wireGlassTex, roughness: .05, transparent: true, depthWrite: false, side: THREE.DoubleSide });
// The Butler St front is brick painted warm white (owner, 2026-11-09; site photo): the brick's relief without its colour.
M.frontPaint = new THREE.MeshStandardMaterial({ color: '#f3eee3', normalMap: M.brick.normalMap, roughness: .85 });
// The light fixtures' cords: M.steel under its own name, so they stay a separate mesh that the high-quality pass can leave out (FIXTURE_MATS).
M.cord = M.steel.clone();
// Materials one file uses each. They are here, not beside their use, so every material is in M: one table to tune, and
// tools/plan_section.js and the page's lighting can name any of them.
M.kwGrate = new THREE.MeshStandardMaterial({ color: '#9fa4a8', roughness: .4, metalness: .8, transparent: true, opacity: .75 });   // the keg washer's perforated tray
M.compressor = new THREE.MeshStandardMaterial({ color: '#565c68', roughness: .42, metalness: .32 });
M.compressorDrain = new THREE.MeshStandardMaterial({ color: '#ce4430', roughness: .55 });
M.stopPlate = new THREE.MeshStandardMaterial({ color: '#f3c516', roughness: .45 });
M.stopCap = new THREE.MeshStandardMaterial({ color: '#cb211c', roughness: .38 });
M.stopArrows = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: stopArrowsTex });
M.compressorBadge = new THREE.MeshStandardMaterial({ map: photoTex('atlas-copco.png', 1), transparent: true, roughness: .5 });
M.compressorFace = new THREE.MeshStandardMaterial({ roughness: .5, metalness: .2, map: compressorFaceTex });
M.kwPanel = new THREE.MeshStandardMaterial({ roughness: .5, map: kwPanelTex });
M.portGlass = new THREE.MeshStandardMaterial({ color: '#1d2a30', roughness: .04, metalness: .2, transparent: true, opacity: .6 });   // sight glass
M.stitch = new THREE.MeshStandardMaterial({ color: '#d9a46c', roughness: .8 });   // contrast stitching
M.rubber = new THREE.MeshStandardMaterial({ color: '#17181a', roughness: .8 });   // EPDM seats and gaskets, probe cables
M.dial = new THREE.MeshStandardMaterial({ roughness: .4, map: dialTex });
M.glySupply = new THREE.MeshStandardMaterial({ color: '#2f6fb5', roughness: .5 });   // glycol pipe: supply blue,
M.glyReturn = new THREE.MeshStandardMaterial({ color: '#c23b32', roughness: .5 });   // return red, as G&D colour them
M.bronze = new THREE.MeshStandardMaterial({ color: '#a8743a', roughness: .35, metalness: .7 });   // the glycol balancing valve's body
M.whiteDoor = new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: .45, metalness: .2 });   // the rear space's pair of doors to the Seating Area
M.blueDoor = new THREE.MeshStandardMaterial({ color: '#285e99', roughness: .6 });
M.whiteFrame = M.whiteDoor.clone();   // a white window frame: its own material, because the plan leaves M.whiteDoor (door leaves) out of its cuts
M.frp = new THREE.MeshStandardMaterial({ color: '#f3f3ee', roughness: .3 });   // fibreglass wall panel: white, wipe-clean, a little sheen
M.trackLamp = M.lamp.clone();   // the lit faces of the Seating Area's track heads, under their own name so they dim apart from the other downlights (DIMMERS, lighting.js)
// The proposed bar lighting's lit parts, under their own names so each dims apart from the fixtures it copies (DIMMERS, lighting.js):
// the globes and lit line over the angled bar, and the LED strips' tape.
M.barGlobe = M.globe.clone(); M.led = M.lamp.clone();
// Stainless reflects a photo of Lolev's real cellar (Pagnotta, tex/brewery-env.jpg) instead of the generic studio room.
// ponytail: a flat photo wrapped as a panorama, so the reflection is stretched; at the polished roughness (.15) it reads as the
// vertical streaks of brushed tank cladding. Swap in a true 360° shot if one exists.
let cellarEnv = null;   // applyLight() (lighting.js) gives it to M.tank once it has loaded
loader.load(texURL('brewery-env.jpg'), t => {
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  cellarEnv = new THREE.PMREMGenerator(renderer).fromEquirectangular(t).texture; t.dispose(); applyLight();
});

// Three tints of the Paxton's tan, so a row of stools is not one flat colour. Double-sided, as the old open backrest shell needed.
const LEATHER = ['#b4733f', '#a96a37', '#bb7c47'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .65, side: THREE.DoubleSide }));
// The four large globe lights’ colours (decorative-lights.js hangs them, lighting.js lights them), and their lit bodies.
const GLOBE_COLOURS = ['#ff9a3d', '#a646ff'];   // amber, violet
const GLOBE_MATS = GLOBE_COLOURS.map(c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.1 }));   // tinted body as well as glow, so the colour stays saturated

// bar-layout.js: Shared bar dimensions used by counters, ledges, and seating.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
const BAR = { h: 3.5, top: .13, depth: 2.583, over: 1.083, die: .33 };

// site.js: Traced-wall data and the site beneath the building shell.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
const WALLS = /*WALLS*/[{"outer":[[63.991,93.737],[64.553,94.237],[65.616,94.924],[65.991,94.987],[67.428,95.986],[71.677,96.861],[73.99,96.861],[73.99,96.049],[71.49,96.049],[67.678,95.236],[67.553,95.112],[67.24,95.049],[64.678,93.362]]},{"outer":[[43.494,86.113],[43.494,87.175],[44.431,87.175],[44.431,86.175]]},{"outer":[[38.307,86.113],[38.307,87.175],[39.182,87.175],[39.182,86.113]]},{"outer":[[61.116,84.113],[59.867,86.113],[59.867,87.175],[60.804,87.238],[61.554,90.175],[61.866,90.55],[62.491,90.112],[62.304,89.8],[61.241,85.738],[61.991,84.613]]},{"outer":[[95.861,84.051],[95.112,84.051],[95.112,85.863],[94.362,89.675],[92.112,93.112],[88.8,95.299],[84.863,96.049],[82.238,96.049],[82.238,96.861],[84.675,96.861],[89.112,96.049],[92.674,93.674],[95.049,90.05],[95.861,86.05]]},{"outer":[[54.867,84.051],[54.867,87.175],[56.492,87.175],[56.492,86.113],[55.992,86.05],[55.992,84.051]]},{"outer":[[64.991,78.301],[63.678,80.239],[64.428,80.739],[64.616,80.614],[65.803,78.864]]},{"outer":[[67.553,74.364],[67.053,75.177],[67.865,75.677],[68.365,74.927]]},{"outer":[[54.867,68.303],[54.867,70.365],[54.43,70.428],[54.43,72.677],[55.992,72.677],[55.992,68.303]]},{"outer":[[73.24,66.553],[72.24,66.553],[72.24,67.303],[70.927,69.24],[71.74,69.803],[73.24,67.553]]},{"outer":[[76.239,61.304],[76.239,62.116],[77.364,62.116],[77.364,61.304]]},{"outer":[[64.491,63.366],[64.866,63.304],[64.928,62.116],[68.428,62.116],[68.553,63.366],[68.865,63.366],[68.928,62.116],[72.177,62.116],[72.24,63.491],[73.24,63.491],[73.24,62.179],[73.552,62.116],[73.552,61.366],[64.491,61.304]]},{"outer":[[77.864,61.116],[77.864,61.866],[82.051,61.866],[82.051,61.116]]},{"outer":[[54.805,56.554],[54.805,63.116],[53.68,63.179],[53.68,63.491],[54.68,63.491],[54.867,63.616],[54.867,65.241],[55.992,65.241],[56.055,62.116],[61.116,62.116],[61.116,61.304],[59.117,61.241],[59.117,58.117],[55.867,58.117],[55.805,56.554]]},{"outer":[[94.924,55.117],[94.924,61.054],[89.612,61.116],[89.612,62.866],[90.05,62.804],[90.112,61.866],[95.049,61.866],[95.112,66.741],[90.112,66.803],[90.05,66.116],[89.612,66.116],[89.612,67.24],[95.049,67.24],[95.112,71.99],[95.861,71.99],[95.861,55.117]]},{"outer":[[55.117,49.993],[55.18,50.18],[55.617,50.18],[55.617,49.93]]},{"outer":[[30.371,49.93],[30.433,50.18],[31.183,50.18],[31.183,49.93]]},{"outer":[[31.433,48.993],[31.433,49.868],[41.932,49.868],[41.994,50.055],[42.307,50.055],[42.307,48.993]]},{"outer":[[54.242,40.369],[54.242,42.431],[56.43,42.431],[56.367,40.307]]},{"outer":[[94.987,38.182],[94.924,46.931],[95.861,46.993],[95.861,38.182]]},{"outer":[[11.686,23.872],[12.186,25.746],[16.498,25.809],[16.498,94.987],[17.185,94.987],[17.185,90.425],[17.31,87.175],[28.246,87.175],[28.246,86.113],[27.059,86.05],[27.059,80.926],[26.496,80.864],[26.496,75.177],[27.059,75.114],[27.059,70.802],[26.309,70.802],[26.309,72.552],[25.934,72.615],[25.934,86.05],[17.747,86.05],[17.747,74.989],[22.559,74.927],[22.559,74.614],[17.935,74.552],[17.685,53.617],[25.934,53.555],[25.996,55.242],[27.059,55.242],[27.121,53.555],[29.683,53.555],[29.746,63.491],[50.93,63.553],[50.993,63.179],[30.308,63.179],[30.246,53.617],[54.68,53.555],[54.805,53.68],[55.805,53.68],[55.805,50.805],[54.43,50.805],[54.367,51.368],[46.931,51.368],[46.868,51.993],[43.119,51.993],[43.056,52.43],[42.369,52.43],[42.307,52.243],[41.994,52.243],[41.932,52.43],[31.308,52.43],[31.183,52.305],[31.183,50.805],[30.433,50.805],[30.433,52.43],[29.746,52.43],[29.683,52.618],[17.623,52.618],[17.56,50.805],[17.435,50.743],[17.435,24.871],[12.998,24.871],[12.623,23.622]]},{"outer":[[94.924,20.372],[94.924,25.684],[95.861,25.684],[95.861,20.372]]},{"outer":[[7.374,7.499],[8.936,13.498],[9.874,13.248],[8.624,8.686],[8.686,8.186],[54.867,8.186],[54.93,8.624],[56.305,8.624],[56.367,8.186],[94.862,8.186],[94.924,16.998],[95.861,16.998],[95.861,7.499]]}];   // the traced wall outlines, filled in by tools/build_3d.py from data/walls.json
// ---------- site: floor, sidewalk, street ----------
// Butler St is to the south and McCandless to the east: the street and sidewalk run along those two sides only, and the site
// stops at the building's slab on the west and north (it was drawn as an island, street all round). Guessed: what is there.
prism(rect(6, 6, 130, 130), -0.6, -0.5, M.street, groups.world, false);
prism(rect(6, 6, 112, 104), -0.5, -0.15, M.walk, groups.world, false);
prism(rect(6, 6, 97, 98), -0.15, 0, M.floor, groups.world, false);


// walls.js: Building heights (WALL_H, L2, DOOR_HEAD), the shell outline, and the traced-wall builders wall() and wallRun(),
// which give each face its finish: brick, paint, the painted front, or plaster.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// ---------- walls (traced) ----------
const WALL_H = 16;
const L2 = 9 + 6.75 / 12;                              // Level 2 floor, 9'-6¾" (A-301)
const TIER = L2 - .5;                                  // underside of the Level 2 floor structure: where a wall that differs upstairs is split
const OPENING_HEAD = 8;                                // head of a cased opening, 96" (owner, 2026-11-09)
const DOOR_HEAD = 7;                                   // head of an ordinary door, 7'-0" (owner, 2026-11-10: doorways left open to the ceiling read wrong)
// Which walls are brick is a guess until we have photos: the outer shell and the old party wall (x ~55) are brick, every other partition is painted.
const SHELL = [[7.37, 7.5], [95.86, 7.5], [95.86, 86.05], [95.05, 90.05], [92.67, 93.67], [89.11, 96.05], [84.68, 96.86], [71.68, 96.86], [67.43, 95.99], [64, 93.7], [61.9, 90.5], [60.8, 87.2], [17.2, 87.18], [17.19, 94.99], [16.5, 94.99], [16.5, 25.8], [12.19, 25.75]];
const PARTY = [[55.3, 40], [55.3, 87.2]];
// And: the wall between the rear space and the Seating Area (z 61.3, with the block at its west end) is all brick on its rear-space
// side (owner, 2026-11-09). Its jambs and Seating Area side stay painted.
const REAR_FACE = (x, z) => x > 55.7 && x < 95 && z > 56 && z < 61.45;
// And: the bar room's west wall is brick on its whole east face, along the front stair and the bar room to the front wall
// (owner, 2026-11-10).
const BAR_WEST_FACE = (x, z) => x > 27 && x < 27.1 && z > 53.4 && z < 86.2;
// And: the wall over door D1, Cold Storage's rear entrance, is brick on its rear-space (east) face (owner, 2026-11-11).
const OVER_D1_FACE = (x, z) => x > 55.7 && x < 55.9 && z > 53.6 && z < 56.65;
// And: Cold Storage's north wall above the deck, its face toward the bar (owner, 2026-11-11). y is the face's centroid height:
// the wall's Level 2 tier is a separate solid from TIER up, so only it qualifies, not the face inside Cold Storage below.
const OVER_DECK_FACE = (x, z, y) => y > TIER && x > 29.6 && x < 54.5 && z > 53.5 && z < 53.62;
// The party wall where it meets the back-bar wall and runs north over Cold Storage is brick too (owner, 2026-11-11; it was sheetrock).
// But: the west wall's inside face along the restrooms and their corridor is sheetrock (owner, 2026-11-17).
const RESTROOM_WEST_FACE = (x, z) => x > 17.6 && x < 17.9 && z > 53.5 && z < 86.2;
const isBrick = (x, z, y) => !RESTROOM_WEST_FACE(x, z) && (REAR_FACE(x, z) || BAR_WEST_FACE(x, z) || OVER_D1_FACE(x, z) || OVER_DECK_FACE(x, z, y) || (segDist(x, z, ...PARTY) < 1.3 || SHELL.some((p, i) => segDist(x, z, p, SHELL[(i + 1) % SHELL.length]) < 1.25)));
// The Butler St front, from the McCandless corner round the curved bay and along the bar room to its west end: the outside face
// of the shell there is painted warm white (M.frontPaint). The other three sides stay bare brick.
const FRONT = SHELL.slice(2, 13);
/** Is a wall face at (x, z) with outward normal (nx, nz) the outside of the Butler front? */
function isFront(x, z, nx, nz) {
  let nearest = -1, best = 1.3;                         // within 1.3 ft of the front line, like isBrick's tolerance for the trace
  for (let i = 0; i + 1 < FRONT.length; i++) {
    const d = segDist(x, z, FRONT[i], FRONT[i + 1]);
    if (d < best) { best = d; nearest = i; }
  }
  if (nearest < 0) return false;
  const [ax, az] = FRONT[nearest], [bx, bz] = FRONT[nearest + 1], len2 = (bx - ax) ** 2 + (bz - az) ** 2;
  // Only along the front, not off either end of it: the east wall's last 2' before the McCandless corner is near the front's first
  // point and faces the same way, so one of its two triangles was painted and the other brick, split on the diagonal (owner, 2026-11-11).
  const t = ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / len2;
  if ((nearest === 0 && t < 0) || (nearest === FRONT.length - 2 && t > 1)) return false;
  return (nx * (bz - az) - nz * (bx - ax)) / Math.sqrt(len2) > .7;   // FRONT runs east to west, so its outside is on its left
}
// The Seating Area's walls behind the banquette are black plaster, not brick (owner, 2026-11-13): the inside face from the east
// jamb of the Butler garage door, round the curved wall and up the east wall to the closet's south wall. The closet stays white.
// BLACK is that inside face's line (as SEATING, finishes.js).
const BLACK = [[82.24, 96.05], [84.85, 96.05], [88.8, 95.3], [92.1, 93.1], [94.35, 89.7], [95.1, 85.9], [95.1, 67.25]];
const eastBay = WALLS.find(w => w.outer.some(([x, z]) => x === 82.238 && z === 96.861)).outer;
const mirrorBay = ([x, z]) => [73.99 + 82.238 - x, z];
const outerBay = eastBay.slice(9, 14).reverse().map(mirrorBay);  // north to south, from first bend to flat front
const innerBay = eastBay.slice(2, 7).map(mirrorBay);
// The rest of the room's shell wall is white plaster, like its partitions (owner, 2026-11-13: it was brick): the inside face
// from the garage door's east jamb west, over the door, round the bay and its street door to the angled wall. WHITE is its line.
const WHITE = [[82.24, 96.05], ...innerBay.slice(1).reverse(), [61.241, 85.738], [61.99, 84.61]];
const PIER_X0 = 54.867, PIER_X1 = 55.992;              // the old party wall along the bar room: bar-room face, Seating Area face
// And the column of the old party wall at the west end of the angled bar (traced x 54.43-55.99, z 68.30-72.68) is white plaster
// on its east face, the angled bar's side (owner, 2026-11-13). Its south end is a mortar-finished jamb;
// its west face and north end stay exposed brick.
/** Is a wall face at (x, z) whose normal's x is nx that column's east face? */
const isWhiteColumnFace = (x, z, nx) => nx > .5 && x > 54.3 && x < 56.1 && z > 68.2 && z < 72.8;
/** Is (x, z) on `line`? Within 0.3 ft: the jambs of the openings in these walls are further off it, and stay as they are. */
const onLine = (x, z, line) => line.some((p, i) => i + 1 < line.length && segDist(x, z, p, line[i + 1]) < .3);
/** Traced wall from y0 to y1 (the whole height unless given): each side face is brick or paint by where it stands (isBrick),
 *  the painted front (isFront), or the Seating Area's black or white plaster (BLACK, WHITE); the top is the dark cut face. */
function wall(pts, y0 = 0, y1 = WALL_H) { finishWall(prism(pts, y0, y1, M.cut)); }
/** A straight wall as one solid, for a wall with doorways in it. Built from wall() pieces (the wall either side of a doorway plus
 *  a piece over it), the pieces' hidden end faces flicker through as a dotted line up the wall where they join; one solid has no
 *  joins. `profile` is the wall's elevation outline [[s, y], ...], doorways cut into it as notches: s runs along x, or along z
 *  when alongZ. w0..w1 are its two faces on the other axis. Finished like wall(). */
function wallRun(profile, w0, w1, alongZ = false) {
  solidRun(profile, w0, w1, alongZ);
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(profile.map(([s, y]) => new THREE.Vector2(s, y))), { depth: w1 - w0, bevelEnabled: false, UVGenerator: THREE.ExtrudeGeometry.WorldUVGenerator });
  if (alongZ) { g.rotateY(-Math.PI / 2); g.translate(w1, 0, 0); } else g.translate(0, 0, w0);   // the extrusion runs along z as built; turned, it runs back from w1
  finishWall(new THREE.Mesh(g, M.cut));
}
/** Replaces a wall solid `m` with one mesh per finish: faces that look up or down are the dark cut face, the rest brick or paint. */
function finishWall(m) {
  const g = m.geometry, pos = g.attributes.position, nor = g.attributes.normal;
  const tris = { cut: [], brick: [], mortar: [], paint: [], frontPaint: [], blackPlaster: [] };
  /** Which material the triangle starting at vertex i gets. */
  function finish(i) {
    if (Math.abs(nor.getY(i)) > .5) return 'cut';
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3, y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    // The widened party-wall opening beside the angled bar: only the two cut ends are parged.
    if (x >= PIER_X0 && x <= PIER_X1 &&
        ((Math.abs(z - 72.677) < .01 && nor.getZ(i) > .99) ||
         (Math.abs(z - 84.051) < .01 && nor.getZ(i) < -.99))) return 'mortar';
    if (isFront(x, z, nor.getX(i), nor.getZ(i))) return 'frontPaint';
    if (onLine(x, z, BLACK)) return 'blackPlaster';
    if (onLine(x, z, WHITE) || isWhiteColumnFace(x, z, nor.getX(i))) return 'paint';
    return isBrick(x, z, y) ? 'brick' : 'paint';
  }
  for (let i = 0; i < pos.count; i += 3) {
    const k = finish(i);
    tris[k].push(i, i + 1, i + 2);
    // Raised heads and full-height walls must sample the same brick at the same world point.
    if (k === 'brick' || k === 'frontPaint') {
      const alongX = Math.abs(nor.getZ(i)) > Math.abs(nor.getX(i));
      for (let j = i; j < i + 3; j++) g.attributes.uv.setXY(j, alongX ? pos.getX(j) : -pos.getZ(j), 1 - pos.getY(j));
    }
  }
  m.removeFromParent();
  for (const k in tris) if (tris[k].length) { const part = g.clone(); part.setIndex(tris[k]); const mesh = new THREE.Mesh(part, M[k]); mesh.castShadow = mesh.receiveShadow = true; groups.world.add(mesh); }
}

// hinged-doors.js: Hinged doors (hingedDoor) and the DOORS list the plan draws their swings from.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
/** Every hinged door, for the plan's door swings (tools/plan_section.js reads it): `hinge` and `closed` are the leaf's two ends,
 *  shut, on the face it swings from ([x, z] ft), and `toward` is the unit direction [x, z] it opens toward. */
const DOORS = [];
/** Materials of door leaves, which the plan leaves out of its cuts (it draws each door open, from DOORS instead). */
const DOOR_MATS = [M.door, M.coolerLeaf, M.doorGlass, M.blackDoor, M.blueDoor];
/** Records a hinged door in DOORS. `head` is its leaf's top, for a door taller than the ordinary 7'-0": what starts above it does
 *  not swing with the door (hangDoors, interaction/doors.js). With `leaf`, also builds its closed leaf for a doorway that has none: a 1¾" slab in the opening,
 *  on the face it swings from (grey painted steel, like the boiler room's: a guess). Doors whose leaves are modelled with their
 *  frames (Cold Storage, the boiler room, the west pair, the Butler entry) are recorded without one. */
function hingedDoor(hinge, closed, toward, leaf = false, head = DOOR_HEAD) {
  DOORS.push({ hinge, closed, toward, head });
  if (!leaf) return;
  const back = ([x, z]) => [x - toward[0] * .15, z - toward[1] * .15];
  prism([hinge, closed, back(closed), back(hinge)], 0, DOOR_HEAD - .02, M.door);
}

// wall-trace.js: Fixes to the traced walls: walls rebuilt by hand, and the trace squared up, with the wall-face constants it yields.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// Cold Storage's west and north walls, the bar room's north wall (behind the back bar) and the stub at the top of the restroom
// passage are corners of one traced outline with the building's west side. Take them out of it here and rebuild them by hand,
// because none of them is one plain full-height wall. Done in code so re-inlining data/walls.json does not undo it.
//   - The bar room's north wall only rises to the deck that sits on it: rebuilt low in the deck section.
//   - Cold Storage's west and north walls have Level 2 doorways through them (A-101 Level 2: from the landing at the top of the
//     front stair, z 53.6-56.2, and to the room over the old Storage 7/8/9, x 39.9-45.6), so each is built in two tiers split at
//     TIER: all of it below, and what Level 2 keeps above. The upper doorway in the north wall starts at x 42, not 39.9, to clear
//     the stair that comes up on its other side.
//   - The north wall's north face runs straight at z 52.43 to the party wall, its thinnest traced depth (owner, 2026-11-09: the
//     trace stepped out to 1'-7" and 2'-2" east of x 43), and the spur at the stair's west end (x 30.4-31.2) is gone with the
//     demolished wall it belonged to (owner, 2026-11-09).
//   - The stub (x 25.9-27.1, z 53.6-55.2) is a Level 1 pier only: Level 2 is open there, between its corridor and the landing.
//   - The Men's room's north partition (x 17.75-22.56, z 74.6-75.0) is Level 1 only too: the Level 2 corridor runs over it.
// The same outline has steps in its faces that the building does not (owner, 2026-11-10; A-101 draws these walls straight):
//   - The bar room's west wall is one thickness, x 25.93-27.06, except a 7" deep, 5'-8" long recess in its bar-room face
//     (z 75.2-80.9, up to 8': owner, 2026-11-11), built with the wall below. The trace (A-01's side of the merged plan) also
//     had a 4½" one in its corridor face beside the restroom corridor's entrance (z 70.8-72.6), which is not real. It comes out
//     of the outline whole and is rebuilt below as one solid with the wall north of it.
//   - The west shell wall's inside face is straight at x 17.75 along the restrooms and at x 17.43 along the brewery. The trace
//     bowed it 2" at the Men's partition and 2" again north of the restrooms' north wall.
{
  const big = WALLS.find(w => w.outer.some(([x, z]) => x === 29.746 && z === 63.491)).outer, at = (x, z) => big.findIndex(p => p[0] === x && p[1] === z);
  const from = at(29.746, 63.491);
  big.splice(from, at(29.746, 52.43) - from + 1);                                // every corner from the back-bar wall round to the north wall's west end
  big.splice(at(25.996, 55.242), 2);                                             // the stub's two outer corners
  big.splice(at(17.747, 74.989), 4);                                             // the Men's partition's four corners, with the bow in the shell wall's face there
  big[at(17.685, 53.617)][0] = 17.747;                                           //   ... so that face runs straight to the restrooms' north wall
  big.splice(at(17.623, 52.618), 3, [17.435, 52.618]);                           // the bow north of that wall
  // The restrooms' north wall: north face straight at z 52.43, in line with Cold Storage's (owner, 2026-11-11: the trace had it
  // 2" thinner, A-101's line), and the outline stops at x 27.2: its east end is rebuilt below with a Level 2 opening in it.
  big[at(17.435, 52.618)][1] = 52.43;
  big[at(29.683, 52.618)].splice(0, 2, 27.2, 52.43);
  big[at(29.683, 53.555)][0] = 27.2;
  const west = at(27.059, 86.05);
  big.splice(west, at(25.934, 86.05) - west + 1);                                // the bar room's west wall, from the front wall to the restroom corridor's entrance
}
WALLS.push({ outer: [[54.43, 50.805], [55.805, 50.805], [55.805, 53.56], [54.43, 53.56]] });   // the pier at the north wall's east end, as traced
// Cold Storage west wall. On Level 2 it stops under the deck (owner, 2026-11-11), which runs over it to the stair; the deck's rail
// guards that edge. North of the deck is A-101's Level 2 doorway from the landing (z 53.6-56.2).
wall(rect(29.7, 53.56, 30.31, 63.55), 0, TIER); wall(rect(29.7, 56.2, 30.31, 63.55), TIER, L2 - .06);   // south to the back-bar wall's bar-room face
// The restrooms' north wall's east end, over the top of the passage stair: open on Level 2, from the landing at the top of the
// stair north into the room over the old Storage 8/9 (owner, 2026-11-11). ponytail: open to the model's 16' roof, no head.
// It stops under the doorway's floor (rooms.js), which sits on it: run up to L2, its top lay in the boards' and the two flickered.
wall(rect(27.2, 52.43, 29.7, 53.56), 0, TIER);
// The passage stair's mouth, on the back-bar wall's line, is open to the top: no head or wall over it (owner, 2026-11-11).
wall(rect(29.7, 52.43, 54.43, 53.56), 0, TIER);                                                           // Cold Storage north wall
wall(rect(29.7, 52.43, 42, 53.56), TIER); wall(rect(45.62, 52.43, 54.43, 53.56), TIER);
// The bar room's west wall, on north past the restroom corridor and the Women's room to the stub: one solid from the restrooms'
// north wall to the front wall (lapped into both), so its faces are smooth (owner, 2026-11-10). In it: the door from the Women's
// room to the service sink at the top of the stair passage (z 55.24-57.85) and the restroom corridor's entrance from the bar
// room (z 67.48-70.8), and the recess (z 75.18-80.93, notched through, its back filled below). North of z 56.19 it stops under
// the Level 2 floor: Level 2 is open there, between its corridor and the landing.
const RECESS_TOP = 8;   // the recess's head, 8' (owner, 2026-11-11)
wallRun([[53.5, 0], [55.24, 0], [55.24, DOOR_HEAD], [57.85, DOOR_HEAD], [57.85, 0], [67.48, 0], [67.48, OPENING_HEAD], [70.8, OPENING_HEAD], [70.8, 0],
  [75.18, 0], [75.18, RECESS_TOP], [80.93, RECESS_TOP], [80.93, 0], [86.1, 0], [86.1, WALL_H], [56.19, WALL_H], [56.19, TIER], [53.5, TIER]], 25.93, 27.06, true);
hingedDoor([25.93, 57.85], [25.93, 55.24], [-1, 0], true);   // Women's room to the service sink: hinged on its south jamb, opens into the Women's room (A-101)
// The trace's recess in its bar-room face (z 75.2-80.9) is real (owner, 2026-11-11): 6¾" deep, as traced, from the floor to 8',
// with the brick flush above it. Cut through the run above as a notch, and its back filled here in sheetrock (painted).
wall(rect(25.93, 75.18, 26.496, 80.93), 0, RECESS_TOP);
// The wall on the north side of the stair behind Cold Storage (x 31.4-42.3, z 49.0-49.9) was demolished on site (owner, 2026-11-09).
WALLS.splice(WALLS.findIndex(w => w.outer.some(([x, z]) => x === 31.433 && z === 48.993)), 1);
// ... and so was the wall at the stair's west end (x 30.4-31.2): a stub of its own (its spur of the big outline went above).
WALLS.splice(WALLS.findIndex(w => w.outer.some(([x, z]) => x === 30.371 && z === 49.93)), 1);
// ... and the 6" x 3" stub left at the east end of that demolished wall, against the party wall (owner, 2026-11-09).
WALLS.splice(WALLS.findIndex(w => w.outer.some(([x, z]) => x === 55.117 && z === 49.993)), 1);
// The rear space's wall to the Seating Area is traced in two pieces west of door D11: a short one (x 76.24-77.36) on the line A-01
// draws the wall on, then a 6" break where A-01 meets A-101, then A-101's piece (to x 82.05) about 2½" north of that line. It is
// one wall (owner, 2026-11-09): drop A-101's piece and run the short one east to the door on its own line.
WALLS.splice(WALLS.findIndex(w => w.outer.some(([x, z]) => x === 77.864 && z === 61.116)), 1);
for (const p of WALLS.find(w => w.outer.some(([x, z]) => x === 77.364 && z === 61.304)).outer) if (p[0] === 77.364) p[0] = 82.051;
// The old party wall's piece east of Cold Storage is traced with a 1'-2" stub of the back-bar wall on it (x 53.7-54.8, z 63.2-63.5),
// which stood full height past the end of the deck. The back-bar wall is rebuilt to the deck in the deck section, and runs to the
// party wall there.
{ const party = WALLS.find(w => w.outer.some(([x, z]) => x === 53.68 && z === 63.179)).outer; party.splice(party.findIndex(([x, z]) => x === 53.68 && z === 63.179), 3); }
// The pier between the Butler entry and the east window: the trace put its north-east corner ¾" back into the wall from the front wall's
// inside face (z 86.113, where every other jamb's corner is), so the window's sill and head walls stood proud of the pier's slanted face.
WALLS.find(w => w.outer.some(([x, z]) => x === 44.431 && z === 86.175)).outer.find(([x, z]) => x === 44.431 && z === 86.175)[1] = 86.113;
// The west shell wall stops at the Butler front: the trace ran an 8" tail of it 7'-10" on south, across the sidewalk (to z 94.99).
// ponytail: taken off as not part of this building; put the three corners back if it is a real wall on site.
{ const west = WALLS.find(w => w.outer.some(([x, z]) => x === 16.498 && z === 94.987)).outer; west.splice(west.findIndex(([x, z]) => x === 16.498 && z === 94.987), 3, [16.498, 87.175]); }
// ---------- squaring the trace up ----------
// The walls were traced by hand on a 3/4" grid, so a face that is one flat plane in the building came in pieces up to 2 1/2" out
// of line, and a pier's side a few degrees off square. The wall over or under an opening is a separate piece drawn square on
// the wall's line, so beside a traced piece that was off it, its outline showed as a seam, or the two met in a crease (owner,
// 2026-11-14). STRAIGHT lists the wall faces that are one plane, each as [a, b, tol]: every traced corner within tol (0.1 ft
// unless given) of the segment a-b is moved square onto its line. The pieces at openings below are drawn on these same lines.
// To check: no upright wall face may stand within 3" of another's plane without being on it.
const REAR_N = 61.304, REAR_S = 62.116;                // the wall between the rear space and the Seating Area: its two faces
const EAST_IN = 95.112, EAST_OUT = 95.861;             // the McCandless wall along the Seating Area: inside and outside faces
const BREW_EAST_IN = 94.924;                           // ... and its inside face along the brewery (it is thicker there)
const FRONT_IN = 86.113, FRONT_OUT = 87.175;           // the Butler front wall along the bar room
// The angled wall between the bar zone and the Seating Area: its bar-side face, from the pier at its north end (on x 72.24) to
// the pier by the bay, and its Seating Area face, parallel and the wall's 11 7/8" away (begun 5" further north, to reach the pier's east side, on x 73.24).
const ANGLED_NW = [[72.24, 67.25], [61.116, 84.113]];
const ANGLED_SE = (() => { const [[ax, az], [bx, bz]] = ANGLED_NW, L = Math.hypot(bx - ax, bz - az), T = .989; return [[ax - (bx - ax) / L * .4, az - (bz - az) / L * .4], [bx, bz]].map(([x, z]) => [x + (bz - az) / L * T, z - (bx - ax) / L * T]); })();
// The street door at the west end of the curved bay (between the wall ends either side) and the brewery's west diagonal opening:
// each one's two jamb points, on the wall's centre line, and half the wall's thickness there.
const STREET_HALF = .38;
// Reflect the east bay about the garage opening's midpoint. Keep the street door's clear width,
// centred on the corresponding diagonal facet; its frame, head and plan swing all use these jambs.
const STREET_DOOR = (() => {
  const [[ax, az], [bx, bz]] = outerBay.slice(1, 3).map(([x, z], i) => [(x + innerBay[i + 1][0]) / 2, (z + innerBay[i + 1][1]) / 2]);
  const k = Math.hypot(2.15, 3.22) / (2 * Math.hypot(bx - ax, bz - az));
  return [-k, k].map(t => [(ax + bx) / 2 + t * (bx - ax), (az + bz) / 2 + t * (bz - az)]);
})();
{
  const [inside, outside] = facesOf(STREET_DOOR, STREET_HALF, 0, 0);
  const north = WALLS.find(w => w.outer.some(([x, z]) => x === 61.554 && z === 90.175)).outer;
  north.splice(4, 4, outerBay[1], outside[0], inside[0], innerBay[1]);
  const south = WALLS.find(w => w.outer.some(([x, z]) => x === 63.991 && z === 93.737));
  south.outer = [outside[1], ...outerBay.slice(2), [73.99, 96.861], [73.99, 96.049], ...innerBay.slice(2).reverse(), inside[1]];
}
const WEST_DIAGONAL = [[9.41, 13.37], [12.15, 23.75]], WEST_HALF = .485;
/** The two faces of the wall an opening a-b is in, `half` either side of its centre line, each run on `before` past a and `after` past b. */
function facesOf([a, b], half, before, after) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  return [-half, half].map(o => [[a[0] - u[0] * before - u[1] * o, a[1] - u[1] * before + u[0] * o], [b[0] + u[0] * after - u[1] * o, b[1] + u[1] * after + u[0] * o]]);
}
/** The point of the line through a and b nearest to p. */
function foot([[ax, az], [bx, bz]], [x, z]) {
  const dx = bx - ax, dz = bz - az, t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz);
  return [ax + t * dx, az + t * dz];
}
const STRAIGHT = [
  [[59.1, REAR_N], [94.93, REAR_N], .26], [[56, REAR_S], [95.12, REAR_S], .26],   // the rear wall, east to McCandless: A-101's piece was 2 1/2" north of A-01's line; it is one wall (owner, 2026-11-09)
  [[72.24, 62.1], [72.24, 67.35]], [[73.24, 62.1], [73.24, 67.6]],                // the piers either side of the doorway at the angled wall's north end
  [[90.05, 61.8], [90.05, 66.85]], [[89.6, 62.866], [90.06, 62.866]], [[90, 66.803], [95.15, 66.803]],   // the closet's west wall, its door's north jamb, its south wall
  [[EAST_IN, 61.8], [EAST_IN, 86]],
  [[BREW_EAST_IN, 8.1], [BREW_EAST_IN, 61.4]], [[94.9, 46.931], [95.9, 46.931]],
  [[17.7, FRONT_IN], [60, FRONT_IN]], [[17.1, FRONT_OUT], [60.9, FRONT_OUT]],
  [[PIER_X1, 62], [PIER_X1, 87.2]], [[PIER_X0, 56.5], [PIER_X0, 65.3]], [[55.805, 50.8], [55.805, 58.2]],
  [[17.7, 53.56], [55.9, 53.56], .15],                                            // the south face of the restrooms' and Cold Storage's north wall, to the party wall
  ANGLED_NW, ANGLED_SE,
  ...facesOf(WEST_DIAGONAL, WEST_HALF, 6.5, 2.2).map(f => [...f, .12]),
];
// Square the truncated corner of the angled wall at its south doorway.
for (const [x, z] of [[64.616, 80.614]]) {
  const outline = WALLS.find(w => w.outer.some(c => c[0] === x && c[1] === z)).outer;
  outline.splice(outline.findIndex(c => c[0] === x && c[1] === z), 1);
}
// End the north wall at the corner and replace the detached pier up to the garage.
// One notched McCandless wall spans both jambs, so the brick above the door has no joint.
const SIDE_JAMB_N = 16.998, SIDE_JAMB_S = 20.372, GARAGE_JAMB_N = 25.684;
{
  const north = WALLS.find(w => w.outer.some(([x, z]) => x === EAST_OUT && z === SIDE_JAMB_N)).outer;
  north.splice(north.findIndex(([x, z]) => x === BREW_EAST_IN && z === SIDE_JAMB_N), 2, [EAST_OUT, 8.186]);
  WALLS.splice(WALLS.findIndex(w => w.outer.some(([x, z]) => x === EAST_OUT && z === SIDE_JAMB_S)), 1);
}
// Twelve passes: a corner where two of these faces meet is moved onto each in turn, and so ends where they cross.
for (let pass = 0; pass < 12; pass++) for (const [a, b, tol = .1] of STRAIGHT) for (const w of WALLS) for (const c of w.outer) {
  if (segDist(c[0], c[1], a, b) < tol) c.splice(0, 2, ...foot([a, b], c));
}
// Split the pier's south face at the original wall plane: the projecting brick corner was never cut.
const jambPier = WALLS.find(w => w.outer.some(([x, z]) => x === 54.43 && z === 72.677)).outer;
jambPier.splice(jambPier.findIndex(([x, z]) => x === 54.43 && z === 72.677) + 1, 0, [PIER_X0, 72.677]);
// Shift the ground-floor door six inches west of the projecting pier; the upstairs landing stays put.
const REAR_DOOR_W = 60.616, REAR_DOOR_E = 63.991;
for (const { outer } of WALLS) for (const p of outer) {
  if (p[0] === 61.116 && (p[1] === REAR_N || p[1] === REAR_S)) p[0] = REAR_DOOR_W;
}
WALLS.forEach(w => wall(w.outer));

// boiler-room.js: The boiler room in the brewery: its walls, doors and ceiling.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// ---------- boiler room (A-101, added in its revision 3; not part of the wall trace) ----------
// Against the north wall, east of the grist case, with a pair of 3'-0" doors in its east wall. A-101 draws it 9'-0" square inside;
// the owner made it 3'-0" longer to the east (2026-11-09), so it is 12'-0" east-west by 9'-0", the east wall and doors moved with it.
// It is 10'-0" tall with its own ceiling (owner), well under the brewery's 14'-0"-15'-0" joists. The boiler is in layout.js.
// Read off A-101 to about 3". Painted walls and closed 7'-0" doors are assumed.
const BOILER_H = 10;                                             // height of the room
const BOILER_EAST = 65.87 + 3, BOILER_EAST_OUT = BOILER_EAST + .63;   // inside and outside faces of the east wall
const boilerWall = (x0, z0, x1, z1, y0 = 0) => prism(rect(x0, z0, x1, z1), y0, BOILER_H, M.paint);
boilerWall(56.26, 8.19, 56.9, 17.9);                                            // west wall
boilerWall(56.9, 17.24, BOILER_EAST_OUT, 17.9);                                 // south wall
boilerWall(BOILER_EAST, 8.19, BOILER_EAST_OUT, 9.73);                           // east wall, north of the doors
boilerWall(BOILER_EAST, 15.78, BOILER_EAST_OUT, 17.24);                         // east wall, south of the doors
boilerWall(BOILER_EAST, 9.73, BOILER_EAST_OUT, 15.78, 7);                       // wall over the door head
for (const [z0, z1] of [[9.73, 12.755], [12.755, 15.78]]) prism(rect(BOILER_EAST + .23, z0, BOILER_EAST + .43, z1), 0, 7, M.door);   // the pair of doors: a piece each, so each swings on its own hinge (interaction/doors.js)
for (const z of [9.73, 15.78]) hingedDoor([BOILER_EAST, z], [BOILER_EAST, 12.755], [-1, 0]);   // ... which open in, into the boiler room (owner, 2026-11-11; A-101 swings them out)
prism(rect(56.26, 8.19, BOILER_EAST_OUT, 17.9), BOILER_H, BOILER_H + .1, M.paint);   // its ceiling

// openings.js: Interior openings, lintels and glazing: the rear space's openings, the closet, and the angled wall's ledge and bulkhead (LEDGE).
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// ---------- openings, lintels, glazing ----------
// New lintel over the widened opening south of the 1'-0" pier, and the 3' opening north of it. The brick over each is flush with
// the party wall's bar-room face (x 54.87; the pier's south half stands 5" proud of it as a pilaster, as A-101 draws it).
for (const [z0, z1] of [[72.677, 84.051], [65.241, 68.303]]) {
  prism(rect(PIER_X0 - .05, z0, PIER_X1 + .05, z1), 9, 10.2, M.steel);
  wall(rect(PIER_X0, z0, PIER_X1, z1), 10.2);
}
// Rear space (owner, 2026-11-09): its openings are 96" tall, not full height. The traced walls leave each opening as a gap up to
// WALL_H, so fill each from 8' up: the three in the wall to the Seating Area (painted, with a brick face on the rear-space side,
// like the wall), and the one in the old party wall between the column and the wall's end by the Cold Storage stair (brick).
// OPENING_HEAD is with the wall heights.
// The first opening is listed in two parts: east of x 61.63 its fill stops under the Level 2 floor, where A-101 has the doorway
// from the D11 stair's landing into the Level 2 room over the angled bar.
for (const [x0, x1, top = WALL_H] of [[REAR_DOOR_W, 61.63], [61.63, 64.491, TIER], [82.051, 89.612]]) {
  wall(rect(x0, REAR_N, x1, REAR_S), OPENING_HEAD, top);
}
wall(rect(54.43, 42.431, 55.805, 50.805), OPENING_HEAD);
// In that wall (owner, 2026-11-11), west to east:
//   - North of the free-standing unit behind the angled bar: a steel door, opening south, in to the bar side, a push bar on its
//     brewery side and a lever on its bar side. Door height (7'-0"), with wall over it to the opening's 96" head.
//   - The next opening east is a window, its sill about 6" off the floor (owner, 2026-11-11).
//   - The wide one east of that: a pair of white industrial doors with large glass lites, opening north into the brewery.
//     ponytail: lite sizes, rails and stiles are typical for this kind of door, not from a product.
wall(rect(REAR_DOOR_W, REAR_N, 64.491, REAR_S), DOOR_HEAD, OPENING_HEAD);
wall(rect(REAR_DOOR_E, REAR_N, 64.491, REAR_S), 0, DOOR_HEAD);
hingedDoor([REAR_DOOR_E, REAR_S], [REAR_DOOR_W, REAR_S], [0, 1], true);                               // hinged on the east jamb
prism(rect(61.0, 61.87, 63.6, 61.97), 3.2, 3.4, M.steel);                                // push bar, brewery side
prism(rect(60.9, REAR_S, 61.0, REAR_S + .08), 3.3, 3.45, M.steel);                                // lever, bar side
// The wall under it is painted on its Seating Area (south) side, like the wall round it, and brick on its rear side (owner, 2026-11-11).
// Its glass runs from 3" to 7'-4¾" and its frame is white (owner, 2026-11-13: the window 3" lower than it was, and white, not black).
storefront([73.552, (REAR_N + REAR_S) / 2], [76.239, (REAR_N + REAR_S) / 2], .25, OPENING_HEAD - .6, { half: (REAR_S - REAR_N) / 2, below: M.paint, frame: M.whiteFrame });
// Its frame: storefront()'s end mullions sit inside the walls, so on a window this narrow nothing would show the glass.
for (const [x0, x1, y0, y1] of [[73.55, 73.7, .25, 7.4], [76.09, 76.24, .25, 7.4], [73.55, 76.24, .25, .37]]) prism(rect(x0, 61.51, x1, 61.91), y0, y1, M.whiteFrame);
// A white liner under the wall above, jamb to jamb: the frame's head is thinner than the wall, and left that wall's dark underside showing either side of it.
prism(rect(73.552, REAR_N + .005, 76.239, REAR_S - .005), 7.7, 7.76, M.whiteFrame);
{
  const X0 = 82.05, X1 = 89.61, MEET = (X0 + X1) / 2, Z = REAR_N, H = OPENING_HEAD - .02, T = .15, S = .35;   // T: leaf thickness, S: stile
  const LITE = M.glass.clone();
  DOOR_MATS.push(M.whiteDoor, LITE);
  for (const [h, m] of [[X0, MEET], [X1, MEET]]) {
    const a = Math.min(h, m), b = Math.max(h, m);
    hingedDoor([h, Z], [m, Z], [0, -1], false, OPENING_HEAD);   // 8' leaves: their top rails start above an ordinary door's head, and stayed shut as the leaves swung
    for (const [x0, x1, y0, y1] of [[a, a + S, 0, H], [b - S, b, 0, H], [a + S, b - S, 0, 2.6], [a + S, b - S, H - .45, H]]) prism(rect(x0, Z, x1, Z + T), y0, y1, M.whiteDoor);   // stiles, kick rail, top rail
    prism(rect(a + S, Z + .06, b - S, Z + .09), 2.6, H - .45, LITE, groups.world, false);   // the lite
    // Hardware (owner, 2026-11-16, from a picture of a push bar and pull set): a long push bar across each leaf on the Seating
    // Area side, stile to stile, and a U pull on the rear side at the meeting stile, both 1" stainless tube standing 2½" off
    // the face. The pull's top mount is at the push bar's height and at its end on the meeting stile, so the
    // two bolt through the door back to back (owner, 2026-11-16). Guessed: the bar 3'-6" up, the pull 10" long, hanging below it.
    const OFF = .21, R = .04, south = Z + T, pullX = m + Math.sign(h - m) * S / 2;
    pipeRun([[a + S / 2, 3.5, south], [a + S / 2, 3.5, south + OFF], [b - S / 2, 3.5, south + OFF], [b - S / 2, 3.5, south]], R, M.stainless, groups.world);
    pipeRun([[pullX, 3.5 - .83, Z], [pullX, 3.5 - .83, Z - OFF], [pullX, 3.5, Z - OFF], [pullX, 3.5, Z]], R, M.stainless, groups.world);
  }
}
// The closet in the Seating Area's north-east corner (owner, 2026-11-13): a white door 78" tall in its west wall's opening
// (traced z 62.866-66.116, the wall x 89.612-90.05), with wall over it, flush with the traced wall's faces either side (owner,
// 2026-11-13: set 1/2" back from the face, it showed as a seam up the wall beside the door and across over it). Guessed: a
// plain slab on the Seating Area face, hinged on the north jamb and opening out into the room.
wall(rect(89.612, 62.866, 90.05, 66.116), 6.5);
hingedDoor([89.612, 62.866], [89.612, 66.116], [-1, 0]);
prism(rect(89.612, 62.886, 89.76, 66.096), 0, 6.48, M.whiteDoor);
// Angled wall between the bar zone and the Seating Area: 42" drink-rail ledge in the openings, lintel bulkhead above (A-01 note 6).
// It is the wall's own thickness, about 1', flush with the wall's faces on both sides (owner, 2026-11-09: it stood 1' proud of
// the wall on the Seating Area side). Its concrete top, like the rear drink rail's, overhangs that side by 1'-1", like the bars' tops (owner, 2026-11-12).
// It runs between the traced wall ends either side, on the wall's two faces (ANGLED_NW, ANGLED_SE).
const LEDGE = [foot(ANGLED_NW, [70.927, 69.24]), foot(ANGLED_SE, [71.74, 69.803]), foot(ANGLED_SE, [65.803, 78.864]), foot(ANGLED_NW, [64.991, 78.301])];
// The ledge, the bulkhead and the wall over it are built in two runs, stopping either side of the traced pier in the middle of the
// wall (its four corners below): run through it, their faces lay in the pier's own (the wall's faces are one plane since the
// trace was squared up) and the black bulkhead flickered across the plaster pier.
const LEDGE_RUNS = [
  [LEDGE[0], LEDGE[1], foot(ANGLED_SE, [68.365, 74.927]), foot(ANGLED_NW, [67.553, 74.364])],
  [foot(ANGLED_NW, [67.053, 75.177]), foot(ANGLED_SE, [67.865, 75.677]), LEDGE[2], LEDGE[3]]];
for (const run of LEDGE_RUNS) prism(run, 0, 3.4, M.paint);
{
  const [barNorth, seatNorth, seatSouth, barSouth] = LEDGE;   // its corners: the bar-side face's two ends, and between them the Seating Area face's
  const dx = seatSouth[0] - seatNorth[0], dz = seatSouth[1] - seatNorth[1], k = BAR.over / Math.hypot(dx, dz);
  const out = ([x, z]) => [x + dz * k, z - dx * k];           // the bars' overhang square out from the Seating Area face
  const [[, , pierSeatN, pierBarN], [pierBarS, pierSeatS]] = LEDGE_RUNS;   // the pier's corners: the top is notched round it, or its bar-side edge lay in the pier's face and flickered
  prism([barNorth, out(seatNorth), out(seatSouth), barSouth, pierBarS, pierSeatS, pierSeatN, pierBarN], 3.4, 3.55, M.concrete, groups.world, true, EDGE_CONCRETE);
}
for (const run of LEDGE_RUNS) { prism(run, 8.6, 9.6, M.steel); prism(run, 9.6, WALL_H, M.paint); }
// The two doorways through that wall, from the Seating Area to the east side of the bar, are door height too (owner, 2026-11-09):
// at its north end (between the wall's end and the pilaster on the rear wall) and at its south end (to the pier by the bay).
prism(rect(72.24, 63.491, 73.24, 66.553), OPENING_HEAD, WALL_H, M.paint);
prism([foot(ANGLED_NW, [63.678, 80.239]), foot(ANGLED_SE, [64.428, 80.739]), foot(ANGLED_SE, [61.991, 84.613]), foot(ANGLED_NW, [61.116, 84.113])], OPENING_HEAD, WALL_H, M.paint);

// storefront.js: Storefront glazing runs (storefront) and the Butler entry doors (storefrontDoor).
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
/** Storefront run from a0 to b0 (the jamb faces, on the wall's centreline): glass sill..head, black frame, mullions about every
 *  4', wall above to WALL_H. `half`: half the thickness of the wall the run is in, so the brick below and above the glass is
 *  flush with that wall's faces. `block`: a 4" glass-block infill instead (no mullions). `rail`: height of a horizontal mullion
 *  (a transom row above it). `front`: on the painted Butler front (a0 to b0 running with the street on the left): the outside
 *  half of the brick below is painted, and so are the jambs outside the glass. `infill`: no glazing: only the lintel and the wall
 *  above are drawn, and the caller fills the opening. `below`: the finish of the wall below the glass on n's side (n is a0 to b0
 *  turned a quarter turn: the outside on the front, south on a run going east); brick, or the front's paint, unless given.
 *  `frame`: the frame's material, black steel unless given. `embed`: how far the run goes into the wall at each end, 4" unless
 *  given: less where the wall turns at the jamb, as on the curved bay, so the run's end does not stand out of the turned face. */
function storefront(a0, b0, sill, head, { block = false, rail = 0, front = false, half = .47, infill = false, embed = .35, below = front ? M.frontPaint : M.brick, frame = M.steel } = {}) {
  const dx = b0[0] - a0[0], dz = b0[1] - a0[1], L0 = Math.hypot(dx, dz), u = [dx / L0, dz / L0], n = [-u[1], u[0]];
  const EMBED = embed;                                  // run 4" into the walls at both ends, so no sliver of daylight shows at the jambs
  const a = [a0[0] - u[0] * EMBED, a0[1] - u[1] * EMBED], L = L0 + 2 * EMBED;
  prism(band(a, u, n, L, -.25, .25), head, head + .35, frame);
  if (sill > 0) {                              // wall below the glass: brick on the side away from n, `below` on n's side
    prism(band(a0, u, n, L0, -half, 0), 0, sill, M.brick); prism(band(a0, u, n, L0, 0, half), 0, sill, below);
  }
  wall(band(a0, u, n, L0, -half, half), head + .35, WALL_H);   // masonry stops at the jambs; only the frame and glazing embed
  if (front) for (const p of [a0, [b0[0] - u[0] * .03, b0[1] - u[1] * .03]]) prism(band(p, u, n, .03, .06, half), sill, head, M.frontPaint).userData.fixed = true;   // jamb reveals; fixed: in a doorway they are not part of the door that swings (hangDoors, interaction/doors.js)
  if (infill) return;
  if (block) {
    // Whole blocks fit the opening, jamb to jamb and sill to head (owner, 2026-11-12): the nearest whole number of 8" blocks
    // across, then the number of rows that keeps them nearest square. The texture draws one block per NOMINAL ft, so the slab
    // gets its own UVs, counted in blocks from the first jamb and the sill, in place of prism()'s world ones.
    const NOMINAL = 2 / 3, nx = Math.round(L0 / NOMINAL), ny = Math.round((head - sill) / (L0 / nx));
    const g = prism(band(a, u, n, L, -.17, .17), sill, head, M.glassBlock, groups.world, false).geometry, P = g.attributes.position;
    for (let i = 0; i < P.count; i++) g.attributes.uv.setXY(i,
      ((P.getX(i) - a0[0]) * u[0] + (P.getZ(i) - a0[1]) * u[1]) / L0 * nx * NOMINAL, (P.getY(i) - sill) / (head - sill) * ny * NOMINAL);
    return;
  }
  prism(band(a, u, n, L, -.06, .06), sill, head, M.glass, groups.world, false);
  if (rail) prism(band(a, u, n, L, -.2, .2), rail - .075, rail + .075, frame);
  // Mullions: an end post buried in the wall at each end, and between them enough to divide the opening itself (a0 to b0, not
  // the embedded run) into k lites of equal glass width.
  const k = Math.max(1, Math.round(L / 4)), MULLION = .15, lite = (L0 - (k - 1) * MULLION) / k;
  for (let i = 0; i <= k; i++) {
    let s = EMBED + i * lite + (i - 1) * MULLION;        // a mullion: after i lites and the i - 1 mullions before it
    if (i == 0) s = 0;                                   // the end posts
    if (i == k) s = L - MULLION;
    prism(band([a[0] + u[0] * s, a[1] + u[1] * s], u, n, MULLION, -.2, .2), sill, head, frame);
  }
}
const SF_Z = (FRONT_IN + FRONT_OUT) / 2, SF_HALF = (FRONT_OUT - FRONT_IN) / 2;   // the bar room's Butler front wall: its centreline and half its thickness
// The two big windows and the glass block, sized off a street photo of the front (owner, 2026-11-09): the windows are about as
// tall as they are wide, so 10'-6" of glass from the 1'-6" sill to a 12'-0" head, three lites across with a transom rail about
// 4' below the head; the glass block's head is lower, about 8'-0". Read off the photo to about 6".
const SF_HEAD = 12, SF_RAIL = 7.8;
// Each run ends on the traced wall's own jambs (data/walls.json). Ends read off the photo stood up to 2" clear of them, which left
// each painted jamb reveal standing free in its opening, a gap behind it (owner, 2026-11-12). The entry
// is the traced opening too, 4'-3¾" between its piers: its west end was 7" inside the west pier, and the leaf 4'-8¾" (owner, 2026-11-12).
/** A Butler jamb's x, checked against the trace: throws if WALLS has no corner there in the front wall's thickness, so a
 *  re-trace that moves a jamb stops the page instead of quietly leaving the glazing off it. */
const jamb = x => {
  if (!WALLS.some(w => w.outer.some(p => p[0] === x && Math.abs(p[1] - SF_Z) < SF_HALF + .01))) throw new Error(`Butler jamb x ${x} is not a traced wall corner: re-read the jambs from data/walls.json`);
  return x;
};
/** A black aluminium storefront door under a transom (owner, 2026-11-17, from a photo of the Butler entry), in an opening of
 *  OPENING_HEAD whose lintel and wall above storefront() has drawn (`infill`): a dark frame round the opening, a transom bar at
 *  the door's 7'-0" head with clear glass over it, and a full-glass leaf in narrow stiles with a deeper bottom rail and an offset
 *  black U pull outside at the latch side and a push bar inside. Hinged at A (the jamb faces A and B on the wall's centreline), opening toward unit `out`.
 *  ponytail: the stiles' and rails' sizes are typical narrow-stile ones. */
function storefrontDoor(A, B, out) {
  const HEAD = OPENING_HEAD, L = Math.hypot(B[0] - A[0], B[1] - A[1]), u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], n = out;
  /** A piece in the opening: from s along it (from A) for `len`, between heights y0 and y1 and between o0 and o1 off the wall's
   *  centre line (+ is out). Returns the mesh. */
  const piece = (mat, s, len, y0, y1, o0, o1, shadow = true) => prism(band([A[0] + u[0] * s, A[1] + u[1] * s], u, n, len, o0, o1), y0, y1, mat, groups.world, shadow);
  const F = .15, w = L - 2 * F, TOP = DOOR_HEAD;                             // the frame's width, the leaf's width, the leaf's top
  // The frame, marked fixed so hangDoors (interaction/doors.js) leaves it standing: its jambs stand right at the leaf's ends.
  for (const s of [0, L - F]) piece(M.steel, s, F, 0, HEAD, -.22, .22).userData.fixed = true;   // jambs
  piece(M.steel, F, w, TOP, TOP + F, -.22, .22).userData.fixed = true;                           // transom bar
  piece(M.glass, F, w, TOP + F, HEAD, -.02, .02, false);                                          // transom glass, up to the lintel
  const STILE = .21, RAIL = .6;                                              // 2½" stiles and top rail, a 7" bottom rail
  for (const s of [F + .01, F + w - .01 - STILE]) piece(M.blackDoor, s, STILE, .03, TOP - .02, -.07, .07);   // the leaf: stiles
  piece(M.blackDoor, F + .01 + STILE, w - .02 - 2 * STILE, .03, RAIL, -.07, .07);                             //   bottom rail
  piece(M.blackDoor, F + .01 + STILE, w - .02 - 2 * STILE, TOP - .02 - STILE, TOP - .02, -.07, .07);         //   top rail
  piece(M.doorGlass, F + .01 + STILE, w - .02 - 2 * STILE, RAIL, TOP - .02 - STILE, -.02, .02, false);       //   and its glass
  // Black hardware like the Seating Area's double doors' (owner, 2026-11-17), 1" tube standing 2½" off the face: inside, a push
  // bar across the leaf, stile to stile, 3'-6" up; outside, a 10" U pull whose top mount is level with the bar at its latch-side
  // end, so the two bolt through the leaf back to back (owner, 2026-11-17).
  const p = (s, y, o) => [A[0] + u[0] * s + n[0] * o, y, A[1] + u[1] * s + n[1] * o], ps = F + w - .01 - STILE / 2, s0 = F + .01 + STILE / 2;
  pipeRun([p(ps, 3.5 - .83, .07), p(ps, 3.5 - .83, .28), p(ps, 3.5, .28), p(ps, 3.5, .07)], .04, M.blackDoor, groups.world);
  pipeRun([p(s0, 3.5, -.07), p(s0, 3.5, -.28), p(ps, 3.5, -.28), p(ps, 3.5, -.07)], .04, M.blackDoor, groups.world);
  const at = s => [A[0] + u[0] * s + n[0] * .07, A[1] + u[1] * s + n[1] * .07];   // a point on the leaf's outside face
  hingedDoor(at(F), at(L - F), n);
}
const ENTRY = [jamb(39.182), jamb(43.494)];
storefront([jamb(28.246), SF_Z], [jamb(38.307), SF_Z], 1.5, SF_HEAD, { rail: SF_RAIL, front: true, half: SF_HALF });
storefront([ENTRY[0], SF_Z], [ENTRY[1], SF_Z], 0, 8, { infill: true, front: true, half: SF_HALF });
storefrontDoor([ENTRY[1], SF_Z], [ENTRY[0], SF_Z], [0, 1]);   // the entry: one leaf, hinged on the east jamb, opening out to the street (A-01)
storefront([jamb(44.431), SF_Z], [jamb(54.867), SF_Z], 1.5, SF_HEAD, { rail: SF_RAIL, front: true, half: SF_HALF });
// Glass block (owner, 2026-11-09). The owner's photo of it (2026-11-12) counts 5 blocks across and 11 up: at 8" a block, 3'-4" x
// 7'-4". So it runs between the traced wall's own jambs (3'-4½" apart), and its sill is 8" so that 11 rows end at the 8'-0" head
// (which end the extra height belongs to is a guess).
storefront([jamb(56.492), SF_Z], [jamb(59.867), SF_Z], .67, 8, { block: true, front: true, half: SF_HALF });
// The opening at the west end of the curved bay, between the traced wall ends either side (9" wall): a door (owner, 2026-11-13;
// it was a window, 1'-6" to 9'-6"), from the floor to 8'-0": a black industrial steel door with one square lite of wired glass
// in a raised frame, a panic bar inside and a lever handle outside. The lite's size and place are in proportion to the owner's
// photo of the door from the street: six tenths of the leaf's width, its top a ninth of the way down the leaf. Guessed: the
// frame, the hardware's finish (stainless), hinged on the north jamb (the photo has the lever on the south side), opening out.
{
  const [A, B] = STREET_DOOR, HEAD = OPENING_HEAD;
  storefront(A, B, 0, HEAD, { front: true, half: STREET_HALF, infill: true, embed: .03 });       // the lintel, the wall above it and the painted jambs
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]), u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], n = [-u[1], u[0]];   // n: out to the street
  /** A piece in the opening: from s along it (from the north jamb) for `len`, between heights y0 and y1 and between o0 and o1 off
   *  the wall's centre line (+ is outside). */
  const piece = (mat, s, len, y0, y1, o0, o1) => prism(band([A[0] + u[0] * s, A[1] + u[1] * s], u, n, len, o0, o1), y0, y1, mat);
  const F = .15, w = L - 2 * F, TOP = HEAD - F;                              // the frame's width, the leaf's width, the leaf's top
  for (const s of [0, L - F]) piece(M.steel, s, F, 0, HEAD, -.22, .22).userData.fixed = true;   // door frame: jambs, fixed: they stand at the leaf's
  piece(M.steel, F, w, TOP, HEAD, -.22, .22);                                //   ends, and swung with it (hangDoors, interaction/doors.js); and head
  const LITE = .61 * w, S = (w - LITE) / 2, Y1 = TOP * .89, Y0 = Y1 - LITE, RIM = .1;   // the lite's size, the leaf beside it, its head and sill, its frame's width
  piece(M.blackDoor, F + .01, w - .02, .03, Y0, -.07, .07); piece(M.blackDoor, F + .01, w - .02, Y1, TOP, -.07, .07);   // the leaf below and above the lite
  for (const s of [F + .01, F + w - .01 - S]) piece(M.blackDoor, s, S, Y0, Y1, -.07, .07);                              // and beside it
  for (const [s, len, y0, y1] of [[F + S - RIM, LITE + 2 * RIM, Y0 - RIM, Y0], [F + S - RIM, LITE + 2 * RIM, Y1, Y1 + RIM], [F + S - RIM, RIM, Y0, Y1], [F + S + LITE, RIM, Y0, Y1]])
    piece(M.blackDoor, s, len, y0, y1, -.1, .1);                             // the lite's frame, standing 3/8" proud of both faces
  // The wired glass: a flat sheet with its own UVs, so the mesh's 6" tiles are square on it whichever way the wall runs.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(LITE, LITE), M.wireGlass), mid = F + w / 2, uv = glass.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * LITE * 2, uv.getY(i) * LITE * 2);
  glass.position.set(A[0] + u[0] * mid, (Y0 + Y1) / 2, A[1] + u[1] * mid); glass.rotation.y = -Math.atan2(u[1], u[0]); groups.world.add(glass);
  piece(M.stainlessSheet, F + .35, w - .7, 3.2, 3.4, -.17, -.07);                   // panic bar inside
  piece(M.stainlessSheet, F + w - .42, .16, 3.42, 3.58, .07, .11); piece(M.stainlessSheet, F + w - .75, .4, 3.47, 3.53, .11, .15);   // lever handle outside, at the latch side: its rose and its lever
  const at = s => [A[0] + u[0] * s + n[0] * .07, A[1] + u[1] * s + n[1] * .07];   // a point on the leaf's outside face
  hingedDoor(at(F), at(L - F), n);
}

// garage-doors.js: Sectional garage doors and their tracks (GARAGE_DOORS); exterior-openings.js places the two the building has.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// One sectional-door guide. Local X goes into the room, Y is up, Z runs across the opening.
// A flat back and two turned flanges form a C-channel open toward the panel; its rollers ride inside.
function sectionalTrack(x, z, yaw, side, height, bend, length) {
  const group = new THREE.Group();
  group.rotation.y = yaw; group.position.set(x, 0, z);
  groups.world.add(group);
  const half = .09, gauge = .012, width = .14;
  function strip(lo, hi, a, b) {
    const s = new THREE.Shape();
    s.moveTo(-lo, 0); s.lineTo(-lo, height - bend);
    s.absarc(bend, height - bend, bend + lo, Math.PI, Math.PI / 2, true);
    s.lineTo(length, height + lo); s.lineTo(length, height + hi);
    s.lineTo(bend, height + hi);
    s.absarc(bend, height - bend, bend + hi, Math.PI / 2, Math.PI, false);
    s.lineTo(-hi, 0); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: b - a, bevelEnabled: false, curveSegments: 8 });
    g.translate(0, 0, Math.min(side * a, side * b));
    group.add(new THREE.Mesh(g, M.steel));
  }
  strip(-half, half, width - gauge, width);
  strip(-half, -half + gauge, 0, width - gauge);
  strip(half - gauge, half, 0, width - gauge);
}

const GARAGE_DOORS = [];
function sectionalDoor(x, z, yaw, width, height, trackY, bend, nose, count, glazed) {
  const root = new THREE.Group(), panels = [], joints = [], pitch = height / count;
  root.position.set(x, 0, z); root.rotation.y = yaw;
  root.userData.hinge = true;  // keep the moving sections out of the static world merge
  groups.world.add(root);
  const half = width / 2;
  for (let i = 0; i <= count; i++) {
    const joint = new THREE.Group();
    for (const side of [-1, 1]) {
      const at = offset => [0, 0, side * (half + .035 + offset)];
      pipe(at(-.09), at(.07), .022, M.steel, joint);
      pipe(at(.04), at(.10), .078, M.door, joint);
    }
    joints.push(joint); root.add(joint);
    if (i === count) break;
    const panel = new THREE.Group();
    function piece(length, thickness, span, along, across, mat) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, thickness, span), mat);
      mesh.position.set(along, 0, across); mesh.castShadow = mat !== M.glass;
      panel.add(mesh);
    }
    // Two recessed edges make a 1/8" light grey seam when adjacent sections are flat.
    const jointLip = 1 / (16 * 12);
    const bottomLip = !glazed && i > 0 ? jointLip : 0;
    const topLip = !glazed && i < count - 1 ? jointLip : 0;
    if (bottomLip) piece(bottomLip, .15, width, (-pitch + bottomLip) / 2, 0, M.garageSeal);
    if (topLip) piece(topLip, .15, width, (pitch - topLip) / 2, 0, M.garageSeal);
    if (glazed) {
      for (const side of [-1, 1]) {
        piece(.14, .16, width, side * (pitch - .14) / 2, 0, M.stainless);
        piece(pitch - .28, .16, .28, 0, side * (half - .14), M.stainless);
      }
      piece(pitch - .28, .16, .17, 0, 0, M.stainless);
      piece(pitch - .28, .04, width - .56, 0, 0, M.glass);
    } else if (i === 3) {
      // Curb-cut door: four small framed lights in the third section from the top.
      const bay = width / 4, w = bay * .55, h = pitch * .44, rim = .09;
      // A single punched steel skin and one continuous molding per pane. In this
      // profile X runs across the leaf and Y up it; extrusion is normal to the skin.
      const outline = (path, cx, width, height) => {
        const l = cx - width / 2, r = cx + width / 2, t = height / 2;
        path.moveTo(l, -t); path.lineTo(r, -t); path.lineTo(r, t); path.lineTo(l, t); path.closePath();
        return path;
      };
      function skin(shape, depth, mat) {
        const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
        g.translate(0, 0, -depth / 2);
        g.rotateX(-Math.PI / 2); g.rotateY(-Math.PI / 2);
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = true; panel.add(mesh);
      }
      const steel = outline(new THREE.Shape(), 0, width, pitch - 2 * jointLip);
      for (let j = 0; j < 4; j++) {
        const center = -half + (j + .5) * bay;
        steel.holes.push(outline(new THREE.Path(), center, w + rim, h + rim));
        const frame = outline(new THREE.Shape(), center, w + 2 * rim, h + 2 * rim);
        frame.holes.push(outline(new THREE.Path(), center, w, h));
        skin(frame, .22, M.whiteFrame);
        piece(h, .04, w, 0, center, M.glass);
      }
      skin(steel, .16, M.garage);
    } else piece(pitch - bottomLip - topLip, .16, width, (bottomLip - topLip) / 2, 0, M.garage);
    // Mount the skin outboard of the hinge axis: adjoining edges part around the track bend,
    // then meet again on the straight track, without changing the closed door's seal.
    if (!glazed) for (const mesh of panel.children) mesh.position.y += .09;
    panels.push(panel); root.add(panel);
  }
  const upright = trackY - bend, arc = Math.PI / 2 * bend, travel = upright + arc + nose - bend;
  function pose(open) {
    for (let i = 0; i <= count; i++) {
      const s = travel * open + pitch * i, p = joints[i].position;
      if (s <= upright) p.set(0, s, 0);
      else if (s < upright + arc) {
        const angle = (s - upright) / bend;
        p.set(bend * (1 - Math.cos(angle)), upright + bend * Math.sin(angle), 0);
      } else p.set(bend + s - upright - arc, trackY, 0);
      if (!i) continue;
      const a = joints[i - 1].position, panel = panels[i - 1];
      panel.position.addVectors(a, p).multiplyScalar(.5);
      panel.rotation.z = Math.atan2(p.y - a.y, p.x - a.x);
      panel.scale.x = a.distanceTo(p) / pitch;
    }
  }
  const dx = Math.sin(yaw) * half, dz = Math.cos(yaw) * half;
  GARAGE_DOORS.push({ d: { hinge: [x - dx, z - dz], closed: [x + dx, z + dz] }, root, pose, open: 0, want: 0 });
  pose(0);
}

// exterior-openings.js: Openings in the outside walls: the Butler garage door (DG1), the McCandless windows (DG2), the west
// diagonal opening's doors, and the curb-cut garage door. Each garage door is a { } block, keeping its names out of the shared
// scope, built here rather than in garage-doors.js because moving it changes the scene's mesh order.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// DG1 on Butler: a glass sectional garage door (A-01; owner, 2026-11-09) in the straight run of the curved bay's wall. The opening
// is 96" wide and 96" tall (owner, 2026-11-13; it was the traced width, 8'-3", and 10'-0"): centred in the traced one, x 73.99-82.24
// through the wall (z 96.05 inside face to 96.86 outside), with painted jambs under a steel lintel.
// Four stainless-framed glazed sections lift onto overhead tracks as the viewer approaches.
{
  const T0 = 73.99, T1 = 82.238, X0 = (T0 + T1) / 2 - 4, X1 = X0 + 8, IN = 96.049, OUT = 96.861, MID = (IN + OUT) / 2, HEAD = OPENING_HEAD;   // T0, T1: the traced jambs
  prism(rect(T0, IN, T1, MID), HEAD + .06, WALL_H, M.paint); prism(rect(T0, MID, T1, OUT), HEAD + .06, WALL_H, M.frontPaint);   // from inside the lintel: starting at its underside, the two flickered   // white plaster inside, like the wall either side (WHITE); the painted front outside
  for (const [a, b] of [[T0, X0 + .03], [X1 - .03, T1]]) prism(rect(a, IN, b, OUT), 0, HEAD, M.frontPaint);   // painted jambs, out from the trace to the 96" opening
  prism(rect(X0 - .3, IN - .01, X1 + .3, OUT + .02), HEAD, HEAD + .12, M.steel);          // lintel, just proud of the brick
  const x0 = X0 - .17, x1 = X1 + .17, top = HEAD + .17, trackY = HEAD + 1, nose = IN - 1;
  sectionalDoor((x0 + x1) / 2, IN - .12, Math.PI / 2, x1 - x0, top, trackY, .8, IN - .12 - nose, 4, true);
  for (const [x, side] of [[x0, -1], [x1, 1]]) {
    const start = IN - .12 - nose;
    sectionalTrack(x + side * .035, IN - .12, Math.PI / 2, side, trackY, .8, start + top + .2);
    const hangerX = x + side * .17;
    prism(rect(hangerX - .025, nose - top, hangerX + .025, nose - top + .1), trackY, 11, M.steel);
  }
}
// DG2 on McCandless as two windows (owner, 2026-11-09): each about 2' tall just under the lintel (sill 8', head 10'), brick below,
// and the middle filled in with a 2' brick pier the full height of the wall.
// The McCandless (east) wall is traced x 94.92-95.86 along the brewery and 95.11-95.86 along the Seating Area.
const EAST_MID = (EAST_IN + EAST_OUT) / 2, EAST_HALF = (EAST_OUT - EAST_IN) / 2;
storefront([EAST_MID, 71.99], [EAST_MID, 77], 8, 10, { half: EAST_HALF, below: M.blackPlaster });
storefront([EAST_MID, 79], [EAST_MID, 84.051], 8, 10, { half: EAST_HALF, below: M.blackPlaster });
wall(rect(EAST_IN, 77, EAST_OUT, 79));
const MC_X = (BREW_EAST_IN + EAST_OUT) / 2, MC_HALF = (EAST_OUT - BREW_EAST_IN) / 2;   // the McCandless wall along the brewery: its centreline and half its thickness
{
  wallRun([[8.186, 0], [SIDE_JAMB_N, 0], [SIDE_JAMB_N, DOOR_HEAD], [SIDE_JAMB_S, DOOR_HEAD],
    [SIDE_JAMB_S, 0], [GARAGE_JAMB_N, 0], [GARAGE_JAMB_N, WALL_H], [8.186, WALL_H]], BREW_EAST_IN, EAST_OUT, true);
  const frame = .15, z0 = SIDE_JAMB_N + frame, z1 = SIDE_JAMB_S - frame, top = DOOR_HEAD - frame;
  for (const [a, b] of [[SIDE_JAMB_N, z0], [z1, SIDE_JAMB_S]])
    prism(rect(MC_X - .2, a, MC_X + .2, b), 0, top, M.steel).userData.fixed = true;
  prism(rect(MC_X - .2, SIDE_JAMB_N, MC_X + .2, SIDE_JAMB_S), top, DOOR_HEAD, M.steel).userData.fixed = true;
  prism(rect(MC_X - .075, z0, MC_X, z1), .02, top, M.whiteDoor);
  prism(rect(MC_X, z0, MC_X + .075, z1), .02, top, M.blueDoor);
  // Opposite sides of the same deadbolt: align the photographed cylinder and thumbturn,
  // not the centres of their different-height housings. Dimensions and mounting height are approximate.
  const lockZ = z0 + 2.75 / 12, boltY = 44 / 12, width = 3 / 12;
  for (const [side, file, height, below, depth] of [
    [1, 'schlage-keypad.jpg', width * 486 / 288, width * 110 / 288, .075],
    [-1, 'schlage-thumbturn.jpg', width * 816 / 288, width * 148 / 288, .12],
  ]) {
    const x = MC_X + side * .075, front = x + side * depth, bottom = boltY - below;
    prism(rect(Math.min(x, front), lockZ - width / 2, Math.max(x, front), lockZ + width / 2), bottom, bottom + height, M.stainlessSheet);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: photoTex(file, 1), roughness: .48 }));
    face.rotation.y = side * Math.PI / 2;
    face.position.set(front + side * .001, bottom + height / 2, lockZ);
    groups.world.add(face);
  }
  hingedDoor([MC_X - .075, z1], [MC_X - .075, z0], [-1, 0]);
  // Raised circular rose covers the photographed turn; its curved grip projects into the room.
  const hardware = new THREE.Group(), insideFace = MC_X - .075 - .12;
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(.083, .083, .016, 32), M.stainlessSheet);
  rose.rotation.z = Math.PI / 2;
  rose.position.set(insideFace - .009, boltY, lockZ);
  const profile = new THREE.Shape();
  profile.moveTo(0, -.060); profile.lineTo(-.032, -.060);
  profile.quadraticCurveTo(-.088, 0, -.032, .060);
  profile.lineTo(0, .060); profile.closePath();
  const grip = new THREE.Mesh(new THREE.ExtrudeGeometry(profile, { depth: .045, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 2 }), M.stainlessSheet);
  grip.geometry.translate(0, 0, -.0225);
  grip.position.set(insideFace - .018, boltY, lockZ);
  grip.rotation.x = Math.PI / 2;   // horizontal when locked
  const travel = 1 / 12, bolt = new THREE.Mesh(new THREE.BoxGeometry(.045, .075, travel), M.stainlessSheet);
  bolt.position.set(MC_X, boltY, z0 - travel / 2);
  hardware.add(rose, grip, bolt);
  DOORS.at(-1).lock = { hardware, unlocked: 0, pose(t) {
    grip.rotation.x = (1 + t) * Math.PI / 2;
    bolt.position.z = z0 + (t - .5) * travel;
  } };
}
storefront([MC_X, 46.931], [MC_X, 55.117], 3, 10, { half: MC_HALF, block: true });
// West diagonal opening, between the traced wall ends either side: garage-door size (about 10'-9" wide, 10'-0" tall). Its southern two
// thirds are a pair of solid industrial steel doors, 8' tall; the rest of it, north of the doors and above them, is framed in and
// sheetrocked, with FRP panels over the sheetrock inside (owner, 2026-11-10). ponytail: the doors' make and hardware (grey hollow-metal
// leaves in a dark steel frame, a push bar inside, a pull outside) and the infill's outside face (painted) are guesses.
{
  const [A, B] = WEST_DIAGONAL, HEAD = 10, DOOR = 8;
  storefront(A, B, 0, HEAD, { half: WEST_HALF, infill: true });                  // the lintel and the wall above it
  const L0 = Math.hypot(B[0] - A[0], B[1] - A[1]), u = [(B[0] - A[0]) / L0, (B[1] - A[1]) / L0], n = [-u[1], u[0]], L = L0 + .7;
  /** A piece in the opening: from s along it (from its north end, which is .35 inside the wall) for `len`, between heights y0 and y1
   *  and between o0 and o1 off its centre line (+ is outside). */
  const piece = (mat, s, len, y0, y1, o0, o1) => prism(band([A[0] + u[0] * (s - .35), A[1] + u[1] * (s - .35)], u, n, len, o0, o1), y0, y1, mat);
  const D0 = L / 3, D1 = L - .35, w = (D1 - D0 - .3) / 2;                   // the door frame's two ends along the opening; one leaf's width
  const MEET = D0 + .15 + w;                                                // where the two leaves meet
  for (const [s, len, y0] of [[0, D0, 0], [D0, L - D0, DOOR + .15]]) {      // infill north of the doors and above them: painted outside, FRP inside
    piece(M.paint, s, len, y0, HEAD, -.15, .2); piece(M.frp, s, len, y0, HEAD, -.2, -.15);
  }
  for (const s of [D0, D1 - .15]) piece(M.steel, s, .15, 0, DOOR + .15, -.22, .22);   // door frame: jambs
  piece(M.steel, D0, D1 - D0, DOOR, DOOR + .15, -.22, .22);                 //   and head
  for (const s0 of [MEET - w, MEET]) {
    piece(M.door, s0 + .01, w - .02, .03, DOOR, -.07, .07);                 // leaf: a flat slab, no glass
    piece(M.steel, s0 + .35, w - .7, 3.2, 3.4, -.17, -.07);                 // push bar inside
  }
  for (const s of [MEET - .28, MEET + .22]) piece(M.steel, s, .06, 3.2, 4.4, .07, .15);   // pulls outside, either side of where they meet
  // Both leaves open in, toward the brite tanks, hinged at the frame's jambs (owner, 2026-11-11).
  const at = s => [A[0] + u[0] * (s - .35) - n[0] * .07, A[1] + u[1] * (s - .35) - n[1] * .07];   // a point on the leaves' inside face
  const inward = [-n[0], -n[1]];
  hingedDoor(at(MEET - w), at(MEET), inward); hingedDoor(at(MEET + w), at(MEET), inward);
}
// Existing garage door (curb cut), a white steel sectional door (owner, 2026-11-09), and inside its tracks: up each jamb, round a
// 15" radius and back level under the joists, hung from them at the far end, with the torsion spring shaft over the opening.
{
  // Mount the leaf behind the jambs. Keep every roller on the straight leg when shut,
  // including the top roller just above the 12' opening; otherwise the top panel tips inward.
  const height = 12 + .12, bend = 1.25, TRACK = height + bend;
  const jambX = BREW_EAST_IN - .18, nose = bend + .12, BACK = jambX - nose - height - .2;
  const z0 = 25.684 - .17, z1 = 38.182 + .17;   // lap both jambs by 2"
  sectionalDoor(jambX, (z0 + z1) / 2, Math.PI, z1 - z0, height, TRACK, bend, nose, 6, false);
  for (const [z, side] of [[z0, 1], [z1, -1]]) {
    sectionalTrack(jambX, z - side * .035, Math.PI, side, TRACK, bend, jambX - BACK);
    const hangerZ = z - side * .17;
    prism(rect(BACK + .25, hangerZ - .025, BACK + .35, hangerZ + .025), TRACK, 14 + (z - 8.2) / 53.8 - .05, M.steel);
  }
  pipe([jambX, TRACK + .35, 25.4], [jambX, TRACK + .35, 38.3], .09, M.door, groups.world);   // torsion shaft
  for (const z of [30.5, 33.2]) {                                                  // its springs
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 2.2, 12), M.steel);
    sp.rotation.x = Math.PI / 2; sp.position.set(jambX, TRACK + .35, z); groups.world.add(sp);
  }
}
wall(rect(BREW_EAST_IN, 25.684, EAST_OUT, 38.182), 12);

// bar.js: The two bars, the bar-end counters, and the deck over the back bar.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// ---------- bars ----------
/** A bar from its plan outline: strip(o0, o1) is the piece of it between two distances back from the guest edge (o = 0)
 *  toward the staff side. Top, fluted die under the overhang, and cabinets behind the die. `top` is the top's outline,
 *  for a top that is more than the whole strip. */
function bar(strip, top = strip(0, BAR.depth)) {
  prism(top, BAR.h - BAR.top, BAR.h, M.quartz, groups.world, true, EDGE);
  prism(strip(BAR.over, BAR.over + BAR.die), 0, BAR.h - BAR.top, M.flute);
  prism(strip(BAR.over + BAR.die, BAR.depth - .1), 0, 2.9, M.cab);
}
bar((o0, o1) => band([31.78, 72.37], [1, 0], [0, -1], 18.55, o0, o1));        // straight bar, about 18'-7"
// Angled bar, on A-01's lines (read off the underlay, 2026-11-12: it had stood 3½" back from them and run 4" into the angled
// wall). Full 42" height (owner: no lowered section; accessible seating to be at tables). Its guest edge leaves the west face of
// the pier counter at A0, passes the pier's south-west corner and runs AU for 12'-7" to the angled wall, where the bar ends
// square; ANGLED_LEN adds ¾", into the wall, so no gap shows where the traced wall lies a hair off the drawing's.
const AU = [0.834, 0.552], AN = [-0.552, 0.834], A0 = [53.84, 72.37], ANGLED_LEN = 12.66;
// The brick pier at the bars' corner, from the wall trace: its west, east and south faces, and the step in its west face, north
// of which the pier is narrower (`step`'s first point is on that narrower part's face, its second on the west face).
const PIER = { w: 54.43, e: 55.992, s: 72.677, step: [[54.867, 70.365], [54.43, 70.428]] };
{
  const at = (s, o) => [A0[0] + AU[0] * s - AN[0] * o, A0[1] + AU[1] * s - AN[1] * o];   // s along the guest edge, o back from it
  const atX = (x, o) => at((x - A0[0] + AN[0] * o) / AU[0], o);                          // where the line o back from the guest edge crosses x
  // 1'-0" counter on the pier's west face (A-01), from the top of the pier south to the angled bar's guest edge: its south end
  // is cut on that edge's line, which carries on across it. Its east side is the pier's own west face, step and all, so it
  // stands tight against the brick (owner, 2026-11-12: placed from A-01's sheet, it stood ¾" off the traced pier).
  // The 3'-6" gap west of it, between the straight bar and this counter, stays open as the staff entrance.
  const [west, north] = pt(651.7, 315), southWest = pt(651.7, 369);                           // west and north: its west face's x and north end's z; southWest: that corner [x, z]
  const northEdgeToStep = [[west, north], [PIER.step[0][0], north], ...PIER.step];          // its outline from the north-west corner: east along the north end, then south down the pier's face to the step
  prism([...northEdgeToStep, atX(PIER.w, 0), southWest], 0, BAR.h - BAR.top, M.cab);
  // At the pier the bar's die and cabinets stop on its east face. Its top carries on: along the pier's south face, then north
  // up its west face as the counter's top. One piece, wrapped round the pier, so no rounded edges meet in a notch where the
  // bar's top and the counter's would butt at the pier's south-west corner (owner, 2026-11-12; the real joint there is not drawn).
  bar((o0, o1) => [atX(PIER.e, o0), at(ANGLED_LEN, o0), at(ANGLED_LEN, o1), atX(PIER.e, o1)],
    [...northEdgeToStep, [PIER.w, PIER.s], [PIER.e, PIER.s], atX(PIER.e, BAR.depth), at(ANGLED_LEN, BAR.depth), at(ANGLED_LEN, 0), southWest]);
}
prism(rect(31.56, 63.62, 44.22, 64.63), 0, 2.9, M.cab);                       // back counter on the north wall (in front of the tile)
prism(rect(31.56, 63.62, 44.22, 64.63), 2.9, 3.05, M.concrete, groups.world, true, EDGE_CONCRETE);   // its top, the rear drink rail the draft system stands on: concrete (owner, 2026-11-12)
{ // 5'-8" x 3'-0" back-bar unit behind the angled bar
  const c = [63.37, 70.18], u = [0.833, 0.553], n = [-0.553, 0.833], a = [c[0] - u[0] * 2.835 - n[0] * 1.5, c[1] - u[1] * 2.835 - n[1] * 1.5];
  prism(band(a, u, n, 5.67, 0, 3), 0, 2.9, M.cab); prism(band(a, u, n, 5.67, 0, 3), 2.9, 3.05, M.quartz, groups.world, true, EDGE);
}
// Back-bar wall: herringbone tile, the Cold Storage door and two TVs.
// Offset off the brick face (wall face is z 63.56) so the two never share a plane (z-fighting).
// Cold Storage door (D5D), moved west off the corner so a strip of wall runs past it to the pier (owner, 2026-11-09;
// A-01 puts the opening at the corner, x 50.9-54.44). DOOR = the opening in the wall; tile runs either side of it.
// The walk-in cooler stands behind the wall, so the opening shows its door set back, with about 7" of the cooler's front round
// the leaf (owner, 2026-11-11: "about 6-8""). For that the opening grew from 3'-5" x 7'-2": east, its west side (where the canopy ends) kept.
const AROUND = .58;                                                   // the cooler's front showing round the leaf, 7"
const DOOR = { x0: 47.6, x1: 47.6 + 3 + 2 * AROUND, head: 7 + AROUND };   // round a 3'-0" x 7'-0" leaf
// The tile, from A-01's north wall (x 29.7, east of the restroom-passage stair) to the party wall, is one piece with the door's
// opening cut out of it, so the herringbone runs on uniformly over the door head (owner, 2026-11-11: built as three pieces, the
// one over the door started its pattern at its own bottom edge and showed seams). Its face UVs are its elevation, in feet.
/** One solid on the back-bar wall's line, from x0 east to the party wall and from the floor up to `top`, between z0 and z1, with
 *  the door's opening cut out of it. One piece, because separate pieces show a hairline where they join. */
function backBarSlab(x0, top, z0, z1, mat) {
  const outline = [[x0, 0], [DOOR.x0, 0], [DOOR.x0, DOOR.head], [DOOR.x1, DOOR.head], [DOOR.x1, 0], [54.81, 0], [54.81, top], [x0, top]];
  solidRun(outline, z0, z1, false);
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, UVGenerator: THREE.ExtrudeGeometry.WorldUVGenerator });
  g.translate(0, 0, z0);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; groups.world.add(m); return m;
}
backBarSlab(29.7, 8.9, 63.56, 63.62, M.tile);
// The door is a walk-in cooler door, built from the owner's photo of it (2026-11-11): the cooler's stainless front, just
// behind the wall, and an overlay leaf that stands 1½" proud of it (the photo's white is protective film over the stainless), an
// aluminium tread-plate kick plate on the leaf, and polished hardware: a closer at the top centre, two strap hinges on the
// leaf's east side and a latch on its west.
// Sizes are scaled off the photo to this 3'-0" x 7'-0" leaf, so they are approximate.
{
  const L = DOOR.x0 + AROUND, R = DOOR.x1 - AROUND;   // the leaf's west and east edges
  const FRAME = 63.17, FACE = FRAME + .125;           // south faces of the cooler's front (the wall's back is z 63.18) and of the leaf
  const KICK = 1.65;                                  // top of the kick plate
  // The cooler's front, 4" thick, either side of the leaf and over it: a little bigger than the wall's opening, so no gap shows round it.
  for (const [x0, x1, y0] of [[DOOR.x0 - .1, L, 0], [R, DOOR.x1 + .1, 0], [L, R, 7]]) prism(rect(x0, FRAME - .33, x1, FRAME), y0, DOOR.head + .1, M.stainlessSheet);
  prism(rect(L, FRAME - .33, R, FACE), 0, 7, M.coolerLeaf);
  prism(rect(L, FACE, R, FACE + .012), 0, KICK, M.tread);          // on the leaf only, not the frame (owner, 2026-11-11)
  const hardware = (x0, x1, y0, y1, z0, z1) => prism(rect(x0, z0, x1, z1), y0, y1, M.stainless);   // not M.tank: on flat faces its cellar-photo reflection is blotches of colour
  const MID = (L + R) / 2;
  hardware(MID - .14, MID + .14, 7, 7.15, FRAME, FACE + .1);         // closer: its bracket on the cooler's front, over the leaf
  hardware(MID - .11, MID + .11, 6.25, 7, FACE, FACE + .1);          //   and its body down the leaf
  for (const y of [.6, 5.95]) {                                    // hinges: a strap across the leaf from a base east of it
    hardware(R - .65, R + .02, y - .12, y + .12, FACE, FACE + .05);
    hardware(R, R + .18, y - .22, y + .22, FRAME, FACE + .1);
  }
  // Latch, at 3'-3": the photo's is nearer 3'-0", where the plan's 3' cut would draw it on the shut door.
  hardware(L - .18, L, 3.1, 3.4, FRAME, FACE + .08);                 // strike, west of the leaf
  hardware(L, L + .35, 3.12, 3.38, FACE, FACE + .1);                 // latch body
  hardware(L + .25, L + 1, 3.2, 3.3, FACE + .08, FACE + .14);        // lever, toward the middle of the leaf
  hingedDoor([R, FRAME], [L, FRAME], [0, 1]);   // hinged on its east edge, opens out of Cold Storage, south through the wall's opening into the bar (owner, 2026-11-11; A-01 swings it in)
}
// Two 50" TVs (16:9: 43.6" x 24.5" screen, ½" bezel), each centred between a pair of pendants (owner, 2026-11-09; PENDANT_X:
// 32.5/36.6 and 40.7/44.8), as the site photo has them. The draft system stands on the back counter between them.
// The west (left) one shows the cans menu, the east one the draft list (owner, 2026-11-11).
for (const [x, screen] of [[34.55, M.cansScreen], [42.75, M.draftScreen]]) {
  prism(rect(x - 1.86, 63.62, x + 1.86, 63.72), 5.53, 7.66, M.steel);
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(3.63, 2.04), screen); tv.position.set(x, 6.6, 63.73); groups.world.add(tv);
}

// ---------- deck over the back bar ----------
// The canopy is the black fascia under the front edge of a deck at the Level 2 floor height (MZ.top, 9'-6¾", which the stairs
// also rise to). Its 3'-8" depth past the tile wall is estimated from a site photo (2026-11-09).
// x0..x1: from the tile wall's west end, clear of the restroom-passage stair, to the Cold Storage door, so it never runs over either.
const MZ = { x0: 29.7, x1: DOOR.x0, z0: 63.56, z1: 67.2, top: L2 };
prism(rect(MZ.x0, MZ.z0, MZ.x1, MZ.z1), MZ.top - .45, MZ.top - .06, M.steel, groups.canopy);   // black fascia band, under the deck's front edge
// The deck itself (owner's rendering): over the canopy and back over Cold Storage, which A-111 shows as existing Level 2 space.
const DECK = [[30.31, 53.6], [54.81, 53.6], [54.81, 63.55], [MZ.x1, 63.55], [MZ.x1, MZ.z1], [MZ.x0, MZ.z1], [MZ.x0, 56.2], [30.31, 56.2]];   // over Cold Storage's west wall too, south of the landing's doorway
prism(DECK, MZ.top - .06, MZ.top, M.walnut, groups.canopy);
// Structure under the deck, over Cold Storage: it stops at the back of the back-bar wall (z 63.18). Run through to the wall's
// front, its south face lay in the wall's and the two flickered above the tile (owner, 2026-11-11).
prism(rect(30.31, 53.6, 54.81, 63.18), MZ.top - .5, MZ.top - .06, M.ceil, groups.canopy, false);
/** A 3'-6" black railing at the Level 2 floor from a to b: four flat horizontal bars and posts about every 4'. */
function railing(a, b, parent = groups.canopy) {
  const H = 3.5, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]];
  const steel = (pts, y0, y1) => prism(pts, MZ.top + y0, MZ.top + y1, M.steel, parent);
  for (const y of [.9, 1.75, 2.6, H - .12]) steel(band(a, u, n, L, -.05, .05), y, y + .12);
  const posts = Math.max(1, Math.round(L / 4));
  for (let k = 0; k <= posts; k++) {
    const t = Math.min(L - .1, k * L / posts);
    steel(band([a[0] + u[0] * t, a[1] + u[1] * t], u, n, .1, -.06, .06), 0, H);
  }
}
// On the back-bar wall's line, all the way across to the party wall; it does not come out round the canopy (owner, 2026-11-11).
railing([MZ.x0, 63.37], [54.81, 63.37]);
railing([MZ.x0 + .15, 56.2], [MZ.x0 + .15, 63.37]);        // west side: back along the passage stair to the landing (owner, 2026-11-11)
// The back-bar wall, rebuilt to the underside of the deck that sits on it, either side of the door and over its head: white
// painted sheetrock where it shows, over the tile and round the door's opening (owner, 2026-11-11: the tiled wall is sheetrock, not brick).
// One solid, like the tile: as three pieces it showed a hairline up the strip above the tile at each side of the door (owner, 2026-11-11).
backBarSlab(30.308, MZ.top - .06, 63.179, 63.55, M.paint).castShadow = true;

// ---------- west end of the straight bar (A-01): end panel back to a cabinet at the north wall, closing the staff side ----------
// Over both is one concrete counter, an L in one piece as A-01 outlines it (owner, 2026-11-12: built as two tops, the join showed),
// 8" above the straight bar's top beside it, at 4'-2" (owner, 2026-11-12: first set 8" above the rear drink rail the cabinet meets
// at the wall, which was only 2⅝" above the bar; before that the cabinet's top was drawn level with the rail, the panel's level
// with the bar and in its quartz).
const CORNER_TOP = BAR.h + 8 / 12;
// The panel and the counter over it end, to the south, in line with the face of the bar's fluted front, under the bar top's
// overhang (owner, 2026-11-12: A-01 runs them out to the edge of the bar's top, 1'-1" further). In A-01's sheet points, 13.5 to the foot.
const PANEL_S = 369 - BAR.over * 13.5;
prism(ptRect(346, 295, 354, PANEL_S), 0, CORNER_TOP - .15, M.flute);
prism(ptRect(325, 250, 354, 295), 0, CORNER_TOP - .15, M.cab);
prism([pt(325, 250), pt(354, 250), pt(354, PANEL_S), pt(346, PANEL_S), pt(346, 295), pt(325, 295)], CORNER_TOP - .15, CORNER_TOP, M.concrete, groups.world, true, EDGE_CONCRETE);

// rooms.js: Existing stairs to Level 2, the Level 2 rooms, and the restrooms.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// ---------- existing stairs to Level 2 (A-101; both "INACCESSIBLE STAIR, existing to remain") ----------
// Where a walker can climb (floorAt, interaction/walking.js): each stair's run in plan, and every Level 2 floor, deck and landing.
const STAIRS = [];              // { s0, s1, w0, w1, alongZ }: rising from s0 (the ground floor) to s1 (Level 2), w0..w1 wide
const FLOORS2 = [DECK];         // plan polygons at the Level 2 height; the deck over the back bar (bar.js) is one
/** Straight stair rising from s0 to s1 along x (or along z when alongZ), w0..w1 wide on the other axis, n treads.
 *  Solid stepped mass (walnut unless mat is given) plus a black rail on the w0 side. */
function stair(s0, s1, w0, w1, n, alongZ = false, mat = M.walnut) {
  STAIRS.push({ s0, s1, w0, w1, alongZ });
  const run = (s1 - s0) / n, rise = MZ.top / n;
  const box = (a, b) => alongZ ? rect(w0, Math.min(a, b), w1, Math.max(a, b)) : rect(Math.min(a, b), w0, Math.max(a, b), w1);
  for (let i = 0; i < n; i++) { const a = s0 + run * i; prism(box(a, a + run), 0, rise * (i + 1), mat); }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, Math.hypot(s1 - s0, MZ.top), 8), M.steel);
  const mid = (s0 + s1) / 2, tilt = Math.atan2(-(s1 - s0), MZ.top);       // tilt the cylinder's y axis onto the stair's pitch
  if (alongZ) { rail.position.set(w0 + .1, MZ.top / 2 + 3, mid); rail.rotation.x = -tilt; }
  else { rail.position.set(mid, MZ.top / 2 + 3, w0 + .1); rail.rotation.z = tilt; }
  groups.world.add(rail);
}
/** Black steel warehouse stair (site photo, Lolev Beer-11.jpg), rising from s0 to s1 along x (or z when alongZ), w0..w1 wide,
 *  n treads: two sloped stringers and open plate treads, a pipe handrail on the open w0 side only (the w1 side runs along a wall),
 *  and a landing at the top (3'-0" unless given) with a picket railing on its open side and far end. landing = 0: none, the
 *  stair comes up through a Level 2 floor. */
function warehouseStair(s0, s1, w0, w1, n, alongZ = false, landing = 3) {
  STAIRS.push({ s0, s1, w0, w1, alongZ });
  const run = (s1 - s0) / n, rise = MZ.top / n, P = (s, w, y) => alongZ ? [w, y, s] : [s, y, w];
  const box = (a, b, i0, i1) => alongZ ? rect(i0, Math.min(a, b), i1, Math.max(a, b)) : rect(Math.min(a, b), i0, Math.max(a, b), i1);
  const rail = (a, b) => pipe(a, b, .045, M.steel, groups.world);
  for (let i = 0; i < n; i++) { const a = s0 + run * i; prism(box(a, a + run, w0 + .12, w1 - .12), rise * (i + 1) - .1, rise * (i + 1), M.steel); }   // open treads
  const len = Math.hypot(s1 - s0, MZ.top), d = new THREE.Vector3(...P(s1 - s0, 0, MZ.top)).normalize();
  for (const w of [w0 + .06, w1 - .06]) {                                                                                     // stringers
    const stringer = new THREE.Mesh(alongZ ? new THREE.BoxGeometry(.12, len, .75) : new THREE.BoxGeometry(.75, len, .12), M.steel);   // thin across the stair, deep in its own plane
    stringer.position.set(...P((s0 + s1) / 2, w, MZ.top / 2 - .1)); stringer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    stringer.castShadow = true; groups.world.add(stringer);
  }
  const wr = w0 + .06;                                                                                                        // open side
  rail(P(s0, wr, 3), P(s1, wr, MZ.top + 3));
  for (const t of [0, .5]) { const s = s0 + (s1 - s0) * t, y = MZ.top * t; rail(P(s, wr, y), P(s, wr, y + 3)); }      // posts
  if (!landing) return;
  // Landing: past the top tread, full width, with pickets on the open side and the far end.
  const s2 = s1 + Math.sign(s1 - s0) * landing, top = MZ.top, H = 3.5;
  prism(box(s1, s2, w0, w1), top - .15, top, M.steel); FLOORS2.push(box(s1, s2, w0, w1));
  const pickets = (a, b) => {                                                                                                 // a, b: [s, w] ends of one railing run
    rail(P(a[0], a[1], top + H), P(b[0], b[1], top + H)); rail(P(a[0], a[1], top + .3), P(b[0], b[1], top + .3));
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(L / .4));
    for (let i = 0; i <= k; i++) { const t = i / k, ps = a[0] + (b[0] - a[0]) * t, pw = a[1] + (b[1] - a[1]) * t; pipe(P(ps, pw, top), P(ps, pw, top + H), .025, M.steel, groups.world); }
  };
  pickets([s1, wr], [s2, wr]); pickets([s2, wr], [s2, w1 - .06]);
}
warehouseStair(72.63, 64.63, 58.19, 61.30, 12);     // by door D11, north of the angled bar: "UP" toward the west; against the wall behind it (its north face, z 61.30; owner, 2026-11-09)
warehouseStair(41.85, 31.2, 49.94, 52.42, 14, false, 0);   // behind Cold Storage, under the old Storage 8: bottom at the east end, rises west (owner, 2026-11-09; A-101 has no arrow, but its break line is near the east end). Comes up through the Level 2 floor
stair(66.67, 56.67, 26.96, 29.52, 12, true, M.steel);   // passage between the Women's restroom and Cold Storage: lands behind the west end of the back bar, rises north. Black, the front stair seen from the bar

// ---------- Level 2 rooms (A-101 Level 2 plan: "UNOCCUPIED SPACE, EXISTING TO REMAIN") ----------
// Two blocks of existing rooms at the Level 2 floor height, read off A-101 to about 3" (its Level 2 plan registered on the traced
// Level 1 walls):
//   west: a corridor over the restrooms (a toilet room at its north end, a closet half way), the landing at the top of the front
//         stair, the room over Cold Storage (the deck section's floor; the owner opened it to the bar room) and a room over the
//         old Storage 7/8/9, which the stair behind Cold Storage comes up into;
//   east: the room over the angled bar's zone, entered from the D11 stair's landing, with a toilet room and a closet.
// The Level 1 walls already rise past them, so this adds only the floors and the partitions Level 2 has of its own, in their own
// group: the Upstairs toggle, off in the Overview so the rooms below stay in view.
// ponytail: door leaves, plumbing fixtures and lights are left out; floors are bare timber boards (the
// joists' material) and walls painted, as guesses; and the rooms stop at the model's 16' roof, where A-301 has the west block's
// ceiling at 15'-9¼" and the east room's at about 18'-5". Add them when someone has been up there with a tape and a camera.
/** A Level 2 floor over a plan polygon: boards on top, the floor structure under them down to TIER. */
function upFloor(pts) { FLOORS2.push(pts); prism(pts, L2 - .06, L2, M.joist, groups.up); prism(pts, TIER, L2 - .06, M.ceil, groups.up, false); }
/** A painted Level 2 partition over a plan rectangle, from the Level 2 floor to the roof. */
// Floors and partitions run a little way into the walls they meet (owner, 2026-11-14): stopped on a wall's face as first read
// off the plan, they stood up to 1" short of it once the trace was squared up, a gap to see down through.
function upWall(x0, z0, x1, z1) { prism(rect(x0, z0, x1, z1), L2, WALL_H, M.paint, groups.up); }
// West block. Corridor and landing, through to the Cold Storage room's doorway (x 29.7-30.31):
upFloor([[17.7, 53.5], [30.31, 53.5], [30.31, 56.2], [29.7, 56.2], [29.7, 56.67], [25.93, 56.67], [25.93, FRONT_IN + .05], [17.7, FRONT_IN + .05]]);
upWall(17.7, 59.44, 22.5, 59.69); upWall(22.19, 53.5, 22.5, 55.19); upWall(22.19, 57.94, 22.5, 59.44);       // toilet room: door in its east wall, and a doorway across the corridor beside it
upWall(21.69, 72.06, 25.93, 72.44); upWall(21.69, 75.31, 22.06, 79.69); upWall(22.06, 79.38, 25.93, 79.69);   // closet on the east wall: door at the north end of its west wall
// A-101's "DOOR TO REMAIN LOCKED AT ALL TIMES" across the top of the front stair is gone: the stair comes up open (owner, 2026-11-10).
// Room over the old Storage 7/8/9: floor round the stair's opening (with a guard on its two open sides), the wall on its north
// edge over the brewery, a partition with a doorway, and the doorway through to the Cold Storage room.
upFloor([[17.43, 44], [54.44, 44], [54.44, 52.62], [41.85, 52.62], [41.85, 49.94], [31.2, 49.94], [31.2, 52.62], [17.43, 52.62]]);
upFloor(rect(42, 52.62, 45.62, 53.6));
upFloor(rect(27.2, 52.43, 29.683, 53.6));   // and the opening from the passage stair's landing (owner, 2026-11-11)
railing([31.2, 49.84], [41.95, 49.84], groups.up); railing([41.95, 49.84], [41.95, 52.6], groups.up);
prism(rect(17.43, 43.5, 54.44, 44), TIER, WALL_H, M.paint, groups.up);
upWall(26.85, 44, 27.2, 46.12); upWall(26.85, 48.81, 27.2, 52.62);
wall(rect(PIER_X0, 53.5, 55.805, 56.6), DOOR_HEAD);     // party wall: solid over door D1 at Cold Storage's north-east corner, and on up through Level 2 (lapped into the wall either side)
hingedDoor([55.805, 53.63], [55.805, 56.6], [1, 0], true);   // D1 itself: hinged on its north jamb, opens out into the rear space (owner, 2026-11-11; no drawing shows its swing)
// East block: floor out to the angled wall's west face, and in the doorway from the D11 stair's landing.
upFloor([[PIER_X1 - .05, 62.12], [72.24, 62.12], [72.24, 67.3], [59.87, FRONT_IN + .05], [PIER_X1 - .05, FRONT_IN + .05]]);
upFloor(rect(61.63, 61.31, 64.49, 62.12));
upWall(66.31, 62.12, 66.69, 63.56); upWall(66.31, 66.5, 66.69, 67.31); upWall(66.31, 67.31, 72.24, 67.56);    // toilet room in the north-east corner
upWall(PIER_X1 - .05, 84, 57.06, 84.38); upWall(59.88, 84, 61.2, 84.38);                                              // closet at the south tip

// ---------- restrooms (A-101 layout; Studio Huana's A-01 draws only the outer walls) ----------
// Positions are A-01 sheet points read off the 2022 plan, converted to feet like the traced walls.
// These partitions are outlines on A-101, so the wall trace (data/walls.json) does not contain them.
// The Women's room's east wall is the bar room's west wall (walls section). Its south wall and the Men's room's north partition
// are Level 1 only (the Level 2 corridor runs over them), each one solid from the shell wall to that wall, lapped into both,
// with its door to the restroom corridor at the east end. The Women's south wall stops ½" short of the corridor entrance's
// jamb (z 67.48), so the two faces do not share a plane.
wallRun([[17.7, 0], [22.3, 0], [22.3, DOOR_HEAD], [25.56, DOOR_HEAD], [25.56, 0], [25.98, 0], [25.98, TIER], [17.7, TIER]], 67.07, 67.44);
wallRun([[17.7, 0], [22.56, 0], [22.56, DOOR_HEAD], [25.98, DOOR_HEAD], [25.98, TIER], [17.7, TIER]], 74.58, 74.96);
// Their doors (A-101): both hinged at the east end, the Women's opening north into the room, the Men's north into the corridor.
hingedDoor([25.56, 67.07], [22.3, 67.07], [0, -1], true);
hingedDoor([25.98, 74.58], [22.56, 74.58], [0, -1], true);
for (const r of [[165, 181, 230.5, 185], [165, 221, 230.5, 223], [165, 483.75, 232.5, 485]]) prism(ptRect(...r), .9, 6, M.partition);   // stall partitions: 2 Women's, 1 Men's
const WX = 17.8;                                      // inner face of the restroom west wall, where every fixture hangs
const ellipse = (cx, cz, rx, rz, k = 20) => Array.from({ length: k }, (_, i) => [cx + rx * Math.cos(i / k * 6.283), cz + rz * Math.sin(i / k * 6.283)]);
function toilet(z) {                                  // tank on the west wall, bowl toward the east
  prism(rect(WX, z - .8, WX + .55, z + .8), 1.35, 2.55, M.porcelain);
  prism(ellipse(WX + 1.35, z, .75, .55), 0, 1.3, M.porcelain);
  prism(ellipse(WX + 1.4, z, .82, .62), 1.3, 1.38, M.porcelain);
}
function lav(z) {                                     // wall-hung sink, faucet and a mirror above
  prism(rect(WX, z - .8, WX + 1.5, z + .8), 2.5, 2.85, M.porcelain);
  prism(rect(WX + .1, z - .06, WX + .35, z + .06), 2.85, 3.15, M.steel);
  prism(rect(WX, z - .9, WX + .03, z + .9), 3.6, 6.2, M.mirror, groups.world, false);
}
const grab = (z0, z1) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, z1 - z0, 8), M.steel); b.rotation.x = Math.PI / 2; b.position.set(WX + .15, 2.75, (z0 + z1) / 2); groups.world.add(b); };
toilet(54.67); toilet(59.85); lav(64.2); grab(53.8, 56.9);         // Women's: two stalls, one sink
toilet(84.3); lav(76.52); grab(82.3, 85.4);                        // Men's: accessible stall, sink
prism(rect(WX, 79.0, WX + 1.1, 80.2), 1.4, 3.6, M.porcelain);      //   ... and the urinal
prism(ptRect(295, 112.5, 317.5, 132.5), 0, .9, M.porcelain);       // existing service sink at the top of the stair passage

// furniture.js: Stool prototypes, loose seating, high-tops, drink rails, and the couch.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// ---------- furniture ----------
/** Solid of revolution from a profile [[radius, y], ...] listed bottom to top; used for pads and tops with eased edges. */
const turned = (profile, mat, sides = 28) => new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), sides), mat);
// The stool (owner, 2026-11-12, from a photo of the actual one): a thin scooped bucket shell in tan leather on a black steel sled
// base. Built light, about 1,200 triangles: the stool it replaces, modelled from the Paxton's product photos (Poly & Bark, owner
// 2026-11-09), was 17,000, and there are 63 seats. Inches, for the 24" stool; z from the middle of the footprint, +z to the back.
/** The shell's side edge from the seat's front to the back's top, as rows [z, y, half the width there, bow]. z and y are the top
 *  line of the Paxton's side photo (26 px to the inch, checked against its listed 24" seat and 19.75" depth). The half widths are
 *  its back photo's at the seat (17" listed), narrowing to the top by the new photo's front view. `bow`: how far the middle of the
 *  shell sits off the line between its two edges, down in the seat and back in the back; 2" in the back is the Paxton trace, the
 *  seat's scoop is judged from the new photo. The two rows at each end are close together and narrower: they round the shell's
 *  four corners, to a radius of about 1¼". */
const STOOL_SHELL = [[-8.65, 26.3, 7.05, 0], [-8.35, 26.5, 7.9, .1], [-7.6, 26.9, 8.25, .4], [-4.4, 27.23, 8.25, 1], [-1.3, 27.27, 8.3, 1.2],
  [1.5, 27.42, 8.4, 1.3], [3.3, 27.69, 8.5, 1.5], [4.6, 28.19, 8.54, 1.7], [5.3, 28.81, 8.5, 1.9], [5.97, 29.81, 8.4, 2], [6.43, 31.15, 8.15, 2],
  [6.85, 32.7, 7.8, 1.9], [7.23, 34.19, 7.4, 1.5], [7.72, 35, 6.75, 1], [7.9, 35.3, 5.8, .8]];
/** Seat prototype facing -z (backrest toward +z). The shell is one sheet 1" thick: a grid of points, a row for each row of
 *  STOOL_SHELL and seven across, a top face and an underside joined round the edge, all smooth-shaded so the edge reads as a soft
 *  roll. A stitched seam runs across the back. Base: each side one black steel rod bent into a loop
 *  (a rail under the seat, the front leg, a runner along the floor, the back leg), the legs splayed a little; a footrest bar
 *  between the front legs and a higher bar between the back ones. The base's sizes are judged by eye from the photo.
 *  seatH = seat height in ft (the 42" bars take 2.5; the shell is lifted and the legs lengthened); mat = its leather. */
function stool(seatH, mat) {
  const g = new THREE.Group(), IN = 1 / 12, lift = seatH / IN - 24, T = 1;   // T: the shell's thickness
  const V = [-1, -.85, -.5, 0, .5, .85, 1], n = STOOL_SHELL.length, w = V.length;   // across the width, as fractions of the half width
  const pos = [], idx = [], id = (under, i, j) => (under * n + i) * w + j, quad = (a, b, c, d) => idx.push(a, b, c, c, b, d);
  for (const under of [0, 1]) STOOL_SHELL.forEach(([z, y, half, bow], i) => {
    const a = STOOL_SHELL[Math.max(i - 1, 0)], b = STOOL_SHELL[Math.min(i + 1, n - 1)], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tz = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len;                 // the direction along the edge here, toward the back's top
    for (const v of V) {
      const out = bow * (1 - v * v) + under * T;                              // square off the edge line: down under the seat, back behind the back
      pos.push(v * half * IN, (y - tz * out + lift) * IN, (z + ty * out) * IN);
    }
  });
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < w - 1; j++) {
      quad(id(0, i, j), id(0, i + 1, j), id(0, i, j + 1), id(0, i + 1, j + 1));   // top face
      quad(id(1, i, j), id(1, i, j + 1), id(1, i + 1, j), id(1, i + 1, j + 1));   // underside
    }
    quad(id(0, i, 0), id(1, i, 0), id(0, i + 1, 0), id(1, i + 1, 0));             // the two side edges
    quad(id(0, i, w - 1), id(0, i + 1, w - 1), id(1, i, w - 1), id(1, i + 1, w - 1));
  }
  for (let j = 0; j < w - 1; j++) {
    quad(id(0, 0, j), id(0, 0, j + 1), id(1, 0, j), id(1, 0, j + 1));             // the front edge
    quad(id(0, n - 1, j), id(1, n - 1, j), id(0, n - 1, j + 1), id(1, n - 1, j + 1));   // the back's top edge
  }
  const shell = new THREE.BufferGeometry(); shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); shell.setIndex(idx);
  shell.computeVertexNormals(); g.add(new THREE.Mesh(shell, mat));
  // The seam: along the tenth row, 2½" above the seat at the sides. It dips in the middle, as in the photo, because the shell does.
  const seam = new THREE.CatmullRomCurve3(V.map((v, j) => new THREE.Vector3().fromArray(pos, 3 * id(0, 9, j))), false, 'catmullrom', 0);   // tension 0: straight from point to point, along the shell's own edges; a curve sank into it in places
  g.add(new THREE.Mesh(new THREE.TubeGeometry(seam, 16, .05 * IN, 3), M.stitch));
  // Base: ½" rod, six-sided. Tops 14.4" apart under the seat, runners 17" apart on the floor; front feet 1½" ahead of the tops, back feet 4" behind.
  const r = .25 * IN, legs = [];
  for (const sx of [-1, 1]) {
    const frontTop = [sx * 7.2 * IN, (25.55 + lift) * IN, -6.8 * IN], frontFoot = [sx * 8.5 * IN, r, -8.3 * IN];
    const backTop = [sx * 7.2 * IN, (26 + lift) * IN, 3.6 * IN], backFoot = [sx * 8.5 * IN, r, 7.5 * IN];
    const mid = frontTop.map((v, i) => (v + backTop[i]) / 2);                   // the loop starts and ends in the middle of the rail
    pipeRun([mid, frontTop, frontFoot, backFoot, backTop, mid], r, M.steel, g, 1.2 * IN, 6);
    legs.push([frontTop, frontFoot], [backTop, backFoot]);
  }
  if (seatH >= 2) {                                                             // the bars, on a stool; a chair-height seat has none
    const at = ([a, b], y) => a.map((v, i) => v + (b[i] - v) * (a[1] - y) / (a[1] - b[1]));   // the point on a leg at height y
    const [fl, bl, fr, br] = legs;
    pipe(at(fl, .38 * seatH), at(fr, .38 * seatH), r, M.steel, g, 6);           // footrest
    pipe(at(bl, .55 * seatH), at(br, .55 * seatH), r, M.steel, g, 6);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
const BARSTOOL = LEATHER.map(m => stool(2.5, m)), CHAIR = LEATHER.map(m => stool(1.5, m));   // one prototype per tint
/** Place a seat at (x,z) facing direction f = [fx, fz]. Tints rotate, and each seat sits an inch or two and a few degrees off, the way real ones are left. */
let seatN = 0;
function seat(protos, x, z, f, y = 0) {
  const s = protos[seatN++ % protos.length].clone();
  s.position.set(x + (rnd() - .5) * .16, y, z + (rnd() - .5) * .16); s.rotation.y = Math.atan2(-f[0], -f[1]) + (rnd() - .5) * .24;
  groups.furn.add(s);
}
for (let x = 32.6; x <= 49.6; x += 2.12) seat(BARSTOOL, x, 73.3, [0, -1]);
for (const s of [2.0, 4.1, 6.2]) seat(BARSTOOL, A0[0] + AU[0] * s + AN[0] * .95, A0[1] + AU[1] * s + AN[1] * .95, [-AN[0], -AN[1]]);
for (const s of [8.4, 10.5]) seat(BARSTOOL, A0[0] + AU[0] * s + AN[0] * .95, A0[1] + AU[1] * s + AN[1] * .95, [-AN[0], -AN[1]]);
/** A 30" round high-top at (x,z) with n stools evenly round it, the first at angle a0. */
function hightop(x, z, n = 3, a0 = .5) {
  const top = turned([[0, -.06], [1.21, -.06], [1.25, -.02], [1.25, .02], [1.21, .06], [0, .06]], M.walnut); top.position.set(x, 3.5, z);
  const uv = top.geometry.attributes.uv, P = top.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i), P.getZ(i));   // the grain runs straight across the top, in feet; a lathe's own UVs would wind it round the rim
  rnd();   // one unused draw, left from when most tables had pints on them (owner, 2026-11-12: removed): without it every stool after this table lands and turns differently
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 3.4, 10), M.steel); post.position.set(x, 1.7, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .06, 24), M.steel); base.position.set(x, .03, z);
  [top, post, base].forEach(m => { m.castShadow = true; groups.furn.add(m); });
  for (let k = 0; k < n; k++) { const a = k * 2 * Math.PI / n + a0; seat(BARSTOOL, x + Math.cos(a) * 1.9, z + Math.sin(a) * 1.9, [-Math.cos(a), -Math.sin(a)]); }
}
for (const x of [33.5, 38.5, 43.5]) seat(CHAIR, x, 62.0, [0, 1], MZ.top);   // on the deck behind the rail on the back-bar wall, facing the room
// Bar room (owner, 2026-11-09): four high-tops with four stools each, two under each Butler window, clear of the door between
// them. The stools sit on the diagonals, so the two on the window side stop short of the brick below the sill.
[30.2, 35.2, 46.75, 51.75].forEach(x => hightop(x, 83.5, 4, Math.PI / 4));
/** A standing drink rail centred at (x,z), its length north-south: a 2' x 8' walnut top at the bars' 42", on a black steel frame
 *  (four 2" legs, an apron under the top, a footrail along each side), with n stools, half on each side at 2' centres, facing it.
 *  The top's size and the stools are the owner's (2026-11-13); the frame is a guess, to go with the stools' bases. */
function rail(x, z, n = 8) {
  const W = 1, L = 4, LEG = 1 / 12, LX = W - .25, LZ = L - .4, FOOT = .95;   // half width, half length, half a leg, the legs' centres, the footrails' height (the stools' footrests')
  prism(rect(x - W, z - L, x + W, z + L), 3.44, 3.56, M.walnut, groups.furn);
  prism(rect(x - LX, z - LZ, x + LX, z + LZ), 3.28, 3.44, M.steel, groups.furn);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) prism(rect(x + sx * LX - LEG, z + sz * LZ - LEG, x + sx * LX + LEG, z + sz * LZ + LEG), 0, 3.28, M.steel, groups.furn);
    pipe([x + sx * LX, FOOT, z - LZ], [x + sx * LX, FOOT, z + LZ], .06, M.steel);
    for (let k = 0; k < n / 2; k++) seat(BARSTOOL, x + sx * (W + .65), z + (k - (n / 2 - 1) / 2) * 2, [-sx, 0]);
  }
}
// Seating Area (owner, 2026-11-13): four drink rails with eight stools each, in two columns of two, 3' between their stools each
// way, as far west and north as leaves 3' behind the ledge's stools and 4' at the north wall, so they stand clear of the curved
// wall and the bay end is free for the couch. They replace ten guessed high-tops.
for (const x of [78.7, 86.5]) for (const z of [71, 82]) rail(x, z);
hightop(68.5, 87.5, 4, Math.PI / 4);   // one round high-top like the bar room's, in the south-west of the room (owner, 2026-11-13)
// A couch in front of the Butler garage door, facing it (owner, 2026-11-13: it first had its back to the glass), centred on the
// opening and 3' off it: 7' x 3', a plain block of a seat, a back and two arms. Its size, shape and charcoal fabric are guesses.
{
  const X = 78.1, Z0 = 90, Z1 = 93, H = 3.5;   // the opening's middle, the couch's back and front, half its length
  for (const [x0, z0, x1, z1, top] of [[X - H + .6, Z0 + .7, X + H - .6, Z1, 1.4], [X - H, Z0, X + H, Z0 + .7, 2.67], [X - H, Z0 + .7, X - H + .6, Z1, 2.1], [X + H - .6, Z0 + .7, X + H, Z1, 2.1]])   // seat, back, two arms: side by side, none inside another
    prism(rect(x0, z0, x1, z1), .25, top, M.couch, groups.furn, true, .08);
}
// Five stools at the angled wall's concrete ledge, on its Seating Area side (owner, 2026-11-13), at 2' centres about its middle
// and as far off the top's edge as the bars' stools are.
{
  const [, a, b] = LEDGE, len = Math.hypot(b[0] - a[0], b[1] - a[1]);   // the ledge's Seating Area face, north to south
  const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], out = [u[1], -u[0]], off = BAR.over + .95;
  for (let k = -2; k <= 2; k++) seat(BARSTOOL, a[0] + u[0] * (len / 2 + k * 2) + out[0] * off, a[1] + u[1] * (len / 2 + k * 2) + out[1] * off, [-out[0], -out[1]]);
}

// banquette.js: The Seating Area’s built-in cushions, backrest, and base.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// The built-in banquette along the Seating Area's east wall (owner, 2026-11-13: its front edge is a line sketched on the plan, its
// look from two photos of the one there now). The backrest hugs the walls (owner, 2026-11-13): along the south wall of the
// north-east closet, round that corner on a 2' radius as in the photo, down the east wall and round the curved wall to the bay
// wall beside the garage door. The seat fills everything between the back and the sketched front edge, so it is about 3' deep
// along the east wall and round the curved wall, as in the photo of that end.
// A black base, vinyl seat cushions to 18", and a back 5" thick of vertical channels 5" wide, to 3'-2", rolled over at the top: sizes judged from the photos.
{
  /** One smooth curve through the points `via`, as points [x, z], `perFoot` of them to the foot. */
  const smooth = (via, perFoot = 12) => {
    const curve = new THREE.CatmullRomCurve3(via.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    return curve.getSpacedPoints(Math.round(curve.getLength() * perFoot)).map(p => [p.x, p.z]);
  };
  // The front edge, north to south: the end at the closet wall, the inside corner, the straight run, round the curved wall at the
  // same depth (about 3'-4"), and the end, square to the bay wall. It stepped out at the south end, to 4'-4" deep, and the
  // cushion's corner stuck out into the room (owner, 2026-11-16, with a photo of that end: one even sweep to the end wall). Smooth (owner, 2026-11-13: drawn from point to point it showed as flat faces with sharp edges between).
  const FRONT = smooth([[89.9, 67.25], [89.9, 68.4], [89.95, 69.2], [90.3, 69.65], [90.9, 69.8], [91.5, 70.2], [91.85, 70.8], [92, 71.6], [92, 75], [92, 79],
    [92, 83], [91.9, 84.6], [91.6, 86.4], [91.15, 88.1], [90.5, 89.5], [89.8, 90.5], [89, 91.2], [88.4, 91.75], [88.15, 92.3], [88.1, 93.2], [88.1, 95.43]]);
  // The walls behind it, south to north and back west along the closet: the room's traced inside faces, 0.1' into the wall.
  const WALL = [[88.1, 95.53], [88.85, 95.4], [92.2, 93.2], [94.45, 89.75], [95.2, 85.9], [95.2, 67.15], [89.9, 67.15]];
  // The line the back follows, north to south: the walls' faces, the closet corner rounded on a 2' radius, and the curved wall's
  // flat lengths eased into one curve through their ends and middles.
  const corner = [1, 2, 3, 4, 5].map(k => [93.1 + 2 * Math.sin(k * Math.PI / 12), 69.25 - 2 * Math.cos(k * Math.PI / 12)]);
  const BACK = smooth([[89.9, 67.25], [91.5, 67.25], [93.1, 67.25], ...corner, [95.1, 69.25], [95.1, 72], [95.1, 78], [95.1, 84], [95.1, 85.9], [94.72, 87.8],
    [94.35, 89.7], [93.22, 91.4], [92.1, 93.1], [90.45, 94.2], [88.8, 95.3], [88.1, 95.43]], 24);
  /** `line` with its i-th point moved d(i) ft to one side (side 1: left of its direction, -1: right). */
  const offset = (line, side, d) => line.map(([x, z], i) => {
    const a = line[Math.max(i - 1, 0)], b = line[Math.min(i + 1, line.length - 1)], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [x + side * (b[1] - a[1]) / len * d(i), z - side * (b[0] - a[0]) / len * d(i)];
  });
  // Built as the photo of the corner shows it (owner, 2026-11-14): a black base 10" high, set 4" back under the cushions; the seat
  // in separate cushions 8" thick with fully rounded edges; behind the back a black board on the wall, which shows at the ends and
  // fills the rounded corner; and the back, one pad the whole way round (below).
  // The joints between sections, north to south, each from a point on the front edge to one on the back's line: three across the
  // straight run and one across the curve, which makes five cushions (owner, 2026-11-16: five sections): the corner, three of
  // 5'-0" along the straight run, and the south end; the corner is one cushion (owner, 2026-11-16: no diagonal joint in it),
  // and so is the south end from that last joint on (owner, 2026-11-16: the joint that cut a short section off the end is gone).
  // Guessed: every joint.
  const JOINTS = [...[71.6, 76.63, 81.67].map(z => [[92, z], [95.1, z]]), [[91.55, 86.7], [94.72, 87.8]]];
  /** Which of `line`'s points is nearest p. */
  const near = (line, [x, z]) => line.reduce((best, q, i) => Math.hypot(q[0] - x, q[1] - z) < Math.hypot(line[best][0] - x, line[best][1] - z) ? i : best, 0);
  /** `pts` without any point that repeats the one before it: the front edge and the back's line meet at both ends. */
  const distinct = pts => pts.filter((q, i) => !i || Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) > 1e-4);
  const CHANNEL = 10;   // points of BACK to one channel of the back: 5" (owner, 2026-11-16, against the photo: 4" was too narrow)
  // Each section's ends as places along FRONT and along BACK; on BACK a joint falls on a channel's seam.
  const ends = [[0, 0], ...JOINTS.map(([f, b]) => [near(FRONT, f), Math.round(near(BACK, b) / CHANNEL) * CHANNEL]), [FRONT.length - 1, BACK.length - 1]];
  const board = offset(BACK, -1, () => .1);
  prism([...offset(FRONT, 1, () => .33), ...WALL], 0, .85, M.steel, groups.furn);
  prism([...board, ...WALL], .85, 3.1, M.steel, groups.furn);
  // The back is one pad the whole way round, corner and all, with a rolled top: each channel's front runs up and over in a half
  // round to the wall, so the top has the channels' shape too (owner, 2026-11-16, from a photo of the corner: it was cut into the
  // seat's sections and stopped at a flat, square-edged top). 5" thick; it starts 2" down behind the seat cushions.
  // Swept by hand: prism()'s rounded edge cannot be cut into a strip this thin. Each point of BACK gets the pad's profile, from
  // the foot of its front face up and over the roll; `out` is how far off the back's line, toward the room.
  {
    const TOP = 3.2, FOOT = 1.3, ARC = 8, K = ARC + 2, toRoom = offset(BACK, -1, () => 1).map(([x, z], i) => [x - BACK[i][0], z - BACK[i][1]]);
    const pos = [], idx = [];
    const profile = i => {
      // Each end is rounded off in plan (owner, 2026-11-16: it was cut square): over the last 5" the pad thins to the wall on a quarter round.
      const fromEnd = Math.min(i, BACK.length - 1 - i) / 24, end = Math.sqrt(1 - (1 - Math.min(1, fromEnd / .42)) ** 2);   // 24 points of BACK to the foot
      const front = .1 + (.4 + .06 * Math.abs(Math.sin(Math.PI * i / CHANNEL))) * Math.max(end, .05), r = (front - .1) / 2;   // the channel's bulge; the roll's radius
      return [[front, FOOT], ...Array.from({ length: ARC + 1 }, (_, k) => [.1 + r + r * Math.cos(Math.PI * k / ARC), TOP - r + r * Math.sin(Math.PI * k / ARC)])];
    };
    const put = (i, [out, y]) => pos.push(BACK[i][0] + toRoom[i][0] * out, y, BACK[i][1] + toRoom[i][1] * out);
    BACK.forEach((_, i) => profile(i).forEach(q => put(i, q)));
    for (let i = 0; i + 1 < BACK.length; i++) for (let k = 0; k + 1 < K; k++) {
      const a = i * K + k, b = a + K;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    for (const [i, flip] of [[0, false], [BACK.length - 1, true]]) {                 // the two ends: flat, in the profile's shape
      const first = pos.length / 3;
      [[.1, FOOT], ...profile(i)].forEach(q => put(i, q));
      for (let k = 1; k < K; k++) idx.push(first, first + (flip ? k + 1 : k), first + (flip ? k : k + 1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));   // plain colour: the other meshes it is merged with have UVs
    const m = new THREE.Mesh(g, M.banquetteBack); m.castShadow = m.receiveShadow = true; groups.furn.add(m);
  }
  ends.slice(1).forEach(([f1, b1], i) => {
    const [f0, b0] = ends[i];
    // Each cushion's front corners at a joint are rounded in plan, so the joint shows as a groove down the front of the seat as
    // it does across the top (owner, 2026-11-16: the fronts met flush). `turn` rounds the corner c between a and b.
    const front = FRONT.slice(f0, f1 + 1), R = .18;
    const turn = (a, c, b) => [.25, .5, .75].map(t => [0, 1].map(k => (1 - t) ** 2 * a[k] + 2 * t * (1 - t) * c[k] + t * t * b[k]));
    const along = (c, to) => { const d = Math.hypot(to[0] - c[0], to[1] - c[1]); return [c[0] + (to[0] - c[0]) / d * R, c[1] + (to[1] - c[1]) / d * R]; };
    if (i + 1 < ends.length - 1) {                                            // its south end is a joint
      const c = front.at(-1), up = along(c, BACK[b1]);
      while (front.length > 2 && Math.hypot(front.at(-1)[0] - c[0], front.at(-1)[1] - c[1]) < R) front.pop();
      front.push(...turn(front.at(-1), c, up), up);
    }
    if (i > 0) {                                                               // its north end is a joint
      const c = front[0], up = along(c, BACK[b0]);
      while (front.length > 2 && Math.hypot(front[0][0] - c[0], front[0][1] - c[1]) < R) front.shift();
      front.unshift(up, ...turn(up, c, front[0]));
    }
    prism(distinct([...front, ...BACK.slice(b0, b1 + 1).reverse()]), .85, 1.5, M.banquetteSeat, groups.furn, true, .15);
  });
}

// mirrors.js: Tinted wall panes and live planar reflections behind the banquette.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
const MIRRORS = [];
// Whoever draws the frames (draw() in rendering/frame.js; the module build's own hook in module.js) shows a mirror only from
// within MIRROR_RANGE of it: each reflection is the whole room drawn again, and from the bar room or outside the panes are too small to tell.
const MIRROR_RANGE = 45;   // ft: about the Seating Area's width
let inMirror = false;   // a mirror's reflection is being drawn: the other mirrors in it keep their last picture
let mirrorFrame = 0;    // which frame is being drawn (whoever draws them counts): a mirror draws its reflection once a frame
/** three's Reflector shader with a tint for each pane (the vertex colour) in place of its one colour. */
const TINTED_MIRROR = {
  name: 'TintedMirror', uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vTint;
    void main() { vUv = textureMatrix * vec4(position, 1.); vTint = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec4 vUv; varying vec3 vTint;
    void main() { gl_FragColor = vec4(texture2DProj(tDiffuse, vUv).rgb * vTint, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};
{
  // Mirror on the walls behind it (owner's photos, 2026-11-14): narrow panes side by side from the top of the back to the head of
  // the east wall's two high windows, which are cut out of it, six panes under each window and about 36 in all (owner, 2026-11-14),
  // so it runs on round the curved wall: 37 here. It starts in the wall's north corner, at the closet (owner, 2026-11-14).
  // Each pane is plain, dark or a slight copper, in the owner's order (2026-11-14). Guessed: 1/4" of wall showing between panes,
  // six panes north of the windows, two on the pier between them and two south of them, five on each
  // flat length of the curved wall, that the order reads north to south, and that it repeats after the fifteen panes given.
  const W = [[71.9, 77], [79, 84.1]], PANE = 5.1 / 6;   // the windows (exterior-openings.js), north to south; a pane's width, 10¼"
  /** The n + 1 points that divide the line a to b into n equal lengths. */
  const split = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  // The panes' edges along the walls' inside face, north to south, one list for each flat face: the east wall (its stops are z
  // values), then the curved wall's three lengths.
  const east = [67.25, 71.9, 77, 78, 79, 84.1, 85.9], count = [6, 6, 1, 1, 6, 2], curve = [[95.1, 85.9], [94.35, 89.7], [92.1, 93.1], [88.8, 95.3]];
  const faces = [[...count.flatMap((n, i) => split([95.1, east[i]], [95.1, east[i + 1]], n).slice(0, -1)), [95.1, 85.9]], ...curve.slice(1).map((b, i) => split(curve[i], b, 5))];
  const TINT = { N: M.mirror, D: M.mirrorDark, C: M.mirrorCopper }, ORDER = 'DNCDCNCNDNCNNDC';
  let k = 0;   // the pane's number along the whole mirror, for its tint
  for (const face of faces) {
    const [p0] = face, end = face.at(-1), L = Math.hypot(end[0] - p0[0], end[1] - p0[1]), u = [(end[0] - p0[0]) / L, (end[1] - p0[1]) / L];
    const at = (s, off) => [p0[0] + u[0] * s - u[1] * off, p0[1] + u[1] * s + u[0] * off];   // s along the face, off out from the wall into the room
    const pos = [], col = [];   // the face's panes as flat triangles (s, height) and their tints, for its reflection
    face.slice(1).forEach((q, i) => {
      const p = face[i], s0 = Math.hypot(p[0] - p0[0], p[1] - p0[1]) + .01, s1 = Math.hypot(q[0] - p0[0], q[1] - p0[1]) - .01;
      const top = u[0] === 0 && W.some(([a, b]) => p[1] > a - .01 && q[1] < b + .01) ? 8 : 10;   // under a window: stop at its sill
      const tint = TINT[ORDER[k++ % ORDER.length]];
      // The pane itself, polished metal: what the ray-traced still and the wireframe show.
      prism([at(s0, 0), at(s1, 0), at(s1, .04), at(s0, .04)], 3.2, top, tint, groups.world, false);
      pos.push(s0, 3.2, 0, s1, 3.2, 0, s1, top, 0, s0, 3.2, 0, s1, top, 0, s0, top, 0);
      for (let v = 0; v < 6; v++) col.push(...tint.color);
    });
    // Over the panes, the live view's mirror: the room drawn again as seen from behind the glass (three's Reflector), once for
    // the whole face, each pane multiplying it by its tint. Polished metal alone reflects one small photograph of the bar room,
    // taken from that room's middle: in a wall of flat mirror it showed as coarse blocks of the wrong room (owner, 2026-11-14).
    // Straight into the scene, not a group: merge() would join it into a plain mesh. MIRRORS: so the frame loop can size and hide them.
    if (quality === 'lite') continue;   // the polished panes alone: each live mirror is the room drawn once more
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const glass = new Reflector(g, { shader: TINTED_MIRROR, multisample: 0 });   // no antialiasing of its own: at the frame's size, four such pictures antialiased are over half a gigabyte
    glass.material.vertexColors = true;
    const [gx, gz] = at(0, .05);   // 5/8" off the wall, just clear of the panes
    glass.position.set(gx, 0, gz); glass.rotation.y = Math.atan2(-u[1], u[0]);   // its x along the face, its z out into the room
    // One reflection deep: a mirror seen in another mirror shows what it last showed, where three would draw the room again for it.
    // And once a frame: three draws the room twice when glass block is in view (the picture the blocks look through, then the
    // frame), and asked the mirror for its reflection both times (measured, 2026-11-14: 17 drawings of the room a frame, for 5).
    const drawRoom = glass.onBeforeRender;
    let drawnAt = -1;
    glass.onBeforeRender = (...args) => {
      if (inMirror || drawnAt === mirrorFrame) return;
      drawnAt = mirrorFrame; inMirror = true;
      const blocks = scene.getObjectsByProperty('material', M.glassBlock);   // in the reflection the glass block is solid (M.glassBlockSolid)
      for (const o of blocks) o.material = M.glassBlockSolid;
      drawRoom.apply(glass, args);
      for (const o of blocks) o.material = M.glassBlock;
      inMirror = false;
    };
    scene.add(glass); MIRRORS.push(glass);
  }
}

// decorative-lights.js: The bar room’s large coloured globes and back-bar pendant drops.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// Large globe pendants (owner's photo): four 2'-5" spheres in a 2 x 2 rectangle over the open front of the bar room, between
// the straight bar and the Butler storefront, hung on short cords from the 15'-9" ceiling. Colour-changing on site; shown in
// amber and violet as in the photo, each colour on opposite corners.
const GLOBE_R = 1.225, GLOBE_Y = 11.4;
// x, z, colour. The south pair stops at z 84.6 so the spheres clear the brick over the storefront glass (inner face z ~86.07).
const GLOBES = [[34, 75, 0], [48, 75, 1], [34, 84.6, 1], [48, 84.6, 0]];
for (const [x, z, c] of GLOBES) {
  const globe = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R, 32, 20), GLOBE_MATS[c]); globe.position.set(x, GLOBE_Y, z);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 15.2 - GLOBE_Y - GLOBE_R, 4), M.cord); cord.position.set(x, (15.2 + GLOBE_Y + GLOBE_R) / 2, z);   // from the joists to the top of the sphere
  groups.furn.add(globe, cord);
}
// Pendants: four drops of five 4" globes, hung from the canopy over the back counter. The lowest globe ends 5'-7" above the floor.
// Placed like the canopy's four downlights in the site photo (owner, 2026-11-09): centred in the canopy both ways, evenly spaced
// along it. The spacing, 4'-1", is the photo's, measured along the tile wall; a 50" TV just fits between two of them.
const PENDANT_GAP = 4.1, PENDANT_Z = (MZ.z0 + MZ.z1) / 2;
const PENDANT_X = [-1.5, -.5, .5, 1.5].map(k => (MZ.x0 + MZ.x1) / 2 + k * PENDANT_GAP);
// Each is five globes on about 5" of wire below the canopy's underside (owner, 2026-11-11: it was 1'-9").
const PENDANT_WIRE = 5 / 12, PENDANT_Y = MZ.top - .45 - PENDANT_WIRE - .18;   // PENDANT_Y: the top globe's centre
for (const x of PENDANT_X) {
  const len = PENDANT_WIRE + .18;                                              // the cord runs on into the top globe, to its centre
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, len, 4), M.cord); cord.position.set(x, PENDANT_Y + len / 2, PENDANT_Z); groups.furn.add(cord);
  for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.18, 16, 12), M.globe); b.position.set(x, PENDANT_Y - k * .36, PENDANT_Z); groups.furn.add(b); }
}

// draft-system.js: The back counter’s stainless tap panel, drip tray, and faucet prototypes.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// Back bar dressing: the draft system on the back counter. No shelves on the tile wall, and no glasses on the bars or tables.
// The draft system is from the owner's photo of it (2026-11-11): a stainless panel (plain, not brushed: owner, 2026-11-14), about 32" x 15", standing against the
// tile at the back of a shallow stainless drip tray, with ten faucets in one row near its top, 3" apart. Each faucet is chrome,
// on a round flange, its spout down and a black ball knob on its lever. Sizes are scaled off the photo (the 3x6 tile
// behind the panel gives about 30 px to the inch), so they are approximate. The beer lines behind the panel are not modelled.
{
  const IN = 1 / 12, Z = 63.62, TOP = 3.05, MID = 38.65;   // the tile face, the back counter's top, the middle of the panel: midway between the TVs (at 34.55 and 42.75, bar.js; owner, 2026-11-14; it stood at 38)
  const W = 32 * IN, H = 15 * IN, T = 1 * IN;              // the panel: width, height, thickness
  // Drip tray: 3" wider than the panel each side and 8" deep, a thin sheet with a 1¼" lip along its front and ends.
  const x0 = MID - W / 2 - 3 * IN, x1 = MID + W / 2 + 3 * IN, z1 = Z + 8 * IN, LIP = 1.25 * IN, SHEET = .015;
  prism(rect(x0, Z, x1, z1), TOP, TOP + SHEET, M.stainlessSheet, groups.furn);
  for (const lip of [rect(x0, z1 - SHEET, x1, z1), rect(x0, Z, x0 + SHEET, z1), rect(x1 - SHEET, Z, x1, z1)]) prism(lip, TOP, TOP + LIP, M.stainlessSheet, groups.furn);
  prism(rect(MID - W / 2, Z, MID + W / 2, Z + T), TOP, TOP + H, M.stainlessSheet, groups.furn);
  // One faucet, from the product photos of it the owner sent (2026-11-11, side and front; 2026-11-12, front and three-quarter, and
  // a sharper front view): a forward-sealing stainless faucet, kept to its few smooth shapes (owner, 2026-11-12: smoother and
  // simpler; no flow-control knob on its side). In inches: lengths off the side view by its 1⅛" shank thread (about 129 px to the
  // inch), widths off the sharper front view by the same bonnet collar. Origin: on the panel's face, on the shank's axis; z out
  // from the panel toward the bar, y up. Each part is a profile [radius, distance along the part's own axis], turned about that
  // axis; `tilt` leans the axis from straight up toward +z. A corner is two points close together, so only the corner shades round.
  // M.chrome, not M.tank: this close, the tanks' reflection of the cellar photo turns the faucets pink.
  const faucet = new THREE.Group();
  const part = (profile, y, z, tilt) => { const m = turned(profile, M.chrome, 32); m.position.set(0, y, z); m.rotation.x = tilt; faucet.add(m); return m; };
  // Straight out from the panel: the shank's round flange (from the bar photo), the coupling nut, then a neck into the back of the body.
  part([[0, 0], [1.2, 0], [1.2, .14], [1.14, .26], [1, .3], [.62, .3], [.56, .36], [.56, 1.2], [.5, 1.28], [.4, 1.3], [.4, 1.83]], 0, 0, Math.PI / 2);
  part([[0, -.62], [.3, -.56], [.45, -.42], [.5, -.25], [.5, .5]], 0, 1.83, 0);   // the body: an upright barrel 1" across, round underneath
  // The spout buds from the front of the barrel and hangs down and 23° forward: a round dome at the top (the one with the maker's
  // P on it), then a straight taper from ⅞" across to 9/16" at the tip, where the profile turns back up inside to make the bore.
  part([[0, -.32], [.2, -.29], [.36, -.18], [.44, -.05], [.46, .05], [.29, 1.9], [.285, 1.97], [.23, 1.97], [.2, 1.9], [.2, 1.4], [0, 1.4]], 0, 2, Math.PI - .4);
  // On top of the barrel: the bonnet's wide collar.
  part([[.5, .42], [.56, .45], [.57, .5], [.57, .75], [.55, .8], [0, .8]], 0, 1.83, 0);
  // The lever, leaning 15° forward: its stem, a smaller collar standing clear of the bonnet, the ferrule, wider at the top, and
  // the threaded stud that the black ball knob screws onto.
  const lever = part([[.12, -.12], [.12, .08], [.4, .08], [.42, .11], [.42, .26], [.4, .29], [.26, .29], [.26, .32], [.34, .76], [.32, .79], [.13, .79], [.13, 1.2]], .86, 1.83, .26);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.65, 24, 16), M.steel); knob.position.y = 1.68; lever.add(knob);
  faucet.scale.setScalar(IN); faucet.traverse(m => { m.castShadow = true; });
  // Ten of them, their axes 4¼" below the panel's top, which puts the knobs about 2" below it, as in the bar photo.
  for (let k = 0; k < 10; k++) { const f = faucet.clone(); f.position.set(MID + (k - 4.5) * 3 * IN, TOP + H - 4.25 * IN, Z + T); groups.furn.add(f); }
}


// Shared equipment frames, mesh primitives and drawing coordinates.
// Concatenated into the page's single module scope by tools/build_3d.py.
const MM = 1 / 304.8;                                          // the drawing is in millimetres
/** Empty equipment group standing at plan (x, z) ft. Inside it sizes are the drawing's millimetres, y up from the floor,
 *  and local +x points toward angle `turn` (radians: 0 = east, π/2 = south). */
function equipment(x, z, turn) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = -turn; g.scale.setScalar(MM);
  groups.furn.add(g);
  return g;
}
/** Puts a mesh into a parent group at (x, y, z), in that group's local units. */
function place(g, mesh, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
/** Stainless pipe of radius r between two points [x, y, z] (mm) of an equipment group. */
const rod = (g, a, b, r = 19) => pipe(a, b, r, M.tank, g);
/** Lathe profile points that keep a sharp edge: each is listed twice, so the lathe does not shade the corner as if it were rounded. */
const hard = (...pts) => pts.flatMap(p => [p, p]);
const cyl = (r, h, sides = 16, mat = M.tank) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, sides), mat);   // upright cylinder, stainless unless told
const box = (w, h, d, mat = M.tank) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const sphere = (r, mat = M.tank) => new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
const CORNERS = [[1, 1], [1, -1], [-1, -1], [-1, 1]];                                                    // four legs, in order round the square
// Plan angles on the Bespoke drawings run clockwise seen from above, with 0° at the vessel's front (local +x).
const rad = deg => deg * Math.PI / 180;
const planAt = (r, deg, y) => [r * Math.cos(rad(deg)), y, -r * Math.sin(rad(deg))];   // point r out at plan angle `deg`, height y
const planDir = deg => [Math.cos(rad(deg)), 0, -Math.sin(rad(deg))];                  // level unit vector at plan angle `deg`

// Process pipe, clamps, valves and instruments.
// Concatenated into the page's single module scope by tools/build_3d.py.
/** Straight stainless pipe of radius r (ft) between two 3D points (ft). `sides`: facets round it (fewer for thin rod, as on the stools). */
function pipe(a, b, r, mat = M.tank, parent = groups.furn, sides = 10) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), sides), mat);
  m.position.copy(A).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true; parent.add(m); return m;
}
/** Pipe through the points [x, y, z], with an elbow at each corner: by default a bend about 1.5 diameters in radius, as on long-radius
 *  fittings; `bend` sets it where a drawing gives the radius (in the same units as the points). `sides`: facets round the pipe, as
 *  in pipe(); each bend has two fewer along it. */
function pipeRun(pts, r, mat = M.tank, parent = groups.furn, bend = 3 * r, sides = 10) {
  const P = pts.map(p => new THREE.Vector3(...p));
  let from = P[0];
  for (let i = 1; i < P.length - 1; i++) {
    const c = P[i], dIn = c.distanceTo(P[i - 1]), dOut = c.distanceTo(P[i + 1]), k = Math.min(bend, dIn / 2, dOut / 2);
    const a = c.clone().lerp(P[i - 1], k / dIn), b = c.clone().lerp(P[i + 1], k / dOut);   // where the bend leaves each straight
    pipe(from.toArray(), a.toArray(), r, mat, parent, sides);
    const elbow = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, c, b), sides - 2, r, sides), mat);
    elbow.castShadow = true; parent.add(elbow); from = b;
  }
  pipe(from.toArray(), P.at(-1).toArray(), r, mat, parent, sides);
}
/** Empty group at `at`, scaled so that 1 = `r`, with its local +y along `dir` and local +x toward `side`: the frame a pipe fitting
 *  is built in, in pipe radii. `side` is squared up to `dir`; left out, it is up, or +x on a pipe that itself runs up or down. */
function fitting(at, dir, r, parent, side) {
  const g = new THREE.Group(), Y = new THREE.Vector3(...dir).normalize();
  const X = new THREE.Vector3(...(side ?? (Math.abs(Y.y) > .9 ? [1, 0, 0] : [0, 1, 0])));
  X.addScaledVector(Y, -X.dot(Y)).normalize();
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, X.clone().cross(Y)));
  g.position.set(...at); g.scale.setScalar(r); parent.add(g);
  return g;
}
/** Tri-clamp joint, done up, centred at `at` on a pipe of radius r running along `dir`: the two ferrule flanges inside a hinged
 *  clamp band, the band's wing nut toward `side` and its hinge opposite. On a port wider than 2" pass about .7 of the tube's radius:
 *  big clamps are slimmer for their size. */
function triClamp(at, dir, r, parent = groups.furn, side) {
  const g = fitting(at, dir, r, parent, side);
  place(g, cyl(1.33, 1));                                                                                          // ferrule flanges, face to face
  place(g, turned([[1.33, -.5], [1.62, -.4], [1.72, -.15], [1.72, .15], [1.62, .4], [1.33, .5]], M.tank, 20));   // clamp band
  place(g, box(.5, .5, .55), -1.85);                                                                               // hinge
  place(g, box(.6, .5, 1.1), 1.9);                                                                                 // the band's two ends, drawn together
  place(g, cyl(.16, 1.9, 8), 2.05, 0, .2).rotation.x = Math.PI / 2;                                                // their bolt
  place(g, box(.14, 1.3, .5), 2.05, 0, 1);                                                                         // wing nut
}
// The butterfly valves' pull handle, in pipe radii, as on the owner's photo (2026-11-10): seen side on, a rounded boss over the stem
// thinning to the tip 8.5 out; 1.3 wide. Local +z runs along the handle from the stem, +x out along the stem from the handle's underside.
const HANDLE = (() => {
  const s = new THREE.Shape();                                                         // drawn with x along the handle, y out along the stem
  s.moveTo(-.9, 0); s.lineTo(8.5, 0); s.lineTo(8.5, .4); s.lineTo(1.8, 1.15); s.quadraticCurveTo(.6, 1.5, -.3, 1.4); s.quadraticCurveTo(-.9, 1.3, -.9, .7);
  // The drawing's x becomes local z, its y local x, and the extrusion's depth (the handle's width) local y.
  const axes = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));
  return new THREE.ExtrudeGeometry(s, { depth: 1.3, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -.65).applyMatrix4(axes);
})();
/** A bare tri-clamp ferrule, open: the free end of a pipe or valve. Built in pipe radii in the fitting group `g`, from local height y
 *  on along +y, 1.55 long: the flange, and the bore with a dark floor 1.5 down it (pipes are drawn solid, so that is all the hollow
 *  there is). Whatever is joined on there instead puts a triClamp at its face, which covers the bore. */
function openFerrule(g, y = 0) {
  place(g, turned([[1, 0], [1, 1.25], ...hard([1.33, 1.3], [1.33, 1.55], [.86, 1.55]), [.86, 0]], M.tank, 20), 0, y);
  place(g, cyl(.86, .1, 20, M.rubber), 0, y + .05);
}
/** Butterfly valve on the end of a pipe of radius r at `at`, built in pipe radii after the owner's photo (2026-11-10): clamped to the
 *  pipe, a round two-piece body held by four hex bolts between its two ferrules, the outlet one bare and open (owner, 2026-11-10), and
 *  on a square neck the position plate and the pull handle with its trigger. `dir` is the way the pipe runs (the valve carries on from
 *  its end, 4.2 r long; anything joined on there brings its own triClamp); the stem stands out toward `side`. The valve is shut (owner,
 *  2026-11-10), so its handle lies square across the pipe, toward `side` x `dir`, unless `open`: then it lies along the pipe, pointing
 *  on along `dir`, as the FV shop drawing has them all (the glycol valves are open; owner, 2026-11-10). */
function butterflyValve(at, dir, side, r, parent = groups.furn, open = false) {
  const g = fitting(at, dir, r, parent, side), Y = 2.2;                                                            // Y: where the stem crosses the pipe
  triClamp([0, .5, 0], [0, 1, 0], 1, g, [0, 0, -1]);                                                               // clamped to the pipe, wing nut away from the handle
  place(g, cyl(1, 1.66), 0, 1.83);                                                                                 // inlet ferrule, into the body
  openFerrule(g, 2.66);                                                                                            // outlet ferrule, out of the body
  for (const s of [-1, 1]) place(g, cyl(2.2, .44, 28), 0, Y + .24 * s);                                            // the body's two halves
  place(g, cyl(2.14, .06, 28, M.rubber), 0, Y);                                                                      // the seat's edge between them
  for (const [x, z] of CORNERS) {                                                                                  // four bolts through the halves, a hex at each end
    place(g, cyl(.13, 1.3, 6), 1.2 * x, Y, 1.2 * z);
    for (const s of [-1, 1]) place(g, cyl(.3, .2, 6), 1.2 * x, Y + .56 * s, 1.2 * z);
  }
  place(g, box(1.1, 1, 1), 2.7, Y);                                                                                // square neck round the stem
  place(g, box(.16, 1.7, 2.4), 3.3, Y);                                                                            // position plate
  const lever = new THREE.Group();                                                                                 // turns on the stem: a quarter turn to open
  lever.position.y = Y; lever.rotation.x = open ? -Math.PI / 2 : 0; g.add(lever);
  place(lever, new THREE.Mesh(HANDLE, M.tank), 3.42);                                                              // handle
  place(lever, box(.16, .7, 5), 2.6, 0, 3.4).rotation.y = -.36;                                                    // its trigger, hanging away from it toward the tip
}
/** Lever ball valve centred at `at` on a pipe of radius r running along `dir`, built in pipe radii: the body between two hex ends and,
 *  toward `side`, the stem and its lever with a black grip. Drawn shut like the butterfly valves, so the lever lies square across the
 *  pipe, toward `side` x `dir`. */
function ballValve(at, dir, side, r, parent) {
  const g = fitting(at, dir, r, parent, side);
  place(g, cyl(1.7, 2.2, 12));                                                                                     // body
  for (const s of [-1, 1]) place(g, cyl(1.5, .9, 6), 0, 1.5 * s);                                                  // hex ends
  place(g, cyl(.5, 1.4, 8), 2.2).rotation.z = Math.PI / 2;                                                         // stem
  place(g, box(.25, .9, 6), 2.8, 0, 2.2);                                                                          // lever
  place(g, box(.45, 1.1, 3.2, M.rubber), 2.8, 0, 3.8);                                                               // its grip
}
/** Pneumatic angle-seat valve centred at `at` on a pipe of radius r running along `dir`, built in pipe radii: the body on the pipe and
 *  its air actuator standing off it at 45°, leaning on along `dir` and out toward `side`. */
function angleSeatValve(at, dir, side, r, parent) {
  const g = fitting(at, dir, r, parent, side), a = new THREE.Group();
  place(g, cyl(1.3, 3.4, 12));                                                                                     // body
  a.rotation.z = -Math.PI / 4; g.add(a);                                                                           // a: local +y runs up the actuator
  place(a, cyl(.9, 2.4, 12), 0, 1.6);                                                                              // bonnet
  place(a, cyl(1.15, .6, 6), 0, 2.7);                                                                              // its nut
  place(a, cyl(1.75, 3, 20), 0, 4.5);                                                                              // actuator
  place(a, turned([[1.75, 0], [1.25, .7], [0, .8]], M.tank, 20), 0, 6);                                            // its domed cap
  place(a, cyl(.3, .7, 8), 0, 7);                                                                                  // position indicator
}
/** Pressure gauge centred at `at`, its dial of radius R facing the level direction `out`: a stainless case and the dial. */
function gauge(at, out, R, parent) {
  const g = fitting(at, [0, 1, 0], R, parent, out);                                    // local +x out of the dial, +y up
  place(g, cyl(1, .5, 24)).rotation.z = Math.PI / 2;
  place(g, new THREE.Mesh(new THREE.CircleGeometry(.88, 24), M.dial), .26).rotation.y = Math.PI / 2;
}
/** Sample valve on the end of a level stub at `at` that points along `dir`, after the owner's photo (2026-11-10): a 1.5" tri-clamp,
 *  a thin neck into a square body, the bonnet nut and fluted knob on top, and on the far side a short outlet whose spout turns down. mm. */
function sampleValve(at, dir, parent) {
  const g = fitting(at, dir, 1, parent), top = new THREE.Group();                      // g: local +y along the stub, +x up
  triClamp([0, 8, 0], [0, 1, 0], 19, g);
  place(g, cyl(6, 24), 0, 28); place(g, box(38, 23, 23), -2, 50);                      // neck, body
  top.rotation.z = -Math.PI / 2; place(g, top, 17, 50);                                // top: on the body, local +y up
  place(top, cyl(15.5, 11, 6), 0, 5.5);                                                // bonnet nut
  place(top, cyl(15, 20, 12), 0, 23);                                                  // knob, its six flutes, and the cap on it
  for (let k = 0; k < 6; k++) place(top, cyl(6, 20, 8), 14 * Math.cos(k * Math.PI / 3), 23, 14 * Math.sin(k * Math.PI / 3));
  place(top, new THREE.Mesh(new THREE.SphereGeometry(9, 12, 6, 0, 2 * Math.PI, 0, Math.PI / 2), M.tank), 0, 32).scale.y = .5;
  place(g, cyl(6, 18), 0, 70); place(g, box(8, 3, 3), 8, 74);                          // outlet and the tab on it
  pipeRun([[0, 70, 0], [0, 82, 0], [-15, 103, 0]], 4.5, M.tank, g, 8);                 // spout, turned down 35°
}
/** Temperature probe in a thermowell: its neck and head out of the shell from `at` along `dir`, and its black cable on through the
 *  points `via`. mm. */
function probe(g, at, dir, via) {
  const out = t => at.map((v, i) => v + dir[i] * t);
  pipe(at, out(40), 12, M.tank, g); pipe(out(40), out(85), 20, M.tank, g); pipe(out(85), out(100), 9, M.rubber, g);   // neck, head, cable gland
  const run = new THREE.CatmullRomCurve3([out(100), ...via].map(p => new THREE.Vector3(...p)));
  place(g, new THREE.Mesh(new THREE.TubeGeometry(run, 40, 4, 6), M.rubber));
}

// Shared vessel supports, manways, number plates and CIP lines.
// Concatenated into the page's single module scope by tools/build_3d.py.
/** Levelling foot standing on level `foot` at (x, z), for a leg of radius r (mm): threaded stem, lock nut and pad. Returns its height,
 *  1.6 r, which is where the leg above it starts. */
function levellingFoot(g, x, z, foot, r) {
  const lift = 1.6 * r;
  place(g, cyl(.38 * r, lift), x, foot + lift / 2, z);                                 // threaded stem
  place(g, cyl(.62 * r, .35 * r, 6), x, foot + lift - .25 * r, z);                     // lock nut under the leg
  place(g, turned(hard([1.25 * r, 0], [1.25 * r, .18 * r], [.45 * r, .5 * r]), M.tank, 20), x, foot, z);   // foot pad
  return lift;
}
/** Four legs on a square about (cx, 0), all in mm: `half` = half the square's side, `r` = leg radius, `from`..`to` = bottom and
 *  top of the legs, `foot` = the level they stand on, `tie` = the height of the braces between neighbouring legs. A leg that starts
 *  at `foot` stands on a levelling foot; one that starts lower gets a plate at that level. */
function legs(g, { cx, half, r, from, to, foot, tie }) {
  CORNERS.forEach(([ax, az], i) => {
    const [bx, bz] = CORNERS[(i + 1) % 4], x = cx + ax * half, z = az * half;
    const lift = from === foot ? levellingFoot(g, x, z, foot, r) : 0;                  // the leg itself stops `lift` short of the floor
    if (!lift) place(g, cyl(r * 1.45, 20), x, foot + 10, z);
    place(g, cyl(r, to - from - lift), x, (from + lift + to) / 2, z);
    rod(g, [x, tie, z], [cx + bx * half, tie, bz * half], r * .4);
  });
}
/** Weld seam round a vessel: a bead of radius R at height y (mm). */
const seam = (g, R, y) => { place(g, new THREE.Mesh(new THREE.TorusGeometry(R, 6, 6, 64), M.tank), 0, y).rotation.x = Math.PI / 2; };
/** Doubler plates where a vessel's four legs meet its cone: an oval plate lying on the cone at each leg, centred r out at height y,
 *  `w` across and `l` along the slope (mm). `lean` = how far the cone wall there leans out from plumb, radians; its outside faces down. */
function legPads(g, r, y, lean, w, l) {
  const s = Math.sin(lean), c = Math.cos(lean);
  for (const deg of [45, 135, 225, 315]) {
    const [ox, , oz] = planDir(deg);
    const p = fitting(planAt(r, deg, y), [c * ox, -s, c * oz], 1, g, [s * ox, c, s * oz]);   // local +y out of the cone, +x up its slope
    place(p, cyl(1, 8, 24)).scale.set(l / 2, 1, w / 2);
  }
}
/** Round pressure manway on `m`, a group standing square to the head (local +y out of it, mm): a neck of radius R with a rim, a domed
 *  lid on a black gasket with a lift handle, hinged on local -x and held down by six swing bolts with hand knobs. */
function topManway(m, R) {
  place(m, turned([[R, -20], ...hard([R, 58], [R + 18, 58], [R + 18, 70]), [R, 70]], M.tank, 40));                          // neck and rim
  place(m, cyl(R + 15, 6, 40, M.rubber), 0, 73);                                                                              // gasket
  place(m, turned([...hard([R + 18, 76], [R + 18, 84]), [R, 87], [.8 * R, 97], [.45 * R, 107], [0, 110]], M.tank, 40));   // lid
  place(m, new THREE.Mesh(new THREE.TorusGeometry(45, 7, 8, 12, Math.PI), M.tank), .4 * R, 104).rotation.y = Math.PI / 2;   // lift handle
  place(m, box(46, 44, 80), -R - 30, 72);                                                                                    // hinge
  for (let k = 0; k < 6; k++) {
    const b = new THREE.Group(); b.rotation.y = (k + .5) * Math.PI / 3; m.add(b);
    place(b, box(30, 20, 24), R + 24, 46);                                             // lug on the neck
    place(b, cyl(7, 66, 8), R + 32, 74);                                               // swing bolt
    place(b, box(34, 8, 28), R + 30, 88);                                              // the lid's slotted ear
    place(b, cyl(19, 18, 6), R + 32, 104);                                             // hand knob
  }
}
/** Oval side manway, 430 x 330, in the front (0°) of a shell of radius R, its centre at height y: after the brite drawing (rev B) and
 *  the owner's photo of a 10BBL's (2026-11-10). A shroud comes out of the cladding, narrowing to the frame, which stands level with the
 *  cladding's face; the door shuts against the frame from inside. Outside: the swing arm the door hangs on, from a hinge pin on the
 *  frame's 270° side across to a nut past the middle; the door's screw through the arm's hub, with a bar handle; and a thin rod between
 *  two eyes on the frame, above and below the opening. Returns its group (local +y out of the shell, +x plumb, down). mm. */
function sideManway(g, R, y) {
  const mw = new THREE.Group(), oval = new THREE.Group();
  mw.position.set(R, y, 0); mw.rotation.z = -Math.PI / 2; g.add(mw);
  oval.scale.x = .8; mw.add(oval);                                       // round parts as wide as drawn, squeezed to their height
  place(oval, turned([[290, -80], ...hard([260, 0], [215, 0]), [215, -30]], M.tank, 40));                    // shroud and frame
  place(oval, cyl(214, 3, 40, M.rubber), 0, -28.5);                                                            // gasket
  place(oval, turned([[214, -30], [150, -20], [0, -16]], M.tank, 40));                                       // door
  for (const s of [-1, 1]) place(mw, cyl(10, 24), s * 190, 12, -30);                                         // the rod's eyes on the frame
  place(mw, cyl(5, 380), 0, 18, -30).rotation.z = Math.PI / 2;                                               // the rod
  place(mw, box(50, 50, 40), -14, 70);                                                                       // hub the screw and the arm pass through
  place(mw, cyl(11, 150), 0, 55);                                                                            // screw
  place(mw, cyl(8, 250), 0, 125).rotation.z = Math.PI / 2;                                                   // bar handle, left standing plumb
  place(mw, cyl(18, 30), 0, 125);                                                                            // its boss
  place(mw, cyl(10, 340, 12), -29, 70, 60).rotation.x = Math.PI / 2;                                         // swing arm
  place(mw, cyl(9, 16, 6), -29, 82, -100);                                                                   // the nut on its free end
  place(mw, cyl(7, 170), 0, 70, 230).rotation.z = Math.PI / 2;                                               // hinge pin
  for (const s of [-1, 1]) {
    place(mw, box(12, 80, 26), s * 65, 40, 230);                                                             // its lugs on the frame
    place(mw, cyl(11, 10, 6), s * 82, 70, 230).rotation.z = Math.PI / 2;                                     // its nuts
  }
  return mw;
}
/** Tank number plate: `text` on a 220 x 110 mm plate bent round a shell of radius R, centred at plan angle `deg` and height y. */
function tag(g, text, R, deg, y) {
  const map = canvasTex(256, (c, n) => {                                               // drawn 2 : 1, on a square canvas
    c.scale(.5, 1); c.fillStyle = '#ece9e2'; c.fillRect(0, 0, 2 * n, n);
    c.strokeStyle = c.fillStyle = '#1d1d1b'; c.lineWidth = 12; c.strokeRect(10, 10, 2 * n - 20, n - 20);
    c.font = '700 150px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, n, n / 2 + 8);
  }, 1);
  const wide = 220 / R;                                                                // the plate's width as an angle; a cylinder's angles start 90° on from plan angles
  const plate = new THREE.CylinderGeometry(R + 3, R + 3, 110, 8, 1, true, Math.PI / 2 + rad(deg) - wide / 2, wide);
  place(g, new THREE.Mesh(plate, new THREE.MeshStandardMaterial({ map, roughness: .5 })), 0, y);
}
/** CIP line of a tank: up its centre line from `from` to `top`, out to (cx, cz), then down to a butterfly valve at 1200 above the
 *  floor. Its stem stands out sideways, so the shut handle points away from the tank and clears the valve of a tank stacked with it. All mm. */
function cipLine(g, from, top, cx, cz) {
  pipeRun([[0, from, 0], [0, top, 0], [cx, top, cz], [cx, 1200, cz]], 19, M.tank, g);
  const L = Math.hypot(cx, cz);
  butterflyValve([cx, 1200, cz], [0, -1, 0], [-cz / L, 0, cx / L], 19, g);
}

// Stacked brite tanks and their shell fittings.
// Concatenated into the page's single module scope by tools/build_3d.py.
/** Each brite tank's glycol connections, F (in) and H (out), as rev B has them (owner, 2026-11-10): [plan angle, how far out from the
 *  stack's centre line its end is, which main], by the underside of the tank's cladding (562 lower tank, 2598 upper). They come up out
 *  of the top of the cladding at the back, 845 out; the lower tank's then step out to pass the upper tank. All four of a stack end
 *  facing up at BBT_PORT_Y above the floor, 66 above the upper tank's cladding, where the glycol branches join on. */
const BBT_PORTS = { 562: [[186, 917, 'supply'], [180, 917, 'return']], 2598: [[170, 845, 'supply'], [160, 845, 'return']] };
const BBT_PORT_Y = 3772;
/** Two stacked 20BBL brite tanks ("20BBL Brite Beer Tank", rev B, 2022-04-18) at (x, z) ft, manways facing `turn`.
 *  2120 mm to the pads the upper tank stands on, 4158 mm to the top of the upper CIP line. Their number plates (not on the drawing)
 *  read BT`first` (lower tank) and the next number (upper). */
function briteStack(x, z, turn, first) {
  const g = equipment(x, z, turn);
  // One clad vessel as a solid of revolution, measured up from the underside of its ø1760 cladding:
  // 150° cone bottom, 1108 shell, step in to the ø1600 dished head (265 rise, so the apex is at 1405).
  const dish = Array.from({ length: 6 }, (_, i) => [800 * Math.cos((i + 1) * Math.PI / 12), 1140 + 265 * Math.sin((i + 1) * Math.PI / 12)]);
  const profile = [...hard([0, -236], [880, 0], [880, 1108], [800, 1140]), ...dish];
  // Per tank: floor or pad level it stands on, underside of its cladding, where its legs start, half the side of the square its legs
  // stand on (the lower tank's stand wider: 1560 across the diagonal on the plan, the upper's 1360), plan angle of its CIP drop.
  for (const [base, clad, legFrom, half, cipAngle] of [[0, 562, 0, 551, 60], [2120, 2598, 1830, 481, 45]]) {
    place(g, turned(profile, M.tank, 48), 0, clad, 0);
    for (const y of [0, 1108]) seam(g, 880, clad + y);                 // the cladding's seams, at the cone and the head
    // ø129 legs. The upper tank's run down to the lower tank's head.
    legs(g, { cx: 0, half, r: 64.5, from: legFrom, to: clad, foot: base, tie: base + 235 });
    // I: 3.5" CIP port on the head's apex. C: the CIP line from it, 140 above the apex, then 970 out, past the cladding, and down
    // (both tanks' valves sit side by side).
    const apex = clad + 1405, top = apex + 140, [cx, , cz] = planAt(970, cipAngle, 0);
    place(g, cyl(45, 60), 0, apex + 10); triClamp([0, apex + 45, 0], [0, 1, 0], 32, g);
    cipLine(g, apex - 40, top, cx, cz);
    // E: pressure gauge on a 1.5" tee off the CIP drop, 126 above its valve, pointing round toward the front like the valve's stem.
    const toFront = planDir(cipAngle - 90), e = t => [cx + toFront[0] * t, 1326, cz + toFront[2] * t];   // e(t): the point t along the tee
    rod(g, e(0), e(70)); triClamp(e(45), toFront, 19, g); rod(g, e(70), e(95), 8);
    gauge(e(110), toFront, 40, g);
    // B: liquid level, a clear 3/4" hose between two small butterfly valves: one under the CIP arm 824 out from the centre line, one
    // on the outlet pipe just short of its valve. The hose hangs down the cladding beside the CIP drop and swings in under the cone.
    const drain = clad - 375, k = 824 / 970;
    butterflyValve([k * cx, top - 19, k * cz], [0, -1, 0], [cx, 0, cz], 9.5, g); triClamp([k * cx, top - 59, k * cz], [0, -1, 0], 9.5, g);
    butterflyValve([745, drain, -19], [0, 0, -1], [0, 1, 0], 9.5, g); triClamp([745, drain, -59], [0, 0, -1], 9.5, g);   // the hose is clamped on
    const hose = new THREE.CatmullRomCurve3([[k * cx, top - 61, k * cz], planAt(915, cipAngle, clad + 1150), planAt(915, cipAngle, clad + 150),
      planAt(870, cipAngle / 2, clad - 260), [745, drain, -61]].map(p => new THREE.Vector3(...p)));
    place(g, new THREE.Mesh(new THREE.TubeGeometry(hose, 60, 10, 8), M.glass));
    // The beer in it (owner, 2026-11-10: full): up to the tank's level, near the top of the shell. A hair wider than the hose, so it shows.
    const beer = hose.getSpacedPoints(80).filter(p => p.y < clad + 1050);
    place(g, new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beer), 60, 11, 8), M.beer));
    briteFittings(g, base, clad);
    tag(g, 'BT' + (first + (base ? 1 : 0)), 880, 0, clad + 985);         // over the manway; BT, not BBT (owner, 2026-11-10)
  }
}
/** One brite tank's shell fittings, read off the rev B drawing. `base` = level its legs stand on (0 for the lower tank), `clad` =
 *  underside of its ø1760 cladding. The drawing measures the fittings' heights from the inner vessel's lower seam, 219 above that. */
function briteFittings(g, base, clad) {
  const REF = clad + 219, LOW = REF + 100;                               // LOW: the level of K, G and P
  sideManway(g, 880, REF + 400);                                         // M: at 0°, its centre 400 above REF
  // A: both outlets come off one tee under the cone tip, 375 under the cladding. A1 (thread) has its valve right at the tee, toward
  // 180°; A2 (clamp) runs out to its valve under the manway.
  const drain = clad - 375;
  rod(g, [0, clad - 236, 0], [0, drain, 0]); triClamp([0, clad - 300, 0], [0, 1, 0], 19, g);
  rod(g, [-60, drain, 0], [780, drain, 0]); triClamp([60, drain, 0], [1, 0, 0], 19, g);
  butterflyValve([-60, drain, 0], [-1, 0, 0], [0, 1, 0], 19, g);
  butterflyValve([780, drain, 0], [1, 0, 0], [0, 1, 0], 19, g);
  // K: sampling valve at 330°. G: thermowell at 210°, an NPT socket in a pocket in the cladding; its probe is not on the drawing, and
  // its wire goes up inside the cladding to J, the 1.25" conduit end standing out of the cladding's top at 200°.
  const kEnd = planAt(930, 330, LOW), j = planAt(840, 200, clad + 1108);
  rod(g, planAt(870, 330, LOW), kEnd, 10); sampleValve(kEnd, planDir(330), g);
  place(g, box(14, 100, 60), ...planAt(880, 210, LOW)).rotation.y = rad(210);
  rod(g, j, [j[0], j[1] + 65, j[2]], 16); openFerrule(fitting([j[0], j[1] + 65, j[2]], [0, 1, 0], 16, g));
  // P: CO2 port at 30°; its carbonation stone (ø40 x 300) is inside the tank. A clamp at the shell, then a 2" butterfly valve, a check
  // valve and the gas hose barb. The lower tank's stand straight out. The upper tank's line turns down at the port and drops 1290
  // (the elevation's figure; the detail says 1000) to its valve, in front of the lower tank.
  const py = base ? LOW - 1290 : LOW, v = base ? 200 : 40;               // the valve's level, and how far out of the cladding it starts
  const outward = planDir(30), out = (t, y = py) => planAt(880 + t, 30, y);   // out(t, y): the point t out of the cladding on P's line
  rod(g, out(-10, LOW), out(40, LOW), 25); triClamp(out(25, LOW), outward, 25, g);
  if (base) pipeRun([out(40, LOW), out(110, LOW), out(110), out(v)], 25, M.tank, g, 50);
  butterflyValve(out(v), outward, [0, 1, 0], 25, g);
  triClamp(out(v + 105), outward, 25, g);                                   // the check valve, clamped onto the valve's outlet
  rod(g, out(v + 110), out(v + 190), 14); rod(g, out(v + 125), out(v + 170), 22);
  rod(g, out(v + 190), out(v + 235), 7);                                    // hose barb
  // F and H: glycol in and out (BBT_PORTS), 1" lines up out of the top of the cladding at the back. The lower tank's step out and run
  // up the back of the upper tank, held to it by two brackets. Each ends at BBT_PORT_Y in a clamp, where its glycol branch joins on,
  // with an isolation ball valve just above (the valve is not on the drawing).
  const up = clad + 1108;
  for (const [deg, r] of BBT_PORTS[clad]) {
    const [ex, , ez] = planAt(r, deg, 0);
    if (base) rod(g, planAt(r, deg, up - 20), [ex, BBT_PORT_Y, ez], 17);
    else pipeRun([planAt(845, deg, up - 20), planAt(845, deg, up + 40), [ex, up + 150, ez], [ex, BBT_PORT_Y, ez]], 17, M.tank, g, 40);
    triClamp([ex, BBT_PORT_Y, ez], [0, 1, 0], 17, g);
    place(g, sphere(24), ex, BBT_PORT_Y + 70, ez);
  }
  if (!base) for (const y of [2764, 3464]) place(g, box(60, 20, 150), ...planAt(895, 183, y)).rotation.y = rad(183);   // the brackets
  // N: PVRV on the head 450 out at 315°, and two lifting lugs on the head 650 out at 90° and 270°, their plates in line with the centre.
  const [nx, , nz] = planAt(450, 315, 0), ny = clad + 1359;
  place(g, cyl(30, 90), nx, ny + 30, nz); triClamp([nx, ny + 75, nz], [0, 1, 0], 23, g); place(g, cyl(35, 95), nx, ny + 130, nz);
  for (const deg of [90, 270]) place(g, box(70, 90, 14), ...planAt(650, deg, clad + 1315)).rotation.y = rad(deg);
}

// Hot liquor tank.
// Concatenated into the page's single module scope by tools/build_3d.py.
/** 40BBL hot liquor tank ("40BBL Hot Liquor Tank", rev D, 2022-03-21) at (x, z) ft, its top manway and drain side facing `turn`.
 *  ø1964 cladding 2020 tall on four ø159 legs, 150° cone top and bottom, 3110 mm to the top of the CIP line. */
function hotLiquorTank(x, z, turn) {
  const g = equipment(x, z, turn), SLOPE = 15 * Math.PI / 180;        // both cones are 150°, so they slope at 15°
  // Clad vessel: cone bottom from 399, shell 662..2695, step in to the ø1800 vessel, cone top to its apex at 2956.
  place(g, turned(hard([0, 399], [982, 662], [982, 2695], [900, 2715], [0, 2956]), M.tank, 56));
  legs(g, { cx: 0, half: 610, r: 79.5, from: 0, to: 700, foot: 0, tie: 150 });
  legPads(g, 863, 630, rad(75), 230, 270);
  for (const y of [662, 1340, 2017, 2695]) seam(g, 982, y);           // the cladding's seams; the two mid-shell ones are illustrative
  // ø400 manway lying on the cone top. Rev D puts it 548 out from the centre; it sits 350 out instead, so its centre lines up with
  // the FV row's manways (owner, 2026-11-09). Its height follows the 15° cone: 2849 at 558 out.
  const MW = 350;
  const mw = new THREE.Group(); mw.position.set(MW, 2824 + (558 - MW) * Math.tan(SLOPE), 0); mw.rotation.z = -SLOPE; g.add(mw);
  topManway(mw, 200);
  place(g, cyl(45, 60), 0, 2966); triClamp([0, 3001, 0], [0, 1, 0], 32, g);   // CIP port on the apex, clamped, as on the other tanks
  cipLine(g, 2926, 3090, 739, 739);                                   // CIP line, 1045 out on the front-left diagonal, past the cladding
  rod(g, [827, 781, -579], [827, 2621, -579], 12);                    // 1840 sight glass on the shell, 35° round from the front
}

// Fermenters and size-specific front fittings.
// Concatenated into the page's single module scope by tools/build_3d.py.
/** Each size of fermenter's front fittings, as on the owner's photos of the tanks (2026-11-10), in the 20BBL's mm and plan angles
 *  (0° = front, 90° on your right as you face it):
 *    cip, cipY  the CIP drop's angle and its valve's height      sample  the sample valve's angle
 *    co2        the CO2 port's angle, and 'valve' or 'cap'        rack    a racking port low on the cone at 0°
 *    drain      how far out from the centre the drain's valve starts
 *    manway     a side manway in the shell, its centre this far above the shell's bottom seam (left out: the manway is on top)
 *    vent       the angle of a second drop, with a vent and a valve (the 50s)
 *  The 20's are the mirror image of rev D's plan: that is how the photos show the tanks built (CIP drop and CO2 port left of the racking
 *  arm). The 10s' and 50s' drops are at 65° and ±60°; the photos have them further round, where the model's 5" gaps leave no room. */
const FV_LAYOUT = {
  20: { cip: 310, cipY: 1200, sample: 28, co2: [332, 'valve'], rack: true, drain: 470 },
  10: { cip: 65, cipY: 1400, sample: 300, co2: [40, 'cap'], manway: 580, drain: 150 },
  50: { cip: 60, cipY: 1000, sample: 0, vent: 300, manway: 1090, rack: true, drain: 470 },
};
/** Fermenter: the 20BBL ("20BBL Fermentation Vessel", drawing 0223 rev D, 2022-05-19) standing at (x, z) ft, its front (0°: drain A and
 *  racking arm B) facing `turn` (radians, 0 = +x). Built in the 20BBL's mm: the caller scales it `across` and `up` for the 10s and 50s,
 *  and `kind` (20, 10 or 50) picks that size's front fittings from FV_LAYOUT. Angles are plan angles as on the drawing, 90° on your
 *  right as you face the front. Sizes the drawing does not dimension are read off it at 1:20. `name` goes on its number plate. */
function fermenter(x, z, turn, name, kind = 20, across = 1, up = 1) {
  const L = FV_LAYOUT[kind];
  const g = equipment(x, z, turn), R = 730, SHELL0 = 1455, SHELL1 = 3175, CONE0 = 384, RISE = 275, pr = 19;   // clad ø1460, 1720 tall; cone tip; dish rise
  const dishY = r => SHELL1 + RISE * Math.sqrt(1 - (r / R) ** 2);                       // height of the dished top r out from the centre
  const coneR = y => 133 + (y - CONE0) * (R - 133) / (SHELL0 - CONE0);                   // radius of the clad cone at height y
  const wall = Math.atan((R - 133) / (SHELL0 - CONE0));                                  // how far the cone wall leans out from plumb (about 29°)
  /** A group sitting on the dish r out at `deg`, tilted with the dish there: its local +y stands square to the dish, +x points outward. */
  function onDish(r, deg) {
    const m = new THREE.Group(), slope = Math.atan((RISE / R) * (r / R) / Math.sqrt(1 - (r / R) ** 2));
    m.position.set(...planAt(r, deg, dishY(r))); m.rotation.set(0, rad(deg), -slope); g.add(m);
    return m;
  }

  // Vessel: clad shell, 60° clad cone, shallow dished top; four ø129 legs on a 741 square with braces 165 up.
  place(g, cyl(R, SHELL1 - SHELL0, 40), 0, (SHELL0 + SHELL1) / 2);
  place(g, new THREE.Mesh(new THREE.CylinderGeometry(R, 133, SHELL0 - CONE0, 40, 1, true), M.tank), 0, (SHELL0 + CONE0) / 2);
  place(g, new THREE.Mesh(new THREE.SphereGeometry(R, 40, 12, 0, 2 * Math.PI, 0, Math.PI / 2), M.tank), 0, SHELL1).scale.y = RISE / R;
  legs(g, { cx: 0, half: 370.5, r: 64.5, from: 0, to: SHELL0, foot: 0, tie: 165 });
  legPads(g, coneR(1085), 1085, wall, 190, 340);                                          // the legs' centre lines meet the cone at 1085
  // Seams: cone to shell, the cladding's three courses (illustrative, as on the cellar photo; left out where a side manway would cut
  // them), shell to head, and one round the cone.
  for (const y of L.manway ? [SHELL0, SHELL1] : [SHELL0, SHELL0 + 573, SHELL0 + 1147, SHELL1]) seam(g, R, y);
  seam(g, coneR(920), 920);

  // M: on the 20s a ø350 manway on top, 350 out at 0°, tilted with the dish, its lid held down by six swing bolts; on the 10s and 50s
  // an oval manway in the front of the shell, kept its true size on these scaled tanks.
  if (L.manway) sideManway(g, R, SHELL0 + L.manway).scale.set(1 / up, 1 / across, 1 / across);
  else topManway(onDish(350, 0), 190);
  // I: 3.5" CIP port at the centre. N: 2" PVRV 350 out at 225°. S: 3" blanked port 300 out at 295°.
  place(g, cyl(45, 80, 20), 0, dishY(0) + 30); triClamp([0, dishY(0) + 70, 0], [0, 1, 0], 32, g);
  const n = onDish(350, 225); place(n, cyl(30, 90, 16), 0, 30); triClamp([0, 75, 0], [0, 1, 0], 23, n); place(n, box(80, 120, 80), 0, 145);
  const s = onDish(300, 295); place(s, cyl(45, 70, 20), 0, 20); triClamp([0, 58, 0], [0, 1, 0], 32, s);   // blanked: the clamp holds a solid cap

  /** A drop: a 1.5" line from `from` on the dish up to the level run 160 over it, out 800 at `deg` round the drawing's R125 bend, and
   *  down to a shut valve at height C, held off the shell by a standoff just above the cone. Returns `along(t, y)`: the point t out
   *  from the drop, at height y. */
  const top = dishY(0) + 160, C = L.cipY, E = C + 240;                    // the level run; valve C's height; gauge E's height
  function dropLine(from, deg) {
    const [cx, , cz] = planAt(800, deg, 0), o = planDir(deg), along = (t, y) => [cx + o[0] * t, y, cz + o[2] * t];
    pipeRun([from, [from[0], top, from[2]], [cx, top, cz], [cx, C, cz]], pr, M.tank, g, 125);
    butterflyValve([cx, C, cz], [0, -1, 0], o, pr, g);
    rod(g, along(-75, SHELL0 + 60), along(0, SHELL0 + 60), 10);
    return along;
  }
  // CIP line (C), out of port I. On the way down, E (pressure gauge) faces out 240 above the valve and, except on the 50s, a tee 100
  // above the valve runs out 230 and up to D (adjustable pressure relief).
  const o = planDir(L.cip), along = dropLine([0, dishY(0) + 80, 0], L.cip);
  rod(g, along(0, E), along(55, E), pr); triClamp(along(40, E), o, pr, g); rod(g, along(55, E), along(82, E), 10);   // E's tee, clamped
  gauge(along(90, E), o, 36, g);
  if (L.vent) {
    // The 50s' second drop, out of the 3" port S: a vent (a bullet-nosed body, holes round it) on a clamped tee where the CIP drop has E.
    const w = planDir(L.vent), out = dropLine(planAt(300, 295, dishY(300) + 60), L.vent);
    rod(g, out(0, E), out(70, E), pr); triClamp(out(70, E), w, pr, g);
    rod(g, out(78, E), out(190, E), 30); place(g, sphere(30), ...out(190, E));
  } else {
    pipeRun([along(0, C + 100), along(230, C + 100), along(230, C + 220)], pr, M.tank, g); triClamp(along(230, C + 205), [0, 1, 0], pr, g);
    // D as a spunding valve (owner, 2026-11-09): a glass cylinder between stainless end caps.
    place(g, cyl(35, 110, 20, M.glass), ...along(230, C + 285));
    for (const y of [C + 225, C + 345]) place(g, cyl(40, 14, 20), ...along(230, y));
  }

  // A: drain/outlet from the cone tip (clamped there), down to 250 and out to its valve at 0°, stem up. On the 20s and 50s the valve
  // starts 470 from the centre (the drawing has 770), so it ends a few inches past the legs (owner, 2026-11-09); on the 10s it is
  // right under the cone.
  triClamp([0, CONE0 - 15, 0], [0, 1, 0], pr, g);
  pipeRun([[0, CONE0, 0], [0, 250, 0], [L.drain, 250, 0]], pr, M.tank, g);
  butterflyValve([L.drain, 250, 0], [1, 0, 0], [0, 1, 0], pr, g);
  // B: racking arm through the DN65 port O on the cone at 0°, square to the cone wall (so it runs out and down at about 30°),
  // shortened with A so its valve also ends just past the legs (owner, 2026-11-09): the port's collar on the cone, its neck and clamp,
  // the 1.5" arm, then its valve, stem up. The 10s' photo shows none.
  if (L.rack) {
    const d = [Math.cos(wall), -Math.sin(wall), 0];
    const arm = t => [coneR(790) + d[0] * t, 790 + d[1] * t, 0];
    place(fitting(arm(0), d, 1, g), cyl(100, 8, 24));
    pipe(arm(-20), arm(110), 38, M.tank, g); triClamp(arm(112), d, 29, g); pipe(arm(125), arm(140), pr, M.tank, g);
    butterflyValve(arm(140), d, [Math.sin(wall), Math.cos(wall), 0], pr, g);
  }
  // K: sampling valve, and Q: 2" CO2 port with its valve (a clamped cap on the 10s; the 50s' photos show none), each on a short stub
  // out of the shell 110 above its bottom seam, through a round collar. Returns the stub's end and its direction.
  const stub = (deg, r) => {
    const v = planDir(deg), [px, , pz] = planAt(R - 10, deg, 0), end = [px + v[0] * 80, 1565, pz + v[2] * 80];
    place(fitting(planAt(R, deg, 1565), v, 1, g), cyl(75, 8, 24)); rod(g, [px, 1565, pz], end, r);
    return [end, v];
  };
  const [kEnd, kDir] = stub(L.sample, 14);
  sampleValve(kEnd, kDir, g);
  if (L.co2) {
    const [qEnd, qDir] = stub(L.co2[0], 25);
    if (L.co2[1] === 'valve') butterflyValve(qEnd, qDir, [0, 1, 0], 25, g);
    else triClamp(qEnd, qDir, 25, g);                                       // a clamped cap
  }
  tag(g, name, R, L.manway ? 40 : 0, 1950);                                               // number plate at eye level: on the front, or beside a side manway
  // Temperature probe (illustrative: rev D's thermowell was not read off, and the controls are not designed): in the shell at 150°,
  // between the two jacket zones, its cable across to the glycol outlet's riser, up it, and over to the inlet's solenoid.
  probe(g, planAt(R - 10, 150, 2236), planDir(150), [planAt(R + 120, 153, 2170), planAt(845, 165, 2300), planAt(845, 166, 2950), planAt(930, 188, 3090)]);

  // F: glycol inlet (outer, 900 out at 190°, with its solenoid) and H: glycol outlet (816 out at 169°), 1" lines up the back. Each rises
  // from its cone port (F1 at 612, H1 at 985) to the cone's top, then straight up to a valve at the top; ball-valved tees feed the jacket
  // zones (F2, F3 and H2, H3). Each connection into the tank is clamped, and so is the glycol branch onto the top valve.
  for (const { r0, deg, port, jackets, topY, solenoid } of [
    { r0: 900, deg: 190, port: [200, 612], jackets: [1659, 2368], topY: 3300, solenoid: true },
    { r0: 816, deg: 169, port: [160, 985], jackets: [2104, 2829], topY: 3330 },
  ]) {
    const [px, , pz] = planAt(r0, deg, 0), [fx, , fz] = planAt(coneR(port[1]), port[0], 0);
    pipeRun([[fx, port[1], fz], [px, 1450, pz], [px, topY, pz]], 17, M.tank, g, 60);
    const from = new THREE.Vector3(fx, port[1], fz), way = new THREE.Vector3(px, 1450, pz).sub(from).normalize();   // out of the cone port
    triClamp(from.addScaledVector(way, 40).toArray(), way.toArray(), 17, g);
    place(g, sphere(26), (fx + px) / 2, (port[1] + 1450) / 2, (fz + pz) / 2);
    for (const y of jackets) {
      const [sx, , sz] = planAt(R - 10, deg, 0);
      rod(g, [px, y, pz], [sx, y, sz], 17); place(g, sphere(26), (px + sx) / 2, y, (pz + sz) / 2); triClamp(planAt(R + 14, deg, y), planDir(deg), 17, g);
    }
    if (solenoid) place(g, box(110, 90, 90), px, 3130, pz).rotation.y = rad(deg);
    butterflyValve([px, topY, pz], [0, 1, 0], planDir(deg), 17, g, true);   // glycol valves are open (owner, 2026-11-10)
    rod(g, [px, topY + 71, pz], [px, topY + 92, pz], 17); triClamp([px, topY + 71, pz], [0, 1, 0], 17, g);
  }
  return g;
}

// Two-vessel brewhouse and its platform.
// Concatenated into the page's single module scope by tools/build_3d.py.
/** 20BBL two-vessel brewhouse ("20BBL Brewhouse", rev D, 2022-02-24) with its midpoint at (x, z) ft: kettle on local -x and
 *  mash/lauter tun on +x, 3234 mm apart, the platform between them (deck at 1370) and its stair coming out toward local +z.
 *  Piping, the sink, the heat exchanger and the small control box on the front rail are left out. */
function brewhouse(x, z, turn) {
  const g = equipment(x, z, turn), K = -1617, T = 1617, DECK = 1370, RAIL = 2165;
  const CONE_SLOPE = .434;                                              // radians: both cone tops rise at about 25°
  // Both vessels: ø2060 cladding with a cone top. Kettle up to its vapour stack flange at 3200.
  place(g, turned(hard([0, 928], [1030, 928], [1030, 2402], [110, 2829], [110, 3160], [170, 3160], [170, 3200], [0, 3200]), M.tank, 56), K);
  // Steam flue on the vapour stack ("KTWP Steam Flue", rev A, 2022-04-20; owner, 2026-11-09): a ø340 x 26 flange bolted to the stack's,
  // a ø219 pipe 1780 tall to a band, and a conical rain cap (about ø395, 150 high) on three short struts. It rises through the deck;
  // its top, at about 16'-4", is just above this model's roof. ponytail: the real roof penetration (flashing, the run to the actual
  // roof line) is not drawn; the cap height is the drawing's, not checked against the roof.
  place(g, cyl(170, 26, 32), K, 3213);
  place(g, cyl(109.5, 1780 - 26, 32), K, 3226 + (1780 - 26) / 2);
  place(g, cyl(116, 30, 32), K, 3200 + 1780 - 15);                                     // band at the top
  place(g, new THREE.Mesh(new THREE.ConeGeometry(197, 110, 32), M.tank), K, 3200 + 1780 + 40 + 55);   // rain cap
  for (let k = 0; k < 3; k++) place(g, cyl(6, 50, 6), K + 100 * Math.cos(k * 2.094), 3200 + 1780 + 20, 100 * Math.sin(k * 2.094));   // cap struts
  // Mash/lauter tun, up to the stand on its top. The box and motor on that stand are drawn by gristAuger(): the owner has the auger
  // connecting there (2026-11-09), though this drawing shows that unit as the rake drive.
  place(g, turned(hard([0, 1105], [1030, 1105], [1030, 2402], [158, 2806], [158, 3005], [0, 3005]), M.tank, 56), T);
  // Per vessel: its centre, the underside of its cladding, and which way the platform is (+1 = toward +x).
  for (const [cx, clad, side] of [[K, 928, 1], [T, 1105, -1]]) {
    legs(g, { cx, half: 630, r: 77.5, from: 0, to: clad + 50, foot: 0, tie: 195 });   // ø155 legs on a 1260 square
    // ø450 glass manway lying on the cone, on the platform side (owner, 2026-11-09: glass): a stainless frame ring and its clamp
    // knobs round a dark, glossy sight glass you can see a little way into.
    const way = new THREE.Group(); way.position.set(cx + side * 716, 2598, 0); way.rotation.z = -side * CONE_SLOPE; g.add(way);
    place(way, new THREE.Mesh(new THREE.CylinderGeometry(225, 225, 60, 32, 1, true), M.tank), 0, 0);   // frame, open in the middle
    place(way, new THREE.Mesh(new THREE.TorusGeometry(205, 22, 8, 32), M.tank), 0, 30).rotation.x = Math.PI / 2;   // rim over the glass
    place(way, cyl(200, 12, 32, M.portGlass), 0, 26);
    for (let k = 0; k < 6; k++) place(way, cyl(16, 50, 8), 240 * Math.cos(k * Math.PI / 3), 30, 240 * Math.sin(k * Math.PI / 3));
  }
  place(g, box(450, 300, 120), T, 1580, 1050);                          // spent-grain door on the front of the tun
  place(g, box(400, 20, 470), T, 1230, 1165).rotation.x = .95;          // and its chute, sloping down and out at about 54°
  // Platform: 1250 deep, 1150 clear between the vessels (the deck runs on under their curve). Rails at 2165 and 1770.
  place(g, box(1450, 50, 1245), 0, DECK - 25, 2.5);
  for (const [px, pz] of [[-700, -600], [700, -600], [-700, 605], [700, 605]]) rod(g, [px, 0, pz], [px, RAIL, pz], 25);   // corner posts, floor to top rail
  rod(g, [-100, DECK, 605], [-100, RAIL, 605]);                         // post at the east side of the stair opening
  for (const y of [RAIL, 1770]) {
    rod(g, [-700, y, -600], [700, y, -600]);                            // back rail
    rod(g, [-100, y, 605], [700, y, 605]);                              // front rail, east of the stair
  }
  place(g, box(450, 550, 200), -75, RAIL + 275, -700);                  // control panel on the back rail
  // Sample sink ("Sample Sink", rev A, 2022-02-24) on the platform's front, east of the stair, where Bespoke's layout puts it, facing
  // out over the floor: 560 x 500 backsplash, 560 x 450 deck at 900 with its 300 x 200 x 120 bowl, gooseneck tap, the wort sampling
  // manifold along the top (inlet A, outlet B, sampling valve F, sight glass) and the ø89 cooling coil (D, E) under the deck.
  // Its wort and water connections are not piped (process piping is not modelled).
  {
    const sx = 330, bz = 640, deck = 900;
    place(g, box(560, 500, 30), sx, deck + 250, bz + 15);                           // backsplash
    place(g, box(560, 20, 450), sx, deck - 10, bz + 225);                           // deck
    place(g, box(300, 2, 200, M.cut), sx + 80, deck + 1, bz + 250);                 // the bowl's opening
    place(g, box(300, 120, 200), sx + 80, deck - 80, bz + 250);                     // bowl
    for (const ex of [-270, 270]) {                                                  // side brackets, 50 at the deck's front edge
      const b = place(g, box(20, 520, 40), sx + ex, deck + 160, bz + 200); b.rotation.x = -.72;
    }
    pipeRun([[sx + 150, deck, bz + 80], [sx + 150, deck + 300, bz + 80], [sx + 150, deck + 300, bz + 200], [sx + 150, deck + 230, bz + 200]], 10, M.tank, g, 60);   // gooseneck tap
    pipeRun([[sx - 260, deck + 380, bz + 60], [sx - 260, deck + 450, bz + 60], [sx + 260, deck + 450, bz + 60], [sx + 260, deck + 380, bz + 60]], 19, M.tank, g, 40);   // manifold A..B
    place(g, cyl(24, 140, 16, M.glass), sx + 70, deck + 450, bz + 60).rotation.z = Math.PI / 2;   // sight glass
    for (const vx of [-150, -20, 180]) place(g, sphere(30), sx + vx, deck + 450, bz + 60);   // valves
    rod(g, [sx - 150, deck + 450, bz + 60], [sx - 150, deck + 330, bz + 120], 8);   // F: sampling valve spout
    place(g, cyl(44.5, 450, 20), sx - 180, deck - 125, bz + 120);                   // cooling coil
  }
  // Stair on the front, west end of the platform: 650 wide, 1015 run, 7 risers.
  for (let k = 1; k < 7; k++) place(g, box(600, 25, 200), -400, DECK * k / 7 - 12, 625 + 1015 * (1 - k / 7));
  for (const sx of [-700, -100]) {
    rod(g, [sx, 0, 1640], [sx, DECK - 25, 625], 30);                    // stringer
    rod(g, [sx, 795, 1640], [sx, RAIL, 605]);                           // handrail
    rod(g, [sx, 0, 1640], [sx, 795, 1640]);                             // and its bottom post
  }
}

// Dual-stage plate heat exchanger.
// Concatenated into the page's single module scope by tools/build_3d.py.
/** Plate heat exchanger ("Plate Heat Exchange 19m2 Dual Stage", rev A, 2022-02-10) standing at (x, z) ft, its plate pack along `turn`:
 *  an 800 frame (support column, top carrying bar and bottom guide bar), the pressure plate, the 404 pack of 360 x 1060 plates with
 *  the dual stage's intermediate frame in its middle, the fixed head with its four 1.5" clamp ports, six tie bolts, on two feet.
 *  Returns the world points of the glycol stage's two ports on top of the intermediate frame, [supply, return]. */
function plateHeatExchanger(x, z, turn) {
  const g = equipment(x, z, turn);
  for (const fx of [-380, 300]) place(g, box(60, 180, 450), fx, 90);             // feet
  place(g, box(40, 1020, 60), -380, 690);                                         // support column
  rod(g, [-380, 1150, 0], [330, 1150, 0], 22); rod(g, [-380, 260, 0], [330, 260, 0], 18);   // carrying and guide bars
  place(g, box(50, 1100, 400), -175, 650);                                        // pressure plate
  for (let k = 0; k < 20; k++) place(g, box(16, 1060, 360), -140 + k * 20.2, 650);   // the plates
  place(g, box(40, 1120, 400), 52, 650);                                          // intermediate frame (the second stage's connections)
  place(g, box(60, 1130, 420), 284, 655);                                         // fixed head
  for (const y of [300, 650, 1000]) for (const s of [-1, 1]) {
    rod(g, [-260, y, s * 215], [380, y, s * 215], 12);                           // tie bolts and their nuts
    for (const nx of [-215, 330]) place(g, cyl(22, 30, 6), nx, y, s * 215).rotation.z = Math.PI / 2;
  }
  for (const [py, pz] of [[300, -110], [300, 110], [1000, -110], [1000, 110]]) {   // 1.5" clamp ports out of the head: wort and water
    rod(g, [314, py, pz], [380, py, pz], 19); place(g, cyl(25, 10), 380, py, pz).rotation.z = Math.PI / 2;
  }
  const ports = [];
  for (const pz of [110, -110]) {                                                 // glycol stage: supply (south), return (north)
    rod(g, [52, 1210, pz], [52, 1290, pz], 19); place(g, cyl(25, 10), 52, 1290, pz);
    g.updateWorldMatrix(true, false); ports.push(g.localToWorld(new THREE.Vector3(52, 1295, pz)).toArray());
  }
  return ports;
}

// Grist case, mill, auger and access stairs.
// Concatenated into the page's single module scope by tools/build_3d.py.
/** Grist case stairs ("Stairs", rev B, 2022-02-08) with their foot at (x, z) ft, climbing toward `turn`: 600 wide, seven 207 risers
 *  up a 1095 run to a 500 x 600 landing at 1450, ø38 handrails 820 above it, on castors. The landing's left side (seen climbing) is
 *  open to the grist case; it has rails on its right and its far end. */
function gristStairs(x, z, turn) {
  const g = equipment(x, z, turn), TOP = 1450, RUN = 1095, END = 1595, W = 300, RAIL_H = 820;
  place(g, box(END - RUN, 30, 600), (RUN + END) / 2, TOP - 15);                   // landing
  for (let k = 1; k < 7; k++) place(g, box(150, 25, 600), RUN * k / 7, 207 * k - 12);   // treads
  for (const s of [-1, 1]) {
    rod(g, [0, 0, s * W], [RUN, TOP, s * W], 25);                                // stringer
    for (const lx of [RUN + 15, END - 15]) rod(g, [lx, 0, s * W], [lx, TOP, s * W], 20);   // landing legs
    rod(g, [RUN + 15, 150, s * W], [END - 15, 150, s * W], 15);                  // and their tie
    for (const lx of [40, RUN + 15, END - 15]) place(g, cyl(35, 50, 12), lx, 25, s * W).rotation.x = Math.PI / 2;   // castors
    rod(g, [150, 200, s * W], [150, 200 + 900, s * W], 19);                      // bottom post
    rod(g, [150, 1100, s * W], [RUN, TOP + RAIL_H, s * W], 19);                  // handrail up the flight
  }
  rod(g, [RUN, TOP, -W], [RUN, TOP + RAIL_H, -W], 19);                            // left: the rail stops at the landing
  rod(g, [RUN, TOP + RAIL_H, W], [END - 15, TOP + RAIL_H, W], 19);                // right side of the landing
  rod(g, [END - 15, TOP + RAIL_H, W], [END - 15, TOP + RAIL_H, -W], 19);          // far end
  for (const s of [-1, 1]) rod(g, [END - 15, TOP, s * W], [END - 15, TOP + RAIL_H, s * W], 19);
  rod(g, [END - 15, TOP + RAIL_H / 2, W], [END - 15, TOP + RAIL_H / 2, -W], 15);
}
/** Grist case on its frame with the roller mill on top, and the auger that lifts grist to the mash tun ("Auger", rev B, 2022-02-11).
 *  The case's outlet stands at (x, z) ft and the auger runs toward `turn`: up at 50° for 3142 mm, round a 944 mm bend, then level
 *  at 3223 mm into its head, the box on top of the tun, `reach` mm out from the outlet, with the motor beyond it in line.
 *  The drawing's own reach is 3814 mm, to a drop beside the tun's top; the level run is whatever `reach` leaves after the bend.
 *  The case and mill stand square to the building, facing the compass direction nearest `turn`; only the auger swings about the
 *  outlet to point exactly along `turn`. The access stair (a separate drawing) and the mill's motor are left out; the mill's
 *  depth and the inlet boot are approximate. */
function gristAuger(x, z, turn, reach) {
  const QUARTER = Math.PI / 2;
  const g = equipment(x, z, Math.round(turn / QUARTER) * QUARTER);   // case and mill
  const auger = equipment(x, z, turn);                                // inlet boot, tube, head
  /** Square funnel `h` tall, from a square of side `top` down to one of side `bottom`, with flat faces. */
  const funnel = (top, bottom, h) => {
    const geo = new THREE.CylinderGeometry(top / Math.SQRT2, bottom / Math.SQRT2, h, 4).toNonIndexed();
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, M.tank);
    mesh.rotation.y = Math.PI / 4;
    return mesh;
  };
  // Grist case (580 kg): 1284 square frame, 1917 to its top. Bin 1118..1917, hopper down to the outlet at 568, over the auger's inlet boot.
  legs(g, { cx: 0, half: 612, r: 30, from: 0, to: 1917, foot: 0, tie: 150 });
  place(g, box(1200, 799, 1200), 0, 1517.5);
  place(g, funnel(1200, 150, 550), 0, 843);
  place(g, cyl(80, 90), 0, 523);
  // Two-roll mill on the case top, 203 back from the outlet (away from the auger) and 259 to one side, with its hopper up to 2573.
  const MILL_X = -203, MILL_Z = -259;
  place(g, box(420, 286, 500, M.steel), MILL_X, 2060, MILL_Z);
  place(g, funnel(508, 260, 130), MILL_X, 2268, MILL_Z);
  place(g, box(508, 240, 508), MILL_X, 2453, MILL_Z);
  place(auger, box(400, 300, 320), 150, 330);                         // inlet boot under the case's outlet
  // Auger tube (ø90) along its centre line: the 50° rise, the bend in 10° steps, then level into the head.
  const BEND_R = 944, TOP = 3223, BEND_END = 3060;
  const bend = Array.from({ length: 6 }, (_, i) => {
    const t = (50 - i * 10) * Math.PI / 180;
    return [BEND_END - BEND_R * Math.sin(t), TOP - BEND_R + BEND_R * Math.cos(t), 0];
  });
  const path = [[-4, 96, 0], ...bend, [reach, TOP, 0]];
  for (let i = 1; i < path.length; i++) rod(auger, path[i - 1], path[i], 45);
  // Head on the tun's top stand (stand top at 3005): the box from the brewhouse drawing, 3420 to its top, and its motor.
  place(auger, box(450, 415, 450), reach, 3212);
  place(auger, cyl(100, 500), reach + 475, 3212).rotation.z = Math.PI / 2;
}

// Keg washer and its process piping.
// Concatenated into the page's single module scope by tools/build_3d.py.
/** Keg washer ("CA2-32S-T-H-1", Bespoke, 2022-02-17, reissued 2022-05-06) at (x, z) ft, its keg station toward `turn`. 1200 wide,
 *  1670 deep, 2080 tall, read off the drawing's plan, front, back and side views (1:~20). Local +x is the front; z runs across, +z on
 *  your left as you face the station. Front to back:
 *  - keg station (front 430): perforated drip tray at 720 over a shallow pan; two spear heads (item 10) 270 either side of the middle,
 *    each on an arm out from its post: the Sanke fitting the keg's neck goes down onto, a plain cylinder (owner, 2026-11-10); under
 *    the tray, the manifold and valves that feed them and the drain. No kegs are drawn on it (owner, 2026-11-10);
 *  - two posts carrying the head: a frame at 1505, on it the control box up to 2080 (a cabinet behind, the operator panel in front),
 *    and over each keg an air cylinder that drives a three-armed hold-down from the top down onto the keg (owner, 2026-11-10; the
 *    plan view's three arms are this piece, not a cradle under the keg). Drawn up, as on the drawing. The pneumatic panel is on the
 *    posts' back;
 *  - the three tanks (caustic, hot water, rinse; 520 deep, to 800), each with a necked opening, lid, clamp bar and hand knob;
 *  - at the back, the two horizontal centrifugal pumps on the base and the piping: each pump's suction from the tanks and its riser
 *    to the return header and so into each tank, the valve cluster between the risers, the water line across the tanks' backs, and
 *    at the rear edge the three tank drains (items 1, 2, 5) and the main drain (item 3).
 *  The piping is simplified to those runs: about half the drawing's angle-seat valves, and no steam, CO2 or air lines. Its lever
 *  valves are drawn shut, like the tanks' valves. */
function kegWasher(x, z, turn) {
  const g = equipment(x, z, turn), F = 835, B = -835, KEG_X = 635, POST_X = 350, TANK0 = -205, TANK1 = 315, TANK_X = (TANK0 + TANK1) / 2;
  const RAIL = 72, TRAY = 720, TANK_TOP = 800, HEAD = 1575, TOP = 2080;   // heights: under the base rails, drip tray, tank tops, under the control box, overall
  const KZ = [-270, 270];                                                 // the two keg positions across the station
  // Base: eight levelling feet (72 tall) under the rails. The rails run from the posts back; the keg station hangs forward of them.
  for (const fx of [POST_X, B + 45]) for (const fz of [-565, -270, 270, 565]) levellingFoot(g, fx, fz, 0, 45);
  for (const rz of [-575, 575]) place(g, box(POST_X + 40 - B, 50, 50), (POST_X + 40 + B) / 2, RAIL + 25, rz);
  for (const rx of [POST_X + 15, TANK0, B + 25]) place(g, box(50, 50, 1150), rx, RAIL + 25, 0);

  // Keg station: the drip tray and its pan; per keg, the arm out from its post and the spear head on it (item 10), a plain cylinder
  // up through the tray to 800.
  place(g, box(430, 16, 1140, M.kwGrate), F - 220, TRAY - 8);
  place(g, box(410, 25, 1085), F - 220, TRAY - 30);
  for (const kz of KZ) {
    place(g, box(KEG_X + 40 - POST_X, 84, 84), (KEG_X + 40 + POST_X) / 2, 540, kz);
    place(g, cyl(35, 218), KEG_X, 691, kz);
  }
  // Under the tray: the manifold through both spear heads with two angle-seat valves and two small lever valves; below it the U of
  // drain pipe from the two arms, a lever valve on each side, and the main drain (item 3, 2") from it out to the rear edge.
  const UX = 456;                                                         // the drain pipes stand between the spear heads and the posts
  rod(g, [KEG_X, 620, KZ[0]], [KEG_X, 620, 416], 16);
  angleSeatValve([KEG_X, 620, 400], [0, 0, 1], [0, -1, 0], 16, g); angleSeatValve([KEG_X, 620, 0], [0, 0, -1], [0, -1, 0], 16, g);
  for (const vz of [-160, 160]) ballValve([KEG_X, 620, vz], [0, 0, -1], [0, -1, 0], 12, g);
  pipeRun([[UX, 498, KZ[1]], [UX, 337, KZ[1]], [UX, 337, KZ[0]], [UX, 498, KZ[0]]], 16, M.tank, g);
  for (const kz of KZ) ballValve([UX, 420, kz], [0, 1, 0], [1, 0, 0], 12, g);
  pipeRun([[UX, 337, 80], [UX, 170, 80], [B + 60, 170, 80]], 25, M.tank, g); openFerrule(fitting([B + 60, 170, 80], [-1, 0, 0], 25, g));

  // Two posts carry the head: the frame, on it the control box (a cabinet behind, the operator panel's housing and face in front of
  // it), and over each keg an air cylinder between two end blocks, its rod down to the hold-down: a hub with three flat arms 210 long,
  // one back toward the post and two forward and out, which the cylinder lowers onto the keg.
  for (const kz of KZ) {
    place(g, box(80, HEAD - 70 - RAIL, 80), POST_X, (HEAD - 70 + RAIL) / 2, kz);
    place(g, cyl(30, TOP - HEAD), KEG_X, (TOP + HEAD) / 2, kz);
    for (const y of [HEAD + 14, TOP - 14]) place(g, box(70, 28, 70), KEG_X, y, kz);
    place(g, cyl(14, 20, 8), KEG_X, HEAD - 80, kz);
    place(g, box(42, 30, 42), KEG_X, HEAD - 99, kz);
    for (const deg of [60, 180, 300]) {
      const [ax, , az] = planDir(deg);
      place(g, box(210, 25, 30), KEG_X + 105 * ax, HEAD - 99, kz + 105 * az).rotation.y = rad(deg);
    }
  }
  place(g, box(360, 70, 630), POST_X + 135, HEAD - 35);
  place(g, box(140, TOP - HEAD, 540), POST_X + 25, (TOP + HEAD) / 2);
  place(g, box(150, TOP - HEAD, 450), POST_X + 170, (TOP + HEAD) / 2);
  place(g, new THREE.Mesh(new THREE.PlaneGeometry(450, TOP - HEAD), M.kwPanel), POST_X + 246, (TOP + HEAD) / 2).rotation.y = Math.PI / 2;
  // On the posts' back: the pneumatic panel, with two filter regulators (bowl, body, black knob) and two solenoid valves.
  place(g, box(10, 210, 470), POST_X - 45, 1460);
  for (const pz of [-125, -40]) {
    place(g, cyl(24, 110, 12), POST_X - 80, 1420, pz); place(g, box(50, 46, 46), POST_X - 80, 1498, pz); place(g, cyl(15, 40, 10, M.rubber), POST_X - 80, 1541, pz);
  }
  for (const py of [1406, 1518]) place(g, box(40, 55, 45), POST_X - 72, py, 170);

  // Tanks: one casing in three; each tank has a necked opening with a lid, a clamp bar over it on two legs, and a hand knob at the back.
  place(g, box(TANK1 - TANK0, TANK_TOP - RAIL - 50, 1200), TANK_X, (TANK_TOP + RAIL + 50) / 2);
  for (const sz of [-200, 200]) place(g, box(TANK1 - TANK0 + 4, TANK_TOP - RAIL - 49, 8, M.steel), TANK_X, (TANK_TOP + RAIL + 50) / 2, sz);   // seams between tanks
  for (const tz of [-400, 0, 400]) {
    place(g, box(282, 75, 215), TANK_X, TANK_TOP + 37, tz);
    place(g, box(330, 14, 250), TANK_X, TANK_TOP + 82, tz);
    place(g, box(370, 16, 30), TANK_X, TANK_TOP + 112, tz);
    for (const s of [-1, 1]) place(g, box(16, 60, 30), TANK_X + s * 177, TANK_TOP + 82, tz);
    place(g, cyl(8, 50, 8), TANK_X - 140, TANK_TOP + 140, tz); place(g, cyl(34, 22, 8), TANK_X - 140, TANK_TOP + 170, tz);
  }

  // Back: two centrifugal pumps on the base, the motor along the depth with its fan cover at the rear and the pump head toward the
  // tanks. Each draws from the tanks through a clamped suction pipe and delivers up a riser, through a clamp and an angle-seat
  // valve, then forward to the return header.
  const PUMP_Y = 310, RISE_X = B + 374, HEADER_X = -290, HEADER_Y = 655;
  for (const pz of [-337, 337]) {
    const p = new THREE.Group(), rz = pz - 50;                            // p: local +y runs forward along the shaft, local -x is up; rz: where the riser stands
    p.position.set(B, PUMP_Y, pz); p.rotation.z = -Math.PI / 2; g.add(p);
    place(p, cyl(84, 80, 24), 0, 40);                                                                     // fan cover
    place(p, new THREE.Mesh(new THREE.CircleGeometry(64, 24), M.cut), 0, -1).rotation.x = Math.PI / 2;   // its grille
    place(p, cyl(78, 170, 24), 0, 165);                                                                   // motor
    for (let k = 0; k < 12; k++) {                                                                        // its cooling fins
      const fin = new THREE.Group(); fin.rotation.y = k * Math.PI / 6; p.add(fin);
      place(fin, box(8, 160, 14), 82, 165);
    }
    place(p, box(34, 80, 76), -92, 165);                                                                  // terminal box
    place(p, cyl(95, 14, 24), 0, 257); place(p, cyl(55, 80, 16), 0, 304); place(p, cyl(88, 60, 24), 0, 374);   // flange, adaptor, pump head
    place(g, box(300, 95, 140), B + 150, RAIL + 97, pz);                                                  // base under the motor
    rod(g, [TANK0, PUMP_Y, pz], [B + 404, PUMP_Y, pz], 25); triClamp([B + 440, PUMP_Y, pz], [1, 0, 0], 25, g);
    pipeRun([[RISE_X, PUMP_Y, rz], [RISE_X, HEADER_Y, rz], [HEADER_X, HEADER_Y, rz]], 19, M.tank, g);
    triClamp([RISE_X, 420, rz], [0, 1, 0], 19, g); angleSeatValve([RISE_X, 560, rz], [0, -1, 0], [-1, 0, 0], 19, g);
  }
  // Return header (2") across the tanks' backs: it turns up and in to the outer tanks at its ends, with a branch to the middle one.
  const into = ez => [[HEADER_X, HEADER_Y, ez], [HEADER_X, 765, ez], [TANK0, 765, ez]];
  pipeRun([...into(-560).reverse(), ...into(560)], 25, M.tank, g); pipeRun(into(-153), 25, M.tank, g);
  for (const ez of [-560, -153, 560]) triClamp([TANK0 - 14, 765, ez], [1, 0, 0], 25, g);
  // Valve cluster between the risers: a header joining them, a pipe up from its middle and forward to the return header, a short stub
  // across that pipe, and angle-seat valves on each.
  rod(g, [RISE_X, 493, -387], [RISE_X, 493, 287], 16);
  pipeRun([[RISE_X, 493, 0], [RISE_X, HEADER_Y, 0], [HEADER_X, HEADER_Y, 0]], 16, M.tank, g);
  rod(g, [RISE_X, 611, -100], [RISE_X, 611, 100], 16);
  for (const s of [-1, 1]) {
    angleSeatValve([RISE_X, 493, 130 * s], [0, 0, s], [0, 1, 0], 16, g); angleSeatValve([RISE_X, 611, 70 * s], [0, 0, s], [0, 1, 0], 16, g);
  }
  angleSeatValve([RISE_X, 550, 0], [0, -1, 0], [-1, 0, 0], 16, g);
  // Water (item 6): in at the rear on the +z side through a lever valve, a header across the tanks' backs, and a lever valve into each tank.
  const WX = -360, WY = 745;
  pipeRun([[-620, WY, 306], [WX, WY, 306], [WX, WY, -302]], 11, M.tank, g);
  openFerrule(fitting([-620, WY, 306], [-1, 0, 0], 11, g)); ballValve([-500, WY, 306], [-1, 0, 0], [0, 1, 0], 11, g);
  for (const vz of [-302, 0, 306]) { rod(g, [WX, WY, vz], [TANK0, WY, vz], 11); ballValve([-280, WY, vz], [1, 0, 0], [0, 1, 0], 11, g); }
  // Tank drains (items 1, 2, 5; 1.5"): each out to a lever valve and an open ferrule at the rear edge.
  for (const dz of [-532, -126, 531]) {
    rod(g, [TANK0, 212, dz], [B + 50, 212, dz], 19);
    ballValve([B + 110, 212, dz], [-1, 0, 0], [0, 1, 0], 19, g); openFerrule(fitting([B + 50, 212, dz], [-1, 0, 0], 19, g));
  }
}

// Air compressor and its panel stop.
// Concatenated into the page's single module scope by tools/build_3d.py.
/** Build the Atlas Copco G7L FF in local inches, with its controls facing +z. */
function buildCompressor(g, depth, height) {
  // Receiver with shallow dished ends, carried by saddles on two notched floor skids.
  const radius = 10.5, axisY = 12.5, head = 3.5, profile = [];
  for (const end of [-1, 1]) for (let i = 0; i <= 8; i++) {
    const angle = (end < 0 ? 8 - i : i) * Math.PI / 16;
    profile.push([radius * Math.cos(angle), end * (27.5 + head * Math.sin(angle))]);
  }
  place(g, turned(profile, M.compressor, 48), -.5, axisY).rotation.z = -Math.PI / 2;
  const skid = new THREE.Shape();
  skid.moveTo(-21, 0); skid.lineTo(-17, 0); skid.lineTo(-17, 1.7); skid.lineTo(-11, 1.7); skid.lineTo(-11, 0);
  skid.lineTo(9, 0); skid.lineTo(9, 1.7); skid.lineTo(15, 1.7); skid.lineTo(15, 0); skid.lineTo(21, 0);
  skid.lineTo(21, 3); skid.lineTo(20, 4); skid.lineTo(-20, 4); skid.lineTo(-21, 3); skid.closePath();
  const skidGeo = new THREE.ExtrudeGeometry(skid, { depth: 1, bevelEnabled: false });
  for (const side of [-1, 1]) {
    place(g, new THREE.Mesh(skidGeo, M.compressor), 0, 0, side * 9 - .5);
    for (const x of [-18.5, 17.5]) {
      place(g, box(2.1, 4.8, 1.5, M.compressor), x, 5.2, side * 8.6).rotation.x = -side * .38;
      const bolt = place(g, cyl(.34, .24, 6, M.tank), x, 5.55, side * 9.33);
      bolt.rotation.x = side * (Math.PI / 2 - .38);
      place(g, cyl(.46, .3, 6, M.door), x, .9, side * 9.6).rotation.x = Math.PI / 2;
    }
  }
  place(g, cyl(1.1, .6, 24, M.door), 30.6, axisY).rotation.z = Math.PI / 2;
  place(g, cyl(.76, .65, 6, M.tank), 31.175, axisY).rotation.z = Math.PI / 2;
  pipeRun([[20, 2.5, 0], [20, 1.7, 0], [22.3, 1.7, 0], [22.3, 1.7, 8.8]], .25, M.door, g, .5);
  place(g, box(.55, 1.65, .4, M.compressorDrain), 22.3, 1.7, 8.9);
  // The cabinet skirt wraps down past the crown on both sides, not a slab through the receiver.
  const cabinetLength = 56;  // dished receiver heads stand proud of both end supports
  for (const side of [-1, 1]) place(g, box(cabinetLength, 6, .4, M.compressor), 0, 20, side * 12.3);
  const skirtEnd = new THREE.Shape();
  skirtEnd.moveTo(-12.5, 17); skirtEnd.lineTo(-9.49, 17);
  skirtEnd.absarc(0, axisY, radius, Math.PI - Math.asin(4.5 / radius), Math.asin(4.5 / radius), true);
  skirtEnd.lineTo(12.5, 17); skirtEnd.lineTo(12.5, 23.1); skirtEnd.lineTo(-12.5, 23.1); skirtEnd.closePath();
  const skirtGeo = new THREE.ExtrudeGeometry(skirtEnd, { depth: .35, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const face = side * cabinetLength / 2;
    place(g, new THREE.Mesh(skirtGeo, M.compressor), face - (side > 0 ? .35 : 0), 0).rotation.y = Math.PI / 2;
    for (const [z, y] of [[-11.7, 17.8], [-11.7, 22.4], [-5.7, 22.4], [5.7, 22.4], [11.7, 22.4], [11.7, 17.8]]) {
      place(g, cyl(.28, .20, 6, M.door), face + side * .09, y, z).rotation.z = Math.PI / 2;
    }
  }
  const faceZ = 11.8, panelBottom = 23, panelHeight = height - 25, panelCenter = panelBottom + panelHeight / 2;
  place(g, box(cabinetLength, panelHeight, 12.5 + faceZ, M.compressor), 0, panelCenter, (faceZ - 12.5) / 2);
  place(g, new THREE.Mesh(new THREE.PlaneGeometry(cabinetLength, panelHeight), M.compressorFace), 0, panelCenter, faceZ + .01);
  place(g, new THREE.Mesh(new THREE.PlaneGeometry(8, 8 * 498 / 1024), M.compressorBadge), -16, 46.5, faceZ + .04);
  // The stop is centered at pixel (284, 165) in the 512px front-panel artwork.
  compressorStop(g, (284 / 512 - .5) * cabinetLength, panelBottom + (1 - 165 / 512) * panelHeight, faceZ);
  place(g, box(cabinetLength + 1, 1.75, depth, M.compressor), 0, height - 1.125);
  place(g, box(12, .125, 18, M.rubber), -22, height - .1875);
  for (let x = -27; x <= -17; x += 2) place(g, box(.45, .25, 18, M.compressor), x, height - .125);
}

/** Layer the mounting plate, collar, mushroom cap and twist arrows outward from the panel face. */
function compressorStop(g, x, y, faceZ) {
  function mount(mesh, offset) {
    place(g, mesh, x, y, faceZ + offset).rotation.x = Math.PI / 2;
  }
  mount(cyl(1.30, .10, 40, M.stopPlate), .06);
  mount(cyl(.50, .43, 32, M.rubber), .32);
  const profile = [[0, 0], [.49, 0], [.55, .08], [.84, .21], [.87, .29], [.85, .47], [.79, .54], [.55, .58], [0, .60]];
  mount(turned(profile, M.stopCap, 40), .51);
  const arrows = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.45), M.stopArrows);
  place(g, arrows, x, y, faceZ + 1.112).castShadow = false;
}

// Packaged steam boiler, in feet. The cabinet ends, hood and exposed fittings follow the Rite 76 S listing photos;
// the owner’s service train is mirrored. +x is the front, +z is left as seen from the front. Dimensions are approximate.
function packagedBoiler(x, z) {
  const pad = 4 / 12, g = new THREE.Group();
  prism(rect(x - 3.45, z - 2.05, x + 4.05, z + 2.3), 0, pad, M.concrete);
  solid(rect(x - 2.65, z - 1.52, x + 2.65, z + 1.52), pad, pad + 5.8);
  g.position.set(x, pad, z); groups.furn.add(g);
  const enamel = new THREE.MeshStandardMaterial({ color: '#456778', roughness: .55, metalness: .22 });
  const iron = new THREE.MeshStandardMaterial({ color: '#705244', roughness: .82 });
  const zinc = M.door, bright = M.chrome;
  const block = (x,y,z,w,h,d,m) => place(g, box(w,h,d,m), x,y,z);
  const run = (pts,r,m) => pipeRun(pts,r,m,g);
  const tube = (a,b,r,m,sides = 12) => pipe(a,b,r,m,g,sides);
  const ring = (x,y,z,r,t,m) => place(g, new THREE.Mesh(new THREE.TorusGeometry(r,t,8,32),m), x,y,z);
  const riteBadge = new THREE.MeshStandardMaterial({map: photoTex('rite-logo.png', 1), alphaTest: .5});
  function badge(x,y,z,width) {
    return place(g, new THREE.Mesh(new THREE.PlaneGeometry(width,width*447/768),riteBadge), x,y,z);
  }
  function plate(text, bg, fg, x,y,z, w,h) {
    const texture = canvasTex(256, ctx => {
      ctx.fillStyle = bg; ctx.fillRect(0,0,256,256); ctx.strokeStyle = fg; ctx.lineWidth = 5; ctx.strokeRect(5,7,246,242);
      ctx.fillStyle = fg; ctx.font = 'bold 116px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text,128,138,226);
    }, 1);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshStandardMaterial({map:texture}));
    place(g, face, x,y,z);
  }

  // Jacket supported clear of the pad on four folded legs and anchor shoes.
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    const px = sx*2.51, pz = sz*1.42;
    block(px,.035,pz,.37,.07,.28,zinc); block(px,.29,pz,.17,.52,.16,enamel);
    tube([px+sx*.12,.07,pz],[px+sx*.12,.1,pz],.034,M.steel,6);
  }
  block(0,3.15,0,5.2,5.3,3,enamel);
  for (const end of [-1,1]) {
    block(end*2.62,4.15,0,.12,3.3,3.04,enamel);
    // Lifting eye, perpendicular to each end panel, with a genuinely open bore.
    block(end*2.76,5.11,0,.26,.29,.09,enamel);
    ring(end*2.9,5.11,0,.145,.052,enamel);
    for (const side of [-1,1]) block(end*2.55,3.13,side*1.504,.08,5.26,.028,zinc);
  }
  block(2.62,1.55,0,.08,1.94,2.76,zinc);
  run([[2.66,2.39,-.25],[2.75,2.36,-.25],[2.75,2.36,.25],[2.66,2.39,.25]],.032,bright);
  for (const y of [.7,2.38]) for (const pz of [-1.25,1.25]) tube([2.65,y,pz],[2.685,y,pz],.043,bright,6);
  badge(2.682,3.77,0,.92).rotation.y = Math.PI / 2;

  // Draft hood: rolled skirt, telescoping neck and an open, dark outlet instead of a solid cap.
  place(g, turned([[.52,0],[.52,1.74],[.99,1.74],[.88,2.49],[.52,2.87],[.49,3.02],[.46,3.02],[.46,2.79]],zinc),.15,5.8);
  for (const [y,r] of [[6.04,.525],[6.71,.525],[7.55,.986],[8.29,.88],[8.8,.49]]) ring(.15,y,0,r,.015,bright).rotation.x = Math.PI/2;
  run([[1.75,5.8,-.65],[1.75,6.55,-.65],[1.75,6.55,-1.69],[1.75,.27,-1.69]],.082,M.steel);

  // Steam outlet: flanged globe valve, wheel and stem, and the short turned-out elbow.
  const vx = -1.65, vz = .48;
  place(g, turned([[.17,0],[.17,.26],[.31,.26],[.31,.37],[.22,.37],[.32,.54],[.32,.72],[.21,.86],[.31,.86],[.31,.98],[.17,.98]],zinc),vx,5.8,vz);
  for (const y of [6.15,6.77]) for (let i=0;i<6;i++) {
    const a = i*Math.PI/3, bx = vx+.255*Math.cos(a), bz = vz+.255*Math.sin(a);
    tube([bx,y,bz],[bx,y+.05,bz],.036,M.steel,6);
  }
  run([[vx,6.78,vz],[vx,7.13,vz],[vx-.45,7.13,vz]],.16,iron);
  tube([vx,6.4,vz],[vx,6.4,1.16],.12,zinc); tube([vx,6.4,1.16],[vx,6.4,1.45],.049,bright);
  ring(vx,6.4,1.38,.39,.034,M.steel);
  for (let i=0;i<3;i++) {
    const dx=.38*Math.cos(i*Math.PI/3), dy=.38*Math.sin(i*Math.PI/3);
    tube([vx-dx,6.4-dy,1.38],[vx+dx,6.4+dy,1.38],.026,M.steel);
  }

  // Low front gas train with union nuts, two actuator heads, regulator and shutoff lever.
  run([[-1.94,.61,1.78],[3.12,.61,1.78],[3.12,.61,-.79],[2.61,.61,-.79]],.081,zinc);
  for (const px of [2.53,1.76,1.06,.39,-.28,-.81]) tube([px-.06,.61,1.78],[px+.06,.61,1.78],.123,bright,6);
  for (const px of [1.52,.82]) {
    tube([px,.61,1.78],[px,.84,1.78],.15,zinc); block(px,.97,1.78,.27,.3,.23,zinc);
    run([[1.85,3.19,1.73],[1.85,1.55,1.88],[px,1.26,1.85],[px,1.12,1.78]],.025,bright);
  }
  tube([.08,.59,1.78],[.08,.84,1.78],.145,zinc); block(-.57,.77,1.78,.34,.048,.085,M.beer);
  block(2.13,1.66,1.68,.38,.43,.34,M.steel);

  // Control enclosure, flame controller, document pocket and rigid conduit to the pressure controls.
  block(1.88,3.65,1.66,.88,1.02,.32,zinc); block(1.88,3.65,1.835,.92,1.05,.05,zinc);
  badge(1.88,3.6,1.862,.43);
  const controllerBlue = new THREE.MeshStandardMaterial({ color: '#285e99', roughness: .6 });
  block(1.77,4.38,1.67,.54,.41,.34,controllerBlue);
  for (let i=0;i<5;i++) block(1.61+i*.064,4.26,1.846,.029,.095,.014,M.steel);
  block(-.12,3.07,1.63,1.23,.73,.26,zinc); block(-.12,3.42,1.66,1.28,.09,.32,zinc);
  plate('DOCUMENTS','#eeeae1','#303640',-.12,3.09,1.763,.78,.15);
  plate('RITE BOILER','#232d33','#e1e1d7',1.49,5.42,1.504,.67,.21);
  for (const [px,y] of [[.49,5.42],[-1.12,3.92]]) block(px,y,1.62,.32,.33,.24,zinc);
  run([[1.87,4.05,1.66],[.49,4.05,1.66],[.49,5.3,1.66]],.026,bright);
  run([[1.46,3.92,1.65],[-1.12,3.92,1.65]],.028,bright);
  tube([-.99,4.72,1.78],[.18,4.72,1.78],.06,zinc);
  for (const px of [-.55,-.08]) {
    tube([px,4.72,1.78],[px,4.95,1.78],.046,bright); block(px,5.09,1.78,.27,.3,.21,M.steel);
    run([[px,5.24,1.76],[px,5.5,1.76],[.34,5.5,1.65]],.024,bright);
  }
  run([[-2.02,5.89,1.76],[-.99,5.89,1.76],[-.99,4.72,1.76]],.067,enamel);
  tube([-.99,4.72,1.76],[-.99,5.01,1.83],.055,zinc);
  gauge([-.99,5.16,1.84],[0,0,1],.205,g);

  // Rear-left water column and glass. Guard rods leave the waterline visible between the two packing nuts.
  place(g,turned([[.08,0],[.08,.16],[.145,.26],[.145,2.09],[.08,2.2],[.08,2.56]],zinc),-2.02,3.33,1.76);
  for (const y of [3.62,5.43]) {
    tube([-2.02,y,1.49],[-2.02,y,1.76],.078,enamel);
    tube([-2.4,y,1.76],[-2.02,y,1.76],.069,zinc);
    tube([-2.36,y-.072,1.76],[-2.36,y+.072,1.76],.083,bright,6);
    tube([-2.36,y,1.76],[-2.36,y,1.91],.04,zinc);tube([-2.36,y,1.91],[-2.36,y,1.96],.085,M.steel);
  }
  tube([-2.36,3.67,1.76],[-2.36,5.38,1.76],.046,M.glass);
  tube([-2.36,3.67,1.76],[-2.36,4.48,1.76],.034,enamel);
  for (const px of [-2.43,-2.29]) tube([px,3.64,1.75],[px,5.42,1.75],.013,bright);
  run([[-2.02,3.33,1.76],[-2.02,2.19,1.76],[-2.95,2.19,1.76],[-2.95,2.19,-.75],[-2.6,2.19,-.75]],.078,iron);
  run([[-2.95,2.19,-.75],[-2.95,.84,-.75],[-2.95,.84,.72]],.074,iron);
  block(-2.02,2.66,1.88,.065,.33,.055,M.beer);
}

// layout.js: Where each piece of brewery equipment stands (FV_X, BBT_X, BREWHOUSE, ...). The plan page is cut from the model (tools/build_plan.py), so it follows them.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// Six FVs in one row (owner, 2026-11-09): A-101's row of four extended east, on 5'-2" centres (ø4'-9½" clad, so about 5" apart),
// and the whole row moved one tank width (4'-9½") east of where A-101 starts it, and 6" north of A-101's line (z 26), at FV_Z.
const FV_X = 24 + 1460 * MM;
const FV_Z = 25.5;   // the row's line: A-101's z 26, moved 6" north (owner, 2026-11-09)
/** Every fermenter-type tank as placed: plan centre, facing, and its scale across and up (1 for the 20BBLs); the glycol drops use it. */
const FERMENTERS = [];
/** Builds a fermenter, scaled `across` and `up` from the 20BBL drawing, and records it in FERMENTERS. They are numbered FV1, FV2, ...
 *  in the order built: the row of six west to east, then the second row (illustrative). */
function addFermenter(x, z, turn, across = 1, up = 1, kind = 20) {
  fermenter(x, z, turn, 'FV' + (FERMENTERS.length + 1), kind, across, up).scale.set(MM * across, MM * up, MM * across);
  FERMENTERS.push({ x, z, turn, across, up });
}
for (let i = 0; i < 6; i++) addFermenter(FV_X + i * 5.2, FV_Z, -Math.PI / 2);   // piping and manways to the north (owner, 2026-11-09)
// Three BBT stacks at A-101's centres, manways to the south aisle. The brewhouse is centred on A-101's pair of vessels, which A-101
// draws about 6" closer together than rev D's 3234 mm (10'-7⅜"), so each vessel sits about 3" further out than on A-101.
const BBT_X = [13.93, 20.05, 26.13], BBT_Z = 11.65;
BBT_X.forEach((x, i) => briteStack(x, BBT_Z, Math.PI / 2, 2 * i + 1));   // numbered west to east (illustrative)
const BREWHOUSE = [38.37, 12.96];
brewhouse(...BREWHOUSE, 0);
// Grist case where A-101 draws it, east of the tun at the north wall, its frame just clear of the boiler room's west wall. The auger
// runs to the unit on top of the tun's centre (owner, 2026-11-09). That is about 3220 mm from the case, so the level run is about
// 590 mm shorter than the drawing's 3814 mm reach.
const GRIST_CASE = [54.1, 11.2], TUN = [BREWHOUSE[0] + 1617 * MM, BREWHOUSE[1]];
const toTun = [TUN[0] - GRIST_CASE[0], TUN[1] - GRIST_CASE[1]];
gristAuger(...GRIST_CASE, Math.atan2(toTun[1], toTun[0]), Math.hypot(...toTun) / MM);
// Its stairs where Bespoke's layout puts them: along the south side of the case, climbing east to a landing beside it.
gristStairs(GRIST_CASE[0] - 1.06 - 1595 * MM / 2, GRIST_CASE[1] + 3.27, 0);
packagedBoiler(61.5, 12);   // inside the boiler room, front facing its east doors
// Plate heat exchanger where Bespoke's layout puts it: in the aisle just south-west of the kettle, by the north slot drain.
const HX_PORTS = plateHeatExchanger(31.7, 18.1, 0);
// HLT at the east end of the FV row, on the row's line (owner, 2026-11-09; A-101 draws it further north, beside the boiler room).
// It stands 5" clear of the last FV, as the FVs do of each other, with its manway and drain to the north like the FVs' (owner, 2026-11-09).
const LAST_FV_X = FV_X + 5 * 5.2;
const HLT_X = LAST_FV_X + (730 + 982) * MM + 5 / 12;
hotLiquorTank(HLT_X, FV_Z, -Math.PI / 2);   // 730 and 982 mm: the FV's and the HLT's cladding radii
// Keg washer east of the HLT (owner, 2026-11-09), 1' clear of it, its keg heads facing south to the open floor.
kegWasher(HLT_X + 982 * MM + 1 + 600 * MM, FV_Z, Math.PI / 2);
// Second row south of the FVs (owner, 2026-11-09): three 50BBL and two 10BBL tanks, their rears to the FVs' rears and their fronts
// (manways, drains, racking arms) south to the slot drain.
// ponytail: no shop drawings for these sizes yet, so each is the 20BBL FV scaled. 10BBL: scaled evenly to half the volume
// (ø3'-10" clad, 9'-6" tall). 50BBL: taller than the 20BBL (owner), 1.15x its height (13'-8" over its CIP line, under the joists, which are about 14'-6" over
// this row), and widened to make up 2.5x the volume (ø7'-1" clad), which also stretches its valves.
// Swap in the real vessels when their drawings arrive.
// Behind the row is a 6" gap between the two rows' glycol lines (owner, 2026-11-09: as close to the 20s as they go); 5" between tanks. West to
// east (owner): the 50s, starting in line with the west face of the FV row, then the 10s. The column (z 40.31 on) is south of it all.
const UP50 = 1.15, ACROSS50 = Math.sqrt(2.5 / UP50), K10 = Math.cbrt(.5);
const R50 = 730 * MM * ACROSS50, R10 = 730 * MM * K10, GAP = 5 / 12;
const ROW2_Z = FV_Z + 730 * MM + 170 * MM + .5 + 170 * MM * ACROSS50 + R50;   // FV south face + its glycol lines (170 out) + gap + the 50s' lines
const ROW2_Z10 = FV_Z + 730 * MM + 170 * MM + .5 + 170 * MM * K10 + R10;       // the 10s' backs on the same 6" gap, close to their drops (owner, 2026-11-09)
const ROW2_X = FV_X - 730 * MM;                                    // west face of the first 50, in line with the first FV's
const ROW2_END = ROW2_X + 3 * (2 * R50 + GAP) + 2 * (2 * R10) + GAP;   // east face of the last 10
for (let i = 0; i < 3; i++) addFermenter(ROW2_X + R50 + i * (2 * R50 + GAP), ROW2_Z, Math.PI / 2, ACROSS50, UP50, 50);
for (let i = 0; i < 2; i++) addFermenter(ROW2_X + 3 * (2 * R50 + GAP) + R10 + i * (2 * R10 + GAP), ROW2_Z10, Math.PI / 2, K10, K10, 10);

// Receiver-mounted air compressor, right of the McCandless glass-block window as seen from the brewery.
// Local inches: 63" along the wall, 26" into the room, 53" overall height.
{
  const g = new THREE.Group(), length = 63, depth = 26, height = 53;
  g.name = 'Atlas Copco G7L FF';
  g.scale.setScalar(1 / 12); g.rotation.y = -Math.PI / 2;
  g.position.set(BREW_EAST_IN - .35 - depth / 24, 0, REAR_N - .35 - length / 24);
  groups.furn.add(g);
  solid(rect(g.position.x - depth / 24, g.position.z - length / 24,
    g.position.x + depth / 24, g.position.z + length / 24), 0, height / 12);
  buildCompressor(g, depth, height);
}

// glycol.js: The glycol loop (supply, return, branches, valves) and the floor drains.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// ---------- glycol (G&D's schematic, adapted to these tanks; owner, 2026-11-09) ----------
// G&D: 3" supply and return from the chiller (20 HP, 5 HP pump, 150 gpm), isolation-valved drops to every tank, a 1.25" branch for
// the brewhouse heat exchanger, the return running beside the supply (reverse return) and then back to the chiller. Here, as the
// owner routed it (2026-11-10): the chiller's pair comes down from the roof halfway between the boiler room's east wall and the east
// outer wall, in line with the middle of the garage door, and runs west together, over the line of the 6" gap between the FV row
// and the second row, to the HLT. There the supply turns north, between FV6 and the HLT, to a line 6" south of the brite tanks'
// fronts, and west along it: over the boiler room's corner and the fronts of the mash tun and kettle (teeing off to the heat
// exchanger) and past the three brite stacks (a branch to each of the 2 tanks in each stack, back over the top of the stack). From
// the last stack it comes back south-east at 45° to the gap and runs east over it (both rows have their glycol risers on that
// side), feeding the 6 FVs and the second row, capped past the last riser. The return starts at the heat exchanger, runs beside
// the supply on its right going the supply's way (north of it along the brites, south of it over the gap), and from the end of the
// gap carries on east, beside the incoming supply, back to the chiller. Everything hangs level under the deck's joists (14'-0" at
// the north wall, rising to 15'-0" at the south); the chiller's pair rises between two of them, up through the deck. Supply blue,
// return red, as G&D colour them.
// ponytail: G&D's air vents, the chiller's check valve, strainer and actuated valves, pipe hangers and insulation are left out.
const GLY = { supply: M.glySupply, return: M.glyReturn };
const GLY_Y = 13.75, GLY_ROOF = 15.8,   // mains just under the lowest joists (14'-0" at the north wall)
      MAIN_R = 1.75 / 12, DROP_R = .66 / 12, HX_R = .83 / 12;   // 3", 1", 1.25" pipe (outside radius)
const CHILLER = [(BOILER_EAST_OUT + 94.9) / 2, (25.6 + 38.1) / 2];   // the drop, in plan
const PAIR = .5;                                                      // supply to return, centre to centre
// Supply's line over the rows' gap, and 6" south of the brite tanks' fronts (their cladding's south face is at z 14.54).
const GAP_Z = FV_Z + 3.35, BBT_FRONT_Z = BBT_Z + 880 * MM + .5;
const TURN_X = 57.4;            // where the supply turns north: between FV6 (east face x 57.19) and the HLT (west face x 57.60)
const WEST_X = BBT_X[0] - 1;    // where it turns back, just past the last stack's branches
/** Supply main in plan [x, z], from the chiller drop to its cap, just past the last riser (FV6's). The leg back from WEST_X is at 45°. */
const SUPPLY = [[CHILLER[0] + PAIR / 2, CHILLER[1]], [CHILLER[0] + PAIR / 2, GAP_Z], [TURN_X, GAP_Z], [TURN_X, BBT_FRONT_Z], [WEST_X, BBT_FRONT_Z],
  [WEST_X + GAP_Z - BBT_FRONT_Z, GAP_Z], [55.8, GAP_Z]];
/** The plan line `d` to the right of a polyline (going its way), with mitred corners. */
function offsetRight(pts, d) {
  const right = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); return [-dz / L, dx / L]; };
  return pts.map((p, i) => {
    const n0 = right(pts[Math.max(i - 1, 0)], pts[Math.max(i, 1)]), n1 = right(pts[Math.min(i, pts.length - 2)], pts[Math.min(i + 1, pts.length - 1)]);
    const m = [n0[0] + n1[0], n0[1] + n1[1]], k = d * 2 / (m[0] * m[0] + m[1] * m[1]);   // mitre: m scaled so its projection on each normal is d
    return [p[0] + m[0] * k, p[1] + m[1] * k];
  });
}
const HX_X = HX_PORTS[0][0];   // the heat exchanger's glycol stage, where the return main starts
const ret = offsetRight(SUPPLY.slice(3), PAIR);   // beside the supply from its run along the brites on
/** Return main in plan: from the heat exchanger tee, beside the supply to the end of the gap, then east and up to the chiller. */
const RETURN = [[HX_X, ret[0][1]], ...ret.slice(1, -1), [CHILLER[0] - PAIR / 2, ret.at(-1)[1]], [CHILLER[0] - PAIR / 2, CHILLER[1]]];
const at3 = ([x, z]) => [x, GLY_Y, z];
pipeRun([[SUPPLY[0][0], GLY_ROOF, SUPPLY[0][1]], ...SUPPLY.map(at3)], MAIN_R, GLY.supply);   // down through the deck from the chiller
pipeRun([...RETURN.map(at3), [RETURN.at(-1)[0], GLY_ROOF, RETURN.at(-1)[1]]], MAIN_R, GLY.return);
/** World point of an equipment group's local point (mm: r out at plan angle `deg`, height y), for a tank {x, z, turn, across, up}. */
function tankPoint(t, r, deg, y) {
  const [lx, , lz] = planAt(r * t.across * MM, deg, 0), th = -t.turn;
  return [t.x + lx * Math.cos(th) + lz * Math.sin(th), y * t.up * MM, t.z - lx * Math.sin(th) + lz * Math.cos(th)];
}
/** A drop of radius r from a connection at `from` up to the main at z `mainZ`, with slack (owner, 2026-11-10: a straight pipe looks
 *  jarring): it leaves the connection plumb, eases across, and comes up into the main plumb again. */
function drop(from, mainZ, mat, r = DROP_R) {
  const [x, y, z] = from, ease = (GLY_Y - y) * .6, v = (py, pz) => new THREE.Vector3(x, py, pz);
  const curve = new THREE.CubicBezierCurve3(v(y, z), v(y + ease, z), v(GLY_Y - ease, mainZ), v(GLY_Y, mainZ));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, r, 8), mat);
  m.castShadow = true; groups.furn.add(m);
}
// Heat exchanger: a 1.25" pair of drops from the mains (which pass about 3'-5" north of it) down to its glycol stage's ports (HX_PORTS: supply on the south one, so
// the two drops don't cross), each with its valve (G&D: a globe valve on the supply) just above the port. The return main starts here.
for (const [[px, py, pz], z, mat] of [[HX_PORTS[0], BBT_FRONT_Z, GLY.supply], [HX_PORTS[1], RETURN[0][1], GLY.return]]) {
  drop([px, py, pz], z, mat, HX_R);
  const v = sphere(HX_R * 1.8);
  v.position.set(px, py + (GLY_Y - py) * .08, pz); groups.furn.add(v);   // 8% of the way up, where the drop is still plumb over the port
}
// Brite tanks: a 1" branch to each of the two tanks in each stack, supply and return, back over the top of the stack (owner,
// 2026-11-10). Each rises plumb off its connection above the back of the upper tank (BBT_PORTS), runs level south just above the
// mains' tops (so the supply's pass over the return), and turns down into the top of its main.
const BBT_MAIN_Z = { supply: BBT_FRONT_Z, return: BBT_FRONT_Z - PAIR };   // the return is on the supply's right (north) going west
const BRANCH_Y = GLY_Y + MAIN_R + DROP_R;
for (const x of BBT_X) {
  const t = { x, z: BBT_Z, turn: Math.PI / 2, across: 1, up: 1 };
  for (const clad of [562, 2598]) for (const [deg, r, k] of BBT_PORTS[clad]) {
    const [px, py, pz] = tankPoint(t, r, deg, BBT_PORT_Y);
    pipeRun([[px, py, pz], [px, BRANCH_Y, pz], [px, BRANCH_Y, BBT_MAIN_Z[k]], [px, GLY_Y, BBT_MAIN_Z[k]]], DROP_R, GLY[k]);
  }
}
// Fermenters (the 6 FVs, then the second row): F (glycol in, 900 out at 190°) to supply and H (out, 816 at 169°) to return, from
// just above each riser's top valve. The return drops pass under the supply main on their way across (and the second row's supply
// drops under the return), well below it.
for (const t of FERMENTERS) {
  drop(tankPoint(t, 900, 190, 3390), GAP_Z, GLY.supply);
  drop(tankPoint(t, 816, 169, 3420), GAP_Z + PAIR, GLY.return);
}
// End-of-line bypass at the supply's cap (owner, 2026-11-09): a 1.5" loop down off the supply's end, across under the return and up
// into it, with a balancing valve on the down leg, so glycol keeps moving when the tanks' valves are shut.
// ponytail: the valve is drawn as a generic globe-pattern balancing valve (bronze body, black handwheel); size and make not chosen.
{
  const [x, z] = SUPPLY.at(-1), r = .95 / 12, low = GLY_Y - 1.4;              // 1.5" pipe (1.9" outside)
  pipeRun([[x, GLY_Y, z], [x + .6, GLY_Y, z], [x + .6, low, z], [x + .6, low, z + PAIR], [x + .6, GLY_Y, z + PAIR]], r, GLY.supply);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.9, r * 1.9, .42, 16), M.bronze);   // valve body on the down leg
  body.position.set(x + .6, GLY_Y - .7, z);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .3, 8), M.tank);
  stem.rotation.x = Math.PI / 2; stem.position.set(x + .6, GLY_Y - .7, z - .2);                 // bonnet out to the north, toward the aisle
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(.13, .02, 8, 24), M.steel);
  wheel.position.set(x + .6, GLY_Y - .7, z - .36);
  for (const m of [body, stem, wheel]) { m.castShadow = true; groups.furn.add(m); }
}

// ---------- floor drains (P-101, plumbing plan, 1/4" = 1'-0") ----------
// Slot drains (owner, 2026-11-09: the Slot Drain Systems type, one open slot with no grate). Drawn with the 1¼" slot, the widest of
// that maker's ½", 1" and 1¼" openings, between 1" stainless edges (edge width assumed). P-101 draws five 16'-0" trench runs and leaves
// their final location to the owner, who set them as:
//   north: one continuous run, from the west end of P-101's western north run to the east end of its eastern one (69'-1"), centred
//          in the clear aisle between the brewhouse vessels (south face z 16.34) and the FV row (north face z 23.60 before the row moved 6" north;
//          the drain stays where the owner set it);
//   south: in front of the second tank row (owner, 2026-11-09: the row's fronts face it), 800 mm (scaled) out from the 50BBLs'
//          centres, under their drain valves (owner, 2026-11-09: close to the tanks). It was about 10'-0" ending at the column; it now runs the row's full front.
// P-101's floor drain FD-1 (in the boiler room) is left out (owner, 2026-11-09).
const SLOT = 1.25 / 12, LIP = 1 / 12;
const SLOT_DRAINS = [[19.7, 88.8, 19.97], [ROW2_X, ROW2_END, ROW2_Z + 800 * MM * ACROSS50]];
for (const [x0, x1, z] of SLOT_DRAINS) {
  prism(rect(x0, z - SLOT / 2 - LIP, x1, z + SLOT / 2 + LIP), 0, .012, M.tank, groups.world, false);   // stainless edges
  prism(rect(x0, z - SLOT / 2, x1, z + SLOT / 2), 0, .016, M.cut, groups.world, false);                // the open slot
}

// finishes.js: Ceilings and floor finishes.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// ---------- ceilings (shown in eye-level views) ----------
const ceil = (pts, y) => prism(pts, y, y + .1, M.ceil, groups.ceil);   // casts shadow: with ceilings on, sun only gets in through the glass
ceil(rect(27.19, 63.56, PIER_X0, FRONT_IN + .05), 15.8);                                              // Bar/Tasting Room 15'-9¼"
// Ceiling outlines follow the inside faces of the traced walls (data/walls.json), so no slab sticks out past the shell.
const SEATING = [[56.07, 62], [95.1, 62], [95.1, 85.9], [94.35, 89.7], [92.1, 93.1], [88.8, 95.3], [84.85, 96.05], ...WHITE.slice(1), [64, 79.3], [73, 66]];
const BACK_OF_HOUSE = [[8.75, 8.2], [94.9, 8.2], [94.9, 62], [55.9, 62], [55.9, 43.5], [17.45, 43.5], [17.45, 24.9], [13.05, 24.9]];   // north, east and the diagonal west wall; stepped round the Level 2 rooms in the south-west
// The Seating Area proper, out to the east face of the angled wall: the outline of its terrazzo and of its ceiling. (SEATING also
// takes in the wedge west of that wall, which is a Level 2 room above its 8'-7" ceiling.)
const ANGLED_WALL_EAST = [[73.24, 62.1], [73.24, 67.55], [71.74, 69.8], [65.8, 78.86], [64.62, 80.61], [64.43, 80.74], [61.99, 84.61]];
const TERRAZZO = [[73.24, 62.1], [95.1, 62.1], ...SEATING.slice(2, 12), ...ANGLED_WALL_EAST.slice(1).reverse()];
ceil(TERRAZZO, 11);                                                                          // Seating Area ~11'
ceil([[56.07, 62], [73, 66], [64, 79.3], [56.07, 84]], 8.6);                                // triangle west of the angled wall 8'-7"
// Brewing / Parking: the owner (2026-11-09) has the underside of the joists at 14'-0" by the north wall rising to 15'-0" at the
// south (A-111 drew it flat, 14'-3" to the deck, "VIF"). The deck sits on the 0.6' joists, so it runs 14.6' to 15.6'.
const BREW_JOIST_N = 14, BREW_JOIST_S = 15, BREW_N_Z = 8.2, BREW_S_Z = 62;
/** Underside of the brewery's joists at plan z (ft). */
const brewJoistY = z => BREW_JOIST_N + (BREW_JOIST_S - BREW_JOIST_N) * (z - BREW_N_Z) / (BREW_S_Z - BREW_N_Z);
/** Tilt a level mesh built at the north wall's height to follow the brewery ceiling's slope (its vertices are in world feet). */
function brewSlope(mesh) {
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + brewJoistY(p.getZ(i)) - BREW_JOIST_N);
  mesh.geometry.computeVertexNormals();
}
brewSlope(ceil(BACK_OF_HOUSE, BREW_JOIST_N + .6));
ceil(rect(17.7, 53.5, 25.98, FRONT_IN + .05), 8);                                                   // restrooms and their corridor (ACT, assumed 8'-0")
/** Exposed joists under a ceiling: one every `step` ft along x from x0 (half a step in from the west end unless given), each
 *  spanning the ceiling polygon north to south. */
function joists(poly, y, step, x0) {
  const made = [];
  const xs = poly.map(p => p[0]);
  for (let x = x0 ?? Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) {
    const zs = [];
    poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; if ((p[0] - x) * (q[0] - x) < 0) zs.push(p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0])); });
    made.push(prism(rect(x - .12, Math.min(...zs), x + .12, Math.max(...zs)), y - .6, y, M.joist, groups.ceil, false));
  }
  return made;
}
joists(rect(27.19, 63.56, PIER_X0, FRONT_IN + .05), 15.8, 4);
// None under the Seating Area's ceiling (owner, 2026-11-13: remove the exposed beams there): it is a plain flat ceiling.
joists(BACK_OF_HOUSE, BREW_JOIST_N + .6, 4).forEach(brewSlope);
// Roof over the whole shell at the top of the walls, so interior views never look out over the walls to the sky (e.g. through the
// opening above the back bar). Part of the ceilings group: hidden in the overhead views, shown at eye level.
prism(SHELL, WALL_H, WALL_H + .3, M.ceil, groups.ceil);
// ---------- floor finishes (owner, 2026-11-09) ----------
// Terrazzo in the Seating Area (the south-east room); 12x24 slate through the rest of the bar area: the bar room, the angled
// bar's zone west of the angled wall, the strip under the lintels, and the restrooms with their corridor and the stair passage.
// The back of house keeps the polished concrete slab. Set 0.03 ft proud of the slab so the two never share a plane.
// The two meet along the east face of the angled wall (traced walls and the drink-rail ledge, flush with them), and across the
// doorway between the end of that wall and the pier by the storefront. Terrazzo stops at that doorway and at the room's north
// wall line (z 62.1).
const SLATE = [[17.75, 53.6], [29.7, 53.6], [29.7, 63.56], [56.07, 63.56], [56.07, 62.1], ...ANGLED_WALL_EAST, [59.87, 86.1], [17.75, 86.1]];
prism(TERRAZZO, 0, .03, M.terrazzo, groups.world, false);
prism(SLATE, 0, .03, M.slate, groups.world, false);
groups.ceil.visible = false;


// trim.js: Trim and wall plates in the public rooms: baseboards along the painted walls, hollow metal frames round the plain
// doors, switch plates beside them and outlets along the walls. All guessed (owner, 2026-11-17: asked for wall-level detail);
// A-01 and A-101 draw none of it.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
M.base = new THREE.MeshStandardMaterial({ color: '#20232a', roughness: .65 });                  // black resilient cove base
M.frame = new THREE.MeshStandardMaterial({ color: '#4e5155', roughness: .6, metalness: .4 });   // a shade darker than M.door, or the frame vanishes into the leaf; not M.door itself, which the plan leaves out of its cuts
M.plate = new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: .3 });                  // plastic wall plates
/** A trim piece: a prism over the plan polygon `pts` from y0 to y1, casting no shadow, and marked so hangDoors (interaction/doors.js) leaves it on the wall. */
function trim(pts, y0, y1, mat) { prism(pts, y0, y1, mat, groups.world, false).userData.fixed = true; }

// ---------- baseboards ----------
// Along the foot of every painted wall face (M.paint, as finishWall sorted them) in the public rooms; brick, the black plaster
// and the back of house get none. A face shorter than 1'-4" is a doorway's jamb or a wall's end, and is left bare, as is one
// under a window's sill.
const PUBLIC = [rect(17.7, 52.4, 26, 86.2), rect(27, 63.5, 54.9, 86.2), rect(55.8, 61.3, 95.2, 97.2)];   // restrooms and their corridor; the bar room; the Seating Area with the angled bar's zone
// Cross-section in feet: thin rounded lip, upright face, and a curved toe at the floor.
const cove = new THREE.Shape();
cove.moveTo(0, 0);
cove.lineTo(0, 4 / 12);
cove.quadraticCurveTo(.012, 4 / 12, .012, .32);
cove.lineTo(.012, .065);
cove.quadraticCurveTo(.012, .028, .0625, .01);
cove.lineTo(.0625, 0);
cove.closePath();
const RUNS = [];                                       // each baseboard: from point a along unit u for len, its face looking along unit n
for (const m of [...groups.world.children]) {
  if (m.material !== M.paint) continue;
  const P = m.geometry.attributes.position, N = m.geometry.attributes.normal, I = m.geometry.index;
  const at = k => I ? I.getX(k) : k, count = I ? I.count : P.count;
  for (let k = 0; k < count; k += 3) {
    const v = [at(k), at(k + 1), at(k + 2)];
    if (Math.abs(N.getY(v[0])) > .5) continue;         // a top or bottom face
    if (Math.max(...v.map(i => P.getY(i))) < 1) continue;   // a wall under a window's sill (the rear window's is 3" up)
    for (let e = 0; e < 3; e++) {
      const i = v[e], j = v[(e + 1) % 3];
      if (Math.abs(P.getY(i)) > .01 || Math.abs(P.getY(j)) > .01) continue;   // not the face's foot
      const a = [P.getX(i), P.getZ(i)], len = Math.hypot(P.getX(j) - a[0], P.getZ(j) - a[1]);
      if (len < 1.33) continue;
      const u = [(P.getX(j) - a[0]) / len, (P.getZ(j) - a[1]) / len], nl = Math.hypot(N.getX(i), N.getZ(i)), n = [N.getX(i) / nl, N.getZ(i) / nl];
      if (!PUBLIC.some(r => inPoly(a[0] + u[0] * len / 2 + n[0] * .2, a[1] + u[1] * len / 2 + n[1] * .2, r))) continue;
      RUNS.push({ a, u, n, len });
    }
  }
}
// Continue the cove across the narrow center pier under the angled drink rail.
// Its two exposed faces are shorter than the doorway-jamb cutoff above.
const [[, , pierSeatN, pierBarN], [pierBarS, pierSeatS]] = LEDGE_RUNS;
const pierBase = [[pierSeatN, pierSeatS], [pierBarS, pierBarN]].map(([a, b]) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  return { a, len, u: [dx / len, dz / len], n: [dz / len, -dx / len] };
});
for (const { a, u, n, len } of [...RUNS, ...pierBase]) {
  const g = new THREE.ExtrudeGeometry(cove, { depth: len, bevelEnabled: false, curveSegments: 6 });
  // Local X faces into the room; local Z follows the wall, starting at the far end if reversed.
  const start = -n[1] * u[0] + n[0] * u[1] < 0 ? len : 0;
  g.rotateY(Math.atan2(-n[1], n[0]));
  g.translate(a[0] + start * u[0], 0, a[1] + start * u[1]);
  const mesh = new THREE.Mesh(g, M.base);
  mesh.receiveShadow = true;
  mesh.userData.fixed = true;
  groups.world.add(mesh);
}

// ---------- door frames ----------
// A 2" hollow metal frame on both faces of each plain door in the public rooms, standing ½" off the wall, and lining the jambs
// and head between. The Butler entry, the Seating Area's double doors and the Cold Storage door have their own frames.
// Each: the door's hinge as recorded in DOORS, the wall's thickness behind the face it swings from, which face gets the light
// switch (1 that face, -1 the other, 0 none), its head if not the door's, and the frame's material if not M.frame.
const FRAME_W = 2 / 12, FRAME_OFF = .04;
const FRAMED = [
  [[25.56, 67.07], .37, 1],                            // Women's room: opens in, so its switch is on the face it swings from
  [[25.98, 74.58], .38, -1],                           // Men's room: opens out into the corridor, so its switch is on the room's face
  [[25.93, 57.85], 1.13, 0],                           // Women's room to the service sink
  [[89.612, 62.866], .438, 0, 6.5, M.whiteFrame],      // the Seating Area's closet, 78": white, like its door (owner, 2026-11-17)
  [[REAR_DOOR_E, REAR_S], REAR_S - REAR_N, 1],               // the steel door from the Seating Area to the rear space: switch on the Seating Area side
];
for (const [hinge, t, side, head, mat = M.frame] of FRAMED) {
  const d = DOORS.find(d => d.hinge[0] === hinge[0] && d.hinge[1] === hinge[1]);
  if (!d) throw new Error(`trim.js: no door hinged at ${hinge}: has it moved?`);
  const top = head ?? d.head, n = d.toward, back = [-n[0], -n[1]];
  const L = Math.hypot(d.closed[0] - hinge[0], d.closed[1] - hinge[1]), u = [(d.closed[0] - hinge[0]) / L, (d.closed[1] - hinge[1]) / L];
  const from = s => [hinge[0] + u[0] * s, hinge[1] + u[1] * s];   // the point s along the opening from the hinge, on the face it swings from
  for (const [o0, o1] of [[0, FRAME_OFF], [-t - FRAME_OFF, -t]]) {   // that face, then the wall's other face
    trim(band(from(-FRAME_W), u, n, FRAME_W, o0, o1), 0, top + FRAME_W, mat);   // hinge-side leg
    trim(band(from(L), u, n, FRAME_W, o0, o1), 0, top + FRAME_W, mat);        // latch-side leg
    trim(band(from(-FRAME_W), u, n, L + 2 * FRAME_W, o0, o1), top, top + FRAME_W, mat);   // head
  }
  trim(band(hinge, back, u, t, 0, .02), 0, top, mat);                    // jamb linings, through the wall
  trim(band(d.closed, back, u, t, -.02, 0), 0, top, mat);
  trim(band(hinge, u, back, L, 0, t), top - .02, top, mat);              // and the head's
  if (!side) continue;
  // Light switch on the latch side, its centre 44" up: low enough to stay under the plan's 4' cut. A 2¾" x 4½" plate with its toggle.
  const s = L + FRAME_W + .2, face = side > 0 ? 0 : -t;                        // that face's offset from the swing face
  const plate = (s0, len, o0, o1, y0, y1) => trim(band(from(s0), u, n, len, face + side * o0, face + side * o1), y0, y1, M.plate);
  plate(s, .23, 0, .02, 3.48, 3.85);
  plate(s + .09, .05, .02, .05, 3.62, 3.71);
}

// ---------- outlets ----------
// Duplex outlets along the baseboarded walls, about one every 12' and at least one on a wall 4' or longer (most of the painted
// walls here are 4'-6' pieces between openings), their centres 16" up.
// Left out where something stands against the wall there (a counter, the back bar, the banquette): any solid 4" out from it.
const OUTLET_Y = 16 / 12;
const against = (x, z) => SOLIDS.some(({ pts, y0, y1, box }) => y0 < OUTLET_Y && y1 > OUTLET_Y && x > box[0] && z > box[1] && x < box[2] && z < box[3] && inPoly(x, z, pts));
for (const { a, u, n, len } of RUNS) {
  if (len < 4) continue;
  const k = Math.max(1, Math.round(len / 12));
  for (let j = 0; j < k; j++) {
    const s = len * (j + .5) / k, p = [a[0] + u[0] * s, a[1] + u[1] * s];
    if (against(p[0] + n[0] * .33, p[1] + n[1] * .33)) continue;
    const at = ds => [p[0] + u[0] * ds, p[1] + u[1] * ds];
    trim(band(at(-.115), u, n, .23, 0, .02), OUTLET_Y - .19, OUTLET_Y + .19, M.plate);
    for (const dy of [-.09, .09]) trim(band(at(-.06), u, n, .12, .02, .035), OUTLET_Y + dy - .055, OUTLET_Y + dy + .055, M.plate);   // the two receptacles
  }
}

// lighting.js: The lights: sky and sun, downlights, LED strips, the dimmers and the overhead options for the angled bar; and applyLight(), which sets the daylight and reflections.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
// ---------- lights ----------
const sky = new THREE.HemisphereLight('#e3ebf3', '#8a7563', .55); scene.add(sky);   // flat fill light; applyLight turns it down indoors and at night
const sun = new THREE.DirectionalLight('#ffe7c4', 2.2);
sun.position.set(20, 70, 150); sun.target.position.set(55, 0, 60); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;   // normalBias stops shadow acne stripes
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 300 });
/** Make a lamp cast shadows, from `near` ft out (past its own fixture). Without them only the sun cast any, and indoors and at
 *  night the furniture floated. Kept to the 3 downlights and the 4 large globes: every shadow-casting light costs each
 *  material a texture slot, of 16, and the pendants light little but the tile behind them. Like the sun's, they are drawn once. */
function lampShadow(l, near) {
  l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.camera.near = near; l.shadow.bias = -.002; l.shadow.normalBias = .04;
}
/** Warm downlight at (x, y, z) aimed straight down, drawn as a black can unless `can` is false (its fixture is drawn elsewhere). */
function downlight(x, y, z, power = 55, angle = .75, can = true) {
  const l = new THREE.SpotLight('#ffcb8e', power, 40, angle, .9, 1.3); l.position.set(x, y, z); l.target.position.set(x, 0, z); scene.add(l, l.target);
  lampShadow(l, .5);                                  // from 6" below the light: clear of its own can and lit face
  if (can) fixture(x, y, z, .3);
  return l;
}
/** The visible part of a downlight: a black can with a glowing face (in `lamp`). Geometry only, so extra ones cost nothing per frame. */
function fixture(x, y, z, r, lamp = M.lamp) {
  const can = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .5, 16), M.steel); can.position.set(x, y + .2, z);
  const face = new THREE.Mesh(new THREE.CircleGeometry(r * .8, 16), lamp); face.rotation.x = Math.PI / 2; face.position.set(x, y - .06, z);
  groups.ceil.add(can, face);
}
/** LED strip from a to b ([x, z]) at height y, shining straight down: a lit line w wide and one linear light of its size, `power`
 *  bright (tuned by eye: a dark face wants far more than a white one to show the same wash), on the dimmer `zone`. It casts
 *  no shadow (a RectAreaLight cannot), so it belongs under an overhang, close to the face it washes, or overhead. The lit line
 *  goes in `parent`; the light goes on the scene and is returned. At 'lite' there is only the lit line, and a stand-in is
 *  returned for setBarLight() to write to: an area light is the costliest kind, on every pixel. */
function ledStrip(a, b, y, power, zone, parent = scene, w = .04) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(-dz, dx);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(len, .02, w), zone.mats[0]); tape.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2); tape.rotation.y = yaw;
  if (quality === 'lite') { parent.add(tape); return { userData: {} }; }
  const l = new THREE.RectAreaLight('#ffc98a', power, len, w); l.position.copy(tape.position); l.rotation.set(-Math.PI / 2, yaw, 0, 'YXZ');
  parent.add(tape); scene.add(l); zone.lights.push(l); return l;
}
// The dimmers (Lights menu, ui.js): each turns down its lights and the glow of the materials their fixtures are drawn in, together.
const DIMMERS = {
  'Pendants':   { lights: [], mats: [M.globe] },      // the straight bar's four
  'Globes':     { lights: [], mats: GLOBE_MATS },     // the four large coloured ones
  'Bar light':  { lights: [], mats: [M.barGlobe] },   // whichever option hangs over the angled bar
  'LED strips': { lights: [], mats: [M.led] },
  'Track lights': { lights: [], mats: [M.trackLamp] },   // the Seating Area's ten heads: their lights and lit faces
};
/** Set a dimmer to k, 0 (off) to 1 (full); with no k, put it back where it was set. Full is whatever each light and material was built at. */
function dim(name, k = DIMMERS[name].k ?? 1) {
  const { lights, mats } = DIMMERS[name]; DIMMERS[name].k = k;
  for (const l of lights) l.intensity = (l.userData.full ??= l.intensity) * k;
  for (const m of mats) m.emissiveIntensity = (m.userData.full ??= m.emissiveIntensity) * k;
}
// 26 lights (19 on site: the Seating Area's ten track heads, the back of house's downlight, the 4 pendants and the 4 globes; the 3 LED strips; and
// the bar light options' shared 4): each one costs every pixel, every frame, so add no more than are asked for.
// Seating Area (owner, 2026-11-13): track lighting, four tracks with about ten heads between them, on the 11' ceiling, parallel
// with the concrete drink-rail ledge in the angled wall (openings.js's LEDGE; the owner's "cement bar"), so they cross the room
// on the diagonal. They were first drawn north to south, then parallel with the angled bar's counter, which is square to the
// ledge. Guessed: 7' apart, the first 5' out from the ledge's face, each running to 1'-6" off the walls, and three heads on the
// two long western tracks and two on the others. Each head is a light of its own, so the pools on the floor stand under the
// heads (owner, 2026-11-13: two wide downlights lit the room from between the rails, and the pools matched no fixture). Only
// the middle head of each long track casts shadows: a shadow costs every material a texture slot. All ten are on the Track
// lights dimmer (owner, 2026-11-13).
/** A black lighting track under the ceiling at height y from a to b ([x, z]), with n spot heads evenly along it, each a light
 *  aimed straight down, on the Track lights dimmer; the middle head of a track of three casts shadows. */
function track(a, b, y, n) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  prism(band(a, u, [-u[1], u[0]], len, -.06, .06), y - .1, y, M.steel, groups.ceil, false);
  for (let k = 0; k < n; k++) {
    const t = (k + .5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    fixture(x, y - .55, z, .14, M.trackLamp);
    const l = downlight(x, y - .7, z, 45, .7, false); l.castShadow = n === 3 && k === 1;
    DIMMERS['Track lights'].lights.push(l);
  }
}
// Each track's two ends, north to south: lines along the ledge's face, 5', 12', 19' and 26' out from it into the room, clipped
// 1'-6" inside the room's walls and the closet.
[[[81.7, 63.7], [64.5, 90]], [[87.9, 67.1], [70.2, 94.1]], [[93.6, 71.2], [78.4, 94.4]], [[93.5, 84], [86.9, 94]]].forEach(([a, b], i) => track(a, b, 11, i < 2 ? 3 : 2));
downlight(40, 13.8, 30, 200, 1.35);                                                    // back of house
// The bar area (owner, 2026-11-09) is lit only by its 8 fixtures: the 4 five-globe pendants over the back counter and the 4 large globes.
for (const x of PENDANT_X) { const p = new THREE.PointLight('#ffd7a0', 12, 18, 1.6); p.position.set(x, PENDANT_Y - .72, PENDANT_Z); scene.add(p); DIMMERS.Pendants.lights.push(p); }   // one per pendant, at its middle globe
// Illustrative proposals (2026-11-13: none of it on site or in A-01). An LED strip under the overhang of both bars' tops and of the
// drink-rail ledge's concrete top on the Seating Area side, each 3 1/2" out from the face it washes.
{
  const led = DIMMERS['LED strips'], y = BAR.h - BAR.top - .01, o = BAR.over - .3;                        // under the top, o back from the guest edge
  ledStrip([31.78, 72.37 - o], [31.78 + 18.55, 72.37 - o], y, 400, led);        // straight bar: its dark fluted front
  const at = s => [A0[0] + AU[0] * s - AN[0] * o, A0[1] + AU[1] * s - AN[1] * o];
  ledStrip(at((PIER.e - A0[0] + AN[0] * o) / AU[0]), at(ANGLED_LEN - .05), y, 400, led);   // angled bar, from the pier's east face to the wall
  const [, n, s] = LEDGE, k = .3 / Math.hypot(s[0] - n[0], s[1] - n[1]), out = ([x, z]) => [x + (s[1] - n[1]) * k, z - (s[0] - n[0]) * k];
  ledStrip(out(n), out(s), 3.39, 45, led);                                          // the ledge, under its concrete top (underside 3'-4 3/4")
}
// And overhead light for the angled bar, which has none: options to compare, one shown at a time (Lights menu, ui.js). Each
// is a group of its fixtures, on the scene itself (a mesh in groups.furn is merged into one with the rest of the furniture).
// They share one set of lights, always in the scene: three lamps, which an option places (`lamps`) or leaves off, and the Line's
// LED. Lights that came and went with the option changed how many the scene had, and three.js then rebuilt every material's
// shader: the first click on None stalled for 4.7 s (measured, 2026-11-13).
// ponytail: an option's unused lights still cost every pixel; give each its own lights again if the frame rate needs them back.
// All on one line 1' back from the bar's guest edge, from just clear of the pier's corner to just clear of the wall.
const BAR_LIGHTS = {}, BAR_LIGHT_DEFAULT = 'Strand';
const BAR_LAMPS = [0, 1, 2].map(() => { const l = new THREE.PointLight('#ffd7a0', 12, 18, 1.6); scene.add(l); DIMMERS['Bar light'].lights.push(l); return l; });   // as the pendants' light
let BAR_LINE;   // the Line's LED
/** Hang one option over the angled bar: show its fixtures, and put the shared lights where it has them, off where it has none. */
function setBarLight(name) {
  for (const k in BAR_LIGHTS) BAR_LIGHTS[k].visible = k === name;
  const at = BAR_LIGHTS[name].userData.lamps ?? [];
  BAR_LAMPS.forEach((l, i) => { if (at[i]) l.position.copy(at[i]); l.userData.full = at[i] ? 12 : 0; });
  BAR_LINE.userData.full = name === 'Line' ? 30 : 0;
  dim('Bar light');
}
{
  const on = (t, y) => { const s = 2.3 + 10.1 * t; return new THREE.Vector3(A0[0] + AU[0] * s - AN[0], y, A0[1] + AU[1] * s - AN[1]); };   // t: 0 at the pier, 1 at the wall
  const option = name => { const g = BAR_LIGHTS[name] = new THREE.Group(); scene.add(g); return g; };
  const globe = (g, p) => { const b = new THREE.Mesh(new THREE.SphereGeometry(.18, 16, 12), M.barGlobe); b.position.copy(p); g.add(b); };   // the pendants' 4" globe
  const cord = (g, pts) => g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 4, .01, 4), M.cord));
  const JOISTS = 15.2;
  // Strand: fifteen globes on one cord, draped from the pier to the wall; the lowest is centred 7'-0" up. Lit at three of them.
  // ponytail: the drape is a parabola, near enough to a hanging cord's catenary at this sag.
  const strand = option('Strand'), drape = Array.from({ length: 15 }, (_, i) => on(i / 14, 7 + 2.4 * (i / 7 - 1) ** 2));
  cord(strand, drape); drape.forEach(p => globe(strand, p)); strand.userData.lamps = [2, 7, 12].map(i => drape[i]);
  // Drops: three of the straight bar's five-globe pendants, hung from the joists; the lowest globe ends 6'-6" up, clear of a
  // guest's view across the bar. Each lit at its middle globe, as those are.
  const drops = option('Drops'); drops.userData.lamps = [.17, .5, .83].map(t => on(t, 7.4));
  for (const t of [.17, .5, .83]) {
    cord(drops, [on(t, JOISTS), on(t, 8.12)]);
    for (let k = 0; k < 5; k++) globe(drops, on(t, 8.12 - k * .36));
  }
  // Line: one slim black bar the bar's length, 7'-6" up on two cords, with an LED line 2" wide along its underside.
  const line = option('Line'), ends = [on(0, 7.56), on(1, 7.56)], len = ends[0].distanceTo(ends[1]);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, .12, .2), M.steel); rail.position.lerpVectors(...ends, .5); rail.rotation.y = Math.atan2(ends[0].z - ends[1].z, ends[1].x - ends[0].x); line.add(rail);
  BAR_LINE = ledStrip(...ends.map(p => [p.x, p.z]), 7.49, 30, DIMMERS['Bar light'], line, .17);
  for (const t of [.1, .9]) cord(line, [on(t, JOISTS), on(t, 7.6)]);
  BAR_LIGHTS.None = new THREE.Group();   // as on site
  setBarLight(BAR_LIGHT_DEFAULT);
}
// Coloured light from the large globes: one point light per sphere, at its centre, so each pools its own colour on the floor and walls.
for (const [x, z, c] of GLOBES) {
  const l = new THREE.PointLight(GLOBE_COLOURS[c], 14, 24, 1.6); l.position.set(x, GLOBE_Y, z); scene.add(l); DIMMERS.Globes.lights.push(l);
  lampShadow(l, GLOBE_R + .05);                       // from just outside the sphere it sits in
}
// ---------- daylight and reflections ----------
/** Every material on the model: M's and LEATHER's, and the ones made where they are used (the glycol pipes' colours, each
 *  tank's nameplate, a door's leaf). Read off the meshes, so applyLight() misses none: it went by M and LEATHER alone until
 *  2026-11-13, and 31 of the model's 72 materials kept the studio's daytime reflection at night and indoors. */
function materials() {
  const all = new Set([...Object.values(M), ...LEATHER]);
  for (const g of Object.values(groups)) g.traverse(o => { if (o.isMesh) for (const m of [o.userData.solid ?? o.material].flat()) all.add(m); });   // solid: the real material while Wireframe has swapped it out
  return all;
}
/** Set the daylight, fill and reflections for the current ceilings-on (interior) and day/night state. Call it after changing
 *  what lights the room: groups.ceil's visibility, `night`, a dimmer or the bar light. It marks the picture `dirty`. */
function applyLight() {
  const inside = groups.ceil.visible;
  sky.intensity = (inside ? .28 : .55) * (night ? .1 : 1);
  sun.intensity = night ? 0 : 2.2;
  scene.background.set(night ? '#0b0f17' : '#d9e2ea');
  // What the materials reflect. Outside (ceilings off) it is the studio room, dimmed at night. Inside it is the bar room itself,
  // photographed from its middle as it is now lit: the floor and the tops then show the windows, the brick and the lamps, where
  // they showed the studio's white boxes. Each material carries it as its own envMap: since three r163 envMapIntensity only
  // scales a material's own envMap, not scene.environment. The tanks keep the cellar photo once it has loaded.
  const all = materials(), dim = night ? .3 : 1;
  for (const m of all) { m.envMap = scene.environment; m.envMapIntensity = inside ? .45 * dim : dim; }   // the studio room; inside, only for the probe's photograph
  // Not in wireframe: it would be a photograph of bare edges, and the model would reflect that once wireframe was switched
  // off (it went black). The Wireframe button retakes it on the way out.
  if (inside && !wire) {
    renderer.shadowMap.needsUpdate = true;                 // the photograph needs this lighting's shadows
    for (const m of MIRRORS) m.visible = false;            // the mirror wall (mirrors.js) would draw the room again for each of the photograph's six views
    roomProbe.update(renderer, scene);
    for (const m of MIRRORS) m.visible = true;
    roomEnv?.dispose(); roomEnv = pmrem.fromCubemap(roomProbe.renderTarget.texture);
    for (const m of all) { m.envMap = roomEnv.texture; m.envMapIntensity = 1; }
  }
  if (cellarEnv) M.tank.envMap = cellarEnv;
  // The tanks and the chrome are bare metal: without reflections they go black.
  M.tank.envMapIntensity = night ? .6 : 1.3; M.chrome.envMapIntensity = inside ? 1 : 2.5 * M.tank.envMapIntensity;
  renderer.shadowMap.needsUpdate = dirty = true;
}
// The probe that photographs the bar room for its reflections: six views from the middle of the room at eye height.
const roomProbe = new THREE.CubeCamera(.3, 300, new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType }));
roomProbe.position.set(42, 5.5, 77);
const pmrem = new THREE.PMREMGenerator(renderer);
let roomEnv = null;

// merge.js: Static mesh batching and zero-area normal repair.
// Shares one scope with the other 3d/src files: tools/build_3d.py joins them in order into one module script.
/** Is the i-th normal in the attribute `n` (0, 0, 0)? */
const isZeroNormal = (n, i) => !n.getX(i) && !n.getY(i) && !n.getZ(i);
/** How many vertices in the scene have the normal (0, 0, 0); merge() leaves none. For tools/smoke.py (start.js puts it on `window`). */
function countZeroNormals() {
  let zero = 0;
  scene.traverse(o => { const n = o.isMesh && o.geometry.attributes.normal; for (let i = 0; n && i < n.count; i++) if (isZeroNormal(n, i)) zero++; });
  return zero;
}
/** Merge every mesh in a group into one mesh per material, so ~1,000 objects become ~25 draw calls. */
function merge(group) {
  group.updateMatrixWorld(true);
  const byMat = new Map(), old = [];
  const hinges = group.children.filter(c => c.userData.hinge);   // the doors (hangDoors, interaction/doors.js): already merged, each on its hinge
  hinges.forEach(h => group.remove(h));
  group.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    // A triangle with no area has the normal (0, 0, 0), which lights to no value, and the glow pass spreads one such pixel into
    // a blank block over the picture (2026-11-13: the banquette, whose outline has runs of points in a straight line, so its top
    // and bottom faces have such triangles). Point those normals up; countZeroNormals() is tools/smoke.py's check on this.
    const n = g.attributes.normal;
    for (let i = 0; n && i < n.count; i++) if (isZeroNormal(n, i)) n.setY(i, 1);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!byMat.has(o.material)) byMat.set(o.material, { geos: [], cast: false });
    const e = byMat.get(o.material); e.geos.push(g); e.cast ||= o.castShadow; old.push(o);
  });
  old.forEach(o => { o.removeFromParent(); o.geometry.dispose(); });
  group.clear(); for (const h of hinges) group.add(h);   // one at a time: add() with nothing to add logs an error
  for (const [mat, { geos, cast }] of byMat) {
    // The glass block stays one mesh to a window: while any of it is in view three draws the whole model an extra time, for the
    // picture the blocks look through. Joined, it was always in view, and that cost a quarter of every frame (measured, 2026-11-14).
    for (const g of mat === M.glassBlock ? geos : [mergeGeometries(geos)]) { const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; group.add(m); }
  }
}

  // ---------- the module's own end: wait, merge, and what the caller gets ----------
  loading.onError = url => console.error('lolev-model: no texture at', url);
  // Outside light while the photos load: inside, applyLight() retakes the room's reflections, and it runs as each photo arrives.
  groups.ceil.visible = false;
  await new Promise(done => { loading.onLoad = done; });
  for (const door of GARAGE_DOORS) door.root.userData.hinge = false;   // nothing opens here: the sectional doors are merged shut with the rest
  for (const g of Object.values(groups)) merge(g);
  const made = scene.children.filter(o => !before.has(o));
  // The live mirrors ('full' only), run as the viewer's frame loop runs them (rendering/frame.js): each frame the caller draws
  // is counted, so a mirror takes one new reflection in it, and a mirror shows only from within MIRROR_RANGE of the camera.
  // ponytail: reflections stay at three's 512 px; size them to the frame (sizeMirrors, frame.js) if they look coarse.
  scene.onBeforeRender = (_renderer, _scene, camera) => {
    if (inMirror || camera.parent === roomProbe) return;   // a reflection or the room's probe drawing the scene, not a frame
    mirrorFrame++;
    for (const m of MIRRORS) m.visible = camera.position.distanceTo(m.position) < MIRROR_RANGE;
  };

  /** Show the model as a view has it (an entry of VIEWS, or anything with its two switches): the ceilings and the upper floor
   *  on or off, and the light to match. Costs about six frames when the ceilings are on (the room's reflections are retaken). */
  function show({ ceil, up }) { groups.ceil.visible = ceil; groups.up.visible = up; applyLight(); }

  /** Take the model out of the scene and free its geometry, materials, textures, shadow maps and mirrors.
   *  ponytail: the reflection generators' scratch buffers are left for the caller's renderer.forceContextLoss(). */
  function dispose() {
    for (const m of materials()) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); }
    for (const o of made) { scene.remove(o); o.traverse(p => { p.geometry?.dispose(); p.dispose?.(); }); }   // dispose: a light's shadow map, a mirror's picture
    roomProbe.renderTarget.dispose(); roomEnv?.dispose(); cellarEnv?.dispose(); scene.environment.dispose();
    scene.environment = scene.background = null; scene.onBeforeRender = () => {};
  }

  show(VIEWS.Overview);
  return { groups, show, dispose };
}
