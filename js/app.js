/* ============================================================
   AI RESEARCH UNIVERSE
   OpenAlex high-citation corpus · Anime.js v4
   ============================================================ */
(() => {
  'use strict';

  const D = window.AI_DATA;
  if (!D) {
    document.getElementById('boot')?.remove();
    document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;display:grid;place-items:center;color:#fff;font:14px sans-serif">数据加载失败：请确认 js/data.js 存在。</div>');
    return;
  }

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = $('#universe');
  const ctx = canvas.getContext('2d', { alpha: true });
  const boot = $('#boot');
  const bootProgress = $('#bootProgress');
  const bootStatus = $('#bootStatus');
  const hoverCard = $('#hoverCard');
  const detailPanel = $('#detailPanel');
  const panelBody = $('#panelBody');
  const panelType = $('.panel-type span');
  const insightsEl = $('#insights');
  const insightsGrid = $('#insightsGrid');
  const toastEl = $('#toast');
  const yearRange = $('#yearRange');
  const playBtn = $('#playBtn');
  const yearLabel = $('#yearLabel');
  const eraLabel = $('#eraLabel');
  const yearCountEl = $('#yearCount');
  const cumCountEl = $('#cumCount');
  const zoomLabel = $('#zoomLabel');
  const zoomHelp = $('#zoomHelp');
  const yearGhost = $('#yearGhost');
  const flowListEl = $('#flowList');
  const globeLock = $('#globeLock');
  const globeLockText = $('#globeLockText');
  const lightOptions = $$('.light-option');

  const themeOrder = D.themeOrder;
  const FLOW_ORDER = ['language', 'trust', 'foundations', 'agents', 'science', 'generative', 'vision'];
  const themes = D.themes;
  const themeColor = th => themes[th].color;
  const themeName = th => themes[th].name;
  const allCountryCount = new Set(D.works.flatMap(w => w.countries || [])).size;
  const networkLinks = D.collab.length;
  const growthMap = Object.fromEntries(D.insights.growth.map(g => [g.theme, g]));
  const themeCum = {};
  for (const th of D.themeOrder) {
    let acc = 0;
    themeCum[th] = Array.from({ length: D.meta.yearMax - D.meta.yearMin + 1 }, (_, i) => {
      acc += themes[th].years[String(D.meta.yearMin + i)] || 0;
      return acc;
    });
  }

  const works = D.works.map(w => ({
    ...w,
    p: 1,
    _on: w.year <= D.meta.yearMax,
    _visible: false,
    _alpha: 0,
    _sx: 0, _sy: 0, _size: 0,
    _ox: (Math.sin(w.i * 12.9898) * 9) || 0,
    _oy: (Math.cos(w.i * 4.1414) * 7) || 0,
    _oz: 0
  }));
  const flowPairMap = new Map();
  const flowOut = {}, flowIn = {};
  for (const th of themeOrder) { flowOut[th] = 0; flowIn[th] = 0; }
  for (const [s, t] of D.allEdges) {
    const a = D.works[s], b = D.works[t];
    if (!a || !b || a.theme === b.theme) continue;
    const key = a.theme + '|' + b.theme;
    let p = flowPairMap.get(key);
    if (!p) {
      p = { from: a.theme, to: b.theme, count: 0, papers: new Set() };
      flowPairMap.set(key, p);
    }
    p.count++;
    p.papers.add(s);
    flowOut[a.theme]++;
    flowIn[b.theme]++;
  }
  const flowPairs = [...flowPairMap.values()].map(p => ({ ...p, papers: [...p.papers] }))
    .sort((a, b) => b.count - a.count);
  const flowTotal = flowPairs.reduce((a, b) => a + b.count, 0);
  const flowPairsByKey = new Map(flowPairs.map(p => [p.from + '|' + p.to, p]));
  const flowPairList = flowPairs.slice(0, 8);
  const maxAnnual = D.meta.citationHistoryMax || 1;
  // cumulative citation history per paper, normalized to the last sample year
  for (const w of works) {
    let acc = 0;
    w._cumHist = (w.hist || []).map(v => (acc += v));
    w._finalCum = acc || Math.max(1, Math.round(w.cites * .7));
  }


  const outMap = works.map(() => []);
  const inMap = works.map(() => []);
  for (const [s, t] of D.allEdges) {
    if (outMap[s]) outMap[s].push(t);
    if (inMap[t]) inMap[t].push(s);
  }
  const neighbourSet = i => new Set([...outMap[i], ...inMap[i]]);

  const landVectors = (D.landDots || []).map(([lon, lat]) => vecFromLonLat(lon, lat));
  const countryMap = new Map(D.countries.map(c => [c.code, c]));
  const countryName = code => countryMap.get(code)?.zh || code;
  const countryTheme = code => countryMap.get(code)?.theme || 'foundations';

  const state = {
    view: 'galaxy',
    year: D.meta.yearMax,
    yearFloat: D.meta.yearMax,
    playing: false,
    introActive: true,
    introP: 0,
    booted: false,
    panelOpen: false,
    insightOpen: false,
    selectedTheme: null,
    selectedPaper: null,
    selectedCountry: null,
    flowHoverNode: null,
    flowHoverEdge: null,
    flowSelectedNode: null,
    flowSelectedEdge: null,
    lightMode: 'publish',
    focusKind: null,
    hoverPaper: null,
    hoverCountry: null,
    dragging: false,
    pointerMoved: false,
    skipBoot: reduced
  };

  const camera = {
    yaw: -0.16,
    pitch: -0.18,
    zoom: 0.56,
    zoomTarget: 1.02,
    panX: 0,
    panY: 0,
    focusPoint: null,
    focusWeight: 0
  };

  const globe = {
    yaw: -0.55,
    pitch: 0.16,
    zoom: 1,
    zoomTarget: 1,
    autoSpeed: (Math.PI * 2) / 15,
    locked: false,
    cx: 0,
    cy: 0,
    R: 0
  };

  const flow = {
    rot: -0.14,
    zoom: 1,
    zoomTarget: 1,
    nodes: {},
    arcs: []
  };

  const view = { w: innerWidth, h: innerHeight, dpr: 1, cx: 0, cy: 0, fit: 1 };
  const viewMix = { v: 0 };
  const flowMix = { v: 0 };
  const pulse = { v: 1 };

  const FOCAL = 1120;
  const CAM_DIST = 1460;
  const origin = [0, 0, 0];

  /* ---------------- palette / drawing resources ---------------- */
  function hexRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    const [r, g, b] = hexRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function mixHex(a, b, t = .5) {
    const A = hexRgb(a), B = hexRgb(b);
    return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`;
  }
  function mixRgba(a, b, t = .5, alpha = 1) {
    const A = hexRgb(a), B = hexRgb(b);
    return `rgba(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')},${alpha})`;
  }

  function makeSprite(color) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(.055, 'rgba(255,255,255,.95)');
    grad.addColorStop(.14, rgba(color, .78));
    grad.addColorStop(.32, rgba(color, .22));
    grad.addColorStop(.64, rgba(color, .055));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function makeNebula(color) {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    const blobs = [
      [256, 256, 250, .38],
      [185, 275, 155, .14],
      [335, 220, 145, .12],
      [290, 355, 125, .09],
      [215, 180, 110, .08]
    ];
    for (const [x, y, r, a] of blobs) {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, rgba(color, a));
      grad.addColorStop(.38, rgba(color, a * .48));
      grad.addColorStop(.72, rgba(color, a * .10));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return c;
  }

  const starSprites = {};
  const nebulaSprites = {};
  for (const th of themeOrder) {
    starSprites[th] = makeSprite(themeColor(th));
    nebulaSprites[th] = makeNebula(themeColor(th));
  }

  const coreSprite = (() => {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0, 'rgba(255,255,255,.48)');
    grad.addColorStop(.08, 'rgba(201,225,255,.24)');
    grad.addColorStop(.32, 'rgba(98,153,255,.08)');
    grad.addColorStop(1, 'rgba(78,140,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  })();

  /* ---------------- deterministic helpers ---------------- */
  const rng = (() => {
    let s = 4815162342;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();

  let bgStars = [];
  function buildBackgroundStars() {
    bgStars = [];
    for (let i = 0; i < 280; i++) {
      bgStars.push({
        x: rng(), y: rng(),
        r: .25 + rng() * 1.15,
        a: .06 + rng() * .52,
        phase: rng() * Math.PI * 2,
        drift: 2 + rng() * 7
      });
    }
  }

  const dust = {};
  for (const th of themeOrder) {
    const count = 90 + Math.round(themes[th].count * .72);
    const center = D.themeCenters[th].pos;
    const radius = D.themeCenters[th].r;
    const arr = [];
    for (let i = 0; i < count; i++) {
      const age = Math.pow(rng(), .68);
      const arm = i % 3;
      const theta = arm * (Math.PI * 2 / 3) + age * 2.15 + (rng() - .5) * 1.15;
      const rr = radius * (.08 + age * .98) * (.58 + rng() * .55);
      arr.push([
        center[0] + Math.cos(theta) * rr + (rng() - .5) * 16,
        center[1] + (rng() - .5) * (35 + 40 * (1 - age)) + Math.sin(theta * 1.6) * 5,
        center[2] + Math.sin(theta) * rr * .70 + (rng() - .5) * 12
      ]);
    }
    dust[th] = arr;
  }

  /* ---------------- layout / resize ---------------- */
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view.w = w; view.h = h; view.dpr = dpr;
    view.cx = w * (w > 860 ? .575 : .50);
    view.cy = h * (w > 860 ? .50 : (w > 620 ? .58 : .55));
    view.fit = w > 860
      ? clamp(Math.min(w / 1440, h / 900), .62, 1.08)
      : clamp(w / 1080, .44, .75);
    buildBackgroundStars();
    globe.cx = w * (w > 860 ? .57 : .50);
    globe.cy = h * (w > 860 ? .51 : .53);
    globe.R = w > 860 ? Math.min(w, h) * .305 : Math.min(w * .37, h * .245);
  }

  function projectRaw(x, y, z) {
    const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
    const y1 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    const s = (FOCAL / (CAM_DIST + z2)) * camera.zoom * view.fit;
    return { x: view.cx + x1 * s, y: view.cy + y1 * s, s, z: z2 };
  }
  function project(x, y, z) {
    const p = projectRaw(x, y, z);
    p.x += camera.panX;
    p.y += camera.panY;
    return p;
  }

  function updateFocusPan() {
    if (camera.focusPoint && camera.focusWeight > .003) {
      const raw = projectRaw(camera.focusPoint[0], camera.focusPoint[1], camera.focusPoint[2]);
      const dx = view.w * (state.panelOpen ? .415 : .56) - raw.x;
      const dy = view.h * (state.panelOpen ? .50 : .51) - raw.y;
      const tx = dx * camera.focusWeight;
      const ty = dy * camera.focusWeight;
      camera.panX += (tx - camera.panX) * .105;
      camera.panY += (ty - camera.panY) * .105;
    } else {
      camera.panX += (0 - camera.panX) * .10;
      camera.panY += (0 - camera.panY) * .10;
    }
  }

  /* ---------------- star reveal ---------------- */
  function revealOf(w) {
    if (!state.booted) return 0;
    if (state.introActive) {
      const start = ((w.year - D.meta.yearMin) / (D.meta.yearMax - D.meta.yearMin)) * .62;
      return clamp((state.introP - start) / .34, 0, 1);
    }
    if (w.year > state.year) return 0;
    return w.p;
  }

  function starSize(cites) {
    return 2.0 + Math.pow(Math.log10(cites + 10), 1.68) * .55;
  }

  function citationStats(w, year = state.year) {
    const idx = clamp(year - D.meta.yearMin, 0, D.meta.yearMax - D.meta.yearMin);
    const cum = w._cumHist?.[idx] || 0;
    const annual = w.hist?.[idx] || 0;
    const frac = clamp(cum / Math.max(1, w._finalCum), 0, 1);
    const heat = annual > 0 ? Math.log10(1 + annual) / Math.log10(1 + maxAnnual) : 0;
    const lum = clamp(.16 + .72 * Math.pow(frac, .5) + .16 * Math.pow(heat, .7), 0, 1);
    return { cum, annual, frac, heat, lum };
  }

  function themeDim(th) {
    if (!state.selectedTheme) return 1;
    if (state.selectedTheme === th) return 1;
    return state.focusKind === 'paper' ? .28 : .15;
  }

  /* ---------------- rendering: background ---------------- */
  function drawBackground(now) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const shiftX = Math.sin(camera.yaw) * 7;
    const shiftY = Math.cos(camera.pitch) * 5;
    for (const s of bgStars) {
      const tw = .72 + .28 * Math.sin(now * .00055 + s.phase);
      const x = s.x * view.w + shiftX * (s.drift / 9);
      const y = s.y * view.h + shiftY * (s.drift / 9);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = '#d9e8ff';
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- rendering: galaxy ---------------- */
  function drawGalaxy(alpha) {
    if (alpha <= .01) return;
    const now = performance.now();
    updateFocusPan();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // deep nebula clouds
    for (const th of themeOrder) {
      const center = D.themeCenters[th].pos;
      const p = project(center[0], center[1], center[2]);
      if (p.x < -500 || p.x > view.w + 500 || p.y < -500 || p.y > view.h + 500) continue;
      const dim = themeDim(th);
      const glow = 1 + (themes[th].glow || 0) * .25;
      const size = D.themeCenters[th].r * 3.35 * p.s * glow;
      ctx.globalAlpha = alpha * (.34 * dim + .06);
      ctx.drawImage(nebulaSprites[th], p.x - size / 2, p.y - size / 2, size, size);
    }

    // central halo
    const core = project(0, 0, 0);
    const coreSize = 430 * core.s;
    ctx.globalAlpha = alpha * .48;
    ctx.drawImage(coreSprite, core.x - coreSize / 2, core.y - coreSize / 2, coreSize, coreSize);

    // year pulse rings expanding from the galactic core
    if (pulse.v < .995) {
      const t = 1 - pulse.v;
      ctx.strokeStyle = 'rgba(187,216,255,.32)';
      ctx.lineWidth = 1;
      ctx.globalAlpha = alpha * (1 - t) * .55;
      ctx.beginPath();
      ctx.arc(core.x, core.y, 24 + t * 330, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,150,196,.24)';
      ctx.globalAlpha = alpha * (1 - t) * .38;
      ctx.beginPath();
      ctx.arc(core.x, core.y, 10 + t * 210, 0, Math.PI * 2);
      ctx.stroke();
    }

    // dust
    for (const th of themeOrder) {
      const dim = themeDim(th);
      if (dim < .08) continue;
      const arr = dust[th];
      ctx.beginPath();
      for (let i = 0; i < arr.length; i++) {
        const q = arr[i];
        const p = project(q[0], q[1], q[2]);
        if (p.x < -20 || p.x > view.w + 20 || p.y < -20 || p.y > view.h + 20) continue;
        const sz = .45 + .7 * p.s;
        ctx.rect(p.x, p.y, sz, sz);
      }
      ctx.fillStyle = rgba(themeColor(th), .35);
      ctx.globalAlpha = alpha * (.19 * dim);
      ctx.fill();
    }

    drawLinks(alpha);
    drawStars(alpha, now);

    ctx.restore();
    drawGalaxyLabels();
  }

  function drawLinks(alpha) {
    const groups = new Map();
    for (const [s, t] of D.edges) {
      const a = works[s], b = works[t];
      if (!a._visible || !b._visible) continue;
      const cross = a.theme !== b.theme;
      if (state.selectedTheme && a.theme !== state.selectedTheme && b.theme !== state.selectedTheme) continue;
      let key;
      if (cross) key = 'cross';
      else key = a.theme;
      let group = groups.get(key);
      if (!group) {
        group = new Path2D();
        groups.set(key, group);
      }
      const ax = a._sx, ay = a._sy, bx = b._sx, by = b._sy;
      const dx = bx - ax, dy = by - ay;
      const len = Math.max(1, Math.hypot(dx, dy));
      const off = (((s * 31 + t * 17) % 11) - 5) * .42;
      const mx = (ax + bx) / 2 - (dy / len) * off;
      const my = (ay + by) / 2 + (dx / len) * off;
      group.moveTo(ax, ay);
      group.quadraticCurveTo(mx, my, bx, by);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [key, path] of groups) {
      if (key === 'cross') {
        ctx.strokeStyle = 'rgba(198,216,255,.095)';
        ctx.lineWidth = .62;
      } else {
        const th = key;
        ctx.strokeStyle = rgba(themeColor(th), .16 * themeDim(th));
        ctx.lineWidth = .55;
      }
      ctx.globalAlpha = alpha * (state.selectedTheme ? .62 : 1);
      ctx.stroke(path);
    }
    ctx.restore();

    // bright highlight network
    const focusIndex = state.selectedPaper ?? state.hoverPaper;
    if (focusIndex != null) {
      const neigh = neighbourSet(focusIndex);
      const arr = [...neigh].slice(0, 44);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1.05;
      ctx.shadowBlur = 9;
      for (const j of arr) {
        const w = works[j];
        if (!w._visible) continue;
        const a = works[focusIndex];
        const color = mixHex(themeColor(a.theme), themeColor(w.theme), .45);
        ctx.strokeStyle = mixRgba(themeColor(a.theme), themeColor(w.theme), .45, .52);
        ctx.shadowColor = color;
        const ax = a._sx, ay = a._sy, bx = w._sx, by = w._sy;
        const dx = bx - ax, dy = by - ay;
        const len = Math.max(1, Math.hypot(dx, dy));
        const mx = (ax + bx) / 2 - (dy / len) * 5;
        const my = (ay + by) / 2 + (dx / len) * 5;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(mx, my, bx, by);
        ctx.stroke();
      }
      ctx.restore();
    }

    // travelling citation pulses
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const now = performance.now();
    for (let k = 0; k < 26; k++) {
      const e = D.edges[(k * 137 + 41) % D.edges.length];
      if (!e) continue;
      const a = works[e[0]], b = works[e[1]];
      if (!a._visible || !b._visible) continue;
      const t = (now * .000045 + k * .137) % 1;
      const x = lerp(a._sx, b._sx, t);
      const y = lerp(a._sy, b._sy, t) - Math.sin(t * Math.PI) * 4;
      ctx.globalAlpha = alpha * .36 * Math.sin(Math.PI * t);
      ctx.fillStyle = '#e8f6ff';
      ctx.beginPath();
      ctx.arc(x, y, .9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStars(alpha, now) {
    const vis = [];
    const focusIndex = state.selectedPaper ?? state.hoverPaper;
    const neigh = focusIndex != null ? neighbourSet(focusIndex) : null;
    for (const w of works) {
      const reveal = revealOf(w);
      if (reveal <= .012) { w._visible = false; continue; }
      const prog = 1 - Math.pow(1 - reveal, 3);
      const x = lerp(w._ox, w.pos[0], prog);
      const y = lerp(w._oy, w.pos[1], prog);
      const z = lerp(w._oz, w.pos[2], prog);
      const p = project(x, y, z);
      if (p.x < -80 || p.x > view.w + 80 || p.y < -80 || p.y > view.h + 80) {
        w._visible = false;
        continue;
      }
      const cit = state.lightMode === 'citation' ? citationStats(w) : null;
      let a = reveal * (.52 + .48 * clamp((900 - p.z) / 900, 0, 1));
      a *= themeDim(w.theme);
      if (cit) a *= .28 + .72 * cit.lum;
      if (focusIndex != null) {
        if (w.i === focusIndex) a = 1;
        else if (neigh && neigh.has(w.i)) a = Math.max(a, .72);
        else if (state.selectedPaper != null) a *= .42;
      }
      const effectiveCites = cit ? Math.max(1, cit.cum) : w.cites;
      const size = starSize(effectiveCites) * p.s * (1 + Math.max(0, reveal - .55) * .55) * (cit ? .72 + .28 * cit.lum : 1);
      w._cit = cit;
      w._sx = p.x; w._sy = p.y; w._size = size; w._alpha = a; w._visible = true;
      vis.push({ w, p, size, a });
    }
    vis.sort((A, B) => B.p.z - A.p.z);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const item of vis) {
      const { w, size, a } = item;
      const glow = Math.max(7, size * 3.75 / Math.sqrt(Math.max(1, camera.zoom)));
      ctx.globalAlpha = alpha * a;
      ctx.drawImage(starSprites[w.theme], w._sx - glow / 2, w._sy - glow / 2, glow, glow);
      if (w.cites > 45000) {
        ctx.globalAlpha = alpha * a * .22;
        const halo = glow * 2.35;
        ctx.drawImage(starSprites[w.theme], w._sx - halo / 2, w._sy - halo / 2, halo, halo);
      }
    }

    // rings for focus / neighbours
    if (focusIndex != null) {
      const a = works[focusIndex];
      if (a._visible) {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = rgba(themeColor(a.theme), .95);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(a._sx, a._sy, Math.max(8, a._size + 7 + Math.sin(now * .004) * 1.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha * .58;
        ctx.setLineDash([1, 5]);
        ctx.beginPath();
        ctx.arc(a._sx, a._sy, Math.max(13, a._size + 15), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (state.hoverPaper != null && state.hoverPaper !== state.selectedPaper) {
      const h = works[state.hoverPaper];
      if (h._visible) {
        ctx.globalAlpha = alpha * .9;
        ctx.strokeStyle = 'rgba(238,247,255,.9)';
        ctx.lineWidth = .8;
        ctx.beginPath();
        ctx.arc(h._sx, h._sy, Math.max(7, h._size + 5), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawGalaxyLabels() {
    if (camera.zoom < 1.55) return;
    const per = camera.zoom > 3 ? 5 : camera.zoom > 2.35 ? 3 : 1;
    const boxes = [];
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '500 9.5px "Space Grotesk","PingFang SC",sans-serif';
    const candidates = [];
    if (state.selectedPaper != null) candidates.push(works[state.selectedPaper]);
    for (const th of themeOrder) {
      if (state.selectedTheme && th !== state.selectedTheme) continue;
      for (const idx of (themes[th].papers || []).slice(0, per)) {
        const w = works[idx];
        if (w && !candidates.includes(w)) candidates.push(w);
      }
    }
    for (const w of candidates) {
      if (!w._visible || w._alpha < .25) continue;
      if (!w._sx || !w._sy) continue;
      let title = w.title;
      if (title.length > 43) title = title.slice(0, 41).replace(/\s+\S*$/, '') + '…';
      const tw = ctx.measureText(title).width;
      const lw = tw + 15;
      const lh = 18;
      let x = w._sx + 12;
      let y = w._sy - lh / 2;
      if (x + lw > view.w - 12) x = w._sx - lw - 12;
      if (y < 76) y = 76;
      if (y + lh > view.h - 90) y = view.h - 90 - lh;
      const box = { x, y, w: lw, h: lh };
      if (boxes.some(b => !(x > b.x + b.w || x + lw < b.x || y > b.y + b.h || y + lh < b.y))) continue;
      boxes.push(box);
      const selected = state.selectedPaper === w.i || state.hoverPaper === w.i;
      const color = themeColor(w.theme);
      ctx.globalAlpha = selected ? .98 : .72;
      ctx.strokeStyle = rgba(color, selected ? .55 : .18);
      ctx.lineWidth = .7;
      ctx.beginPath();
      ctx.moveTo(w._sx, w._sy);
      ctx.lineTo(x - 3, y + lh / 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(5,8,18,.72)';
      ctx.beginPath();
      roundRect(ctx, x, y, lw, lh, 4);
      ctx.fill();
      ctx.strokeStyle = rgba(color, selected ? .38 : .10);
      ctx.stroke();
      ctx.fillStyle = selected ? '#ffffff' : 'rgba(219,230,249,.88)';
      ctx.fillText(title, x + 7, y + 12.2);
    }
    ctx.restore();
  }

  function roundRect(g, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  /* ---------------- rendering: globe ---------------- */
  function globeGeo() {
    const w = view.w;
    const targetX = w > 860 ? w * (state.panelOpen ? .405 : .565) : w * .50;
    globe.cx += (targetX - globe.cx) * .085;
    globe.cy += ((view.h * (w > 860 ? .50 : .56)) - globe.cy) * .085;
    const targetR = (w > 860 ? Math.min(view.w, view.h) * .305 : Math.min(view.w * .37, view.h * .245)) * globe.zoom;
    globe.R += (targetR - globe.R) * .10;
    return { cx: globe.cx, cy: globe.cy, R: globe.R };
  }

  function vecFromLonLat(lon, lat) {
    const la = lat * Math.PI / 180;
    const lo = lon * Math.PI / 180;
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  }

  function gProjectVec(v, alt, geo) {
    const s = 1 + alt;
    let x = v[0] * s, y = v[1] * s, z = v[2] * s;
    const cy = Math.cos(globe.yaw), sy = Math.sin(globe.yaw);
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    const cp = Math.cos(globe.pitch), sp = Math.sin(globe.pitch);
    const y1 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return { x: geo.cx + x1 * geo.R, y: geo.cy - y1 * geo.R, z: z2 };
  }

  function gProject(lon, lat, alt = 0, geo) {
    return gProjectVec(vecFromLonLat(lon, lat), alt, geo);
  }

  function slerp(a, b, t) {
    let dot = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
    const omega = Math.acos(dot);
    if (omega < .0002) return [a[0], a[1], a[2]];
    const so = Math.sin(omega);
    const k1 = Math.sin((1 - t) * omega) / so;
    const k2 = Math.sin(t * omega) / so;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  }

  function drawGlobe(alpha) {
    if (alpha <= .01) return;
    const geo = globeGeo();
    const now = performance.now();
    ctx.save();
    ctx.globalAlpha = alpha;

    // atmosphere
    const atmo = ctx.createRadialGradient(geo.cx, geo.cy, geo.R * .78, geo.cx, geo.cy, geo.R * 1.38);
    atmo.addColorStop(0, 'rgba(68,122,210,0)');
    atmo.addColorStop(.56, 'rgba(78,139,235,.06)');
    atmo.addColorStop(.76, 'rgba(78,170,255,.12)');
    atmo.addColorStop(.84, 'rgba(90,195,255,.045)');
    atmo.addColorStop(1, 'rgba(90,195,255,0)');
    ctx.fillStyle = atmo;
    ctx.fillRect(geo.cx - geo.R * 1.5, geo.cy - geo.R * 1.5, geo.R * 3, geo.R * 3);

    // globe sphere
    const sphere = ctx.createRadialGradient(geo.cx - geo.R * .34, geo.cy - geo.R * .40, geo.R * .05, geo.cx, geo.cy, geo.R);
    sphere.addColorStop(0, 'rgba(29,49,91,.44)');
    sphere.addColorStop(.55, 'rgba(12,24,52,.52)');
    sphere.addColorStop(.92, 'rgba(5,10,24,.68)');
    sphere.addColorStop(1, 'rgba(43,92,156,.22)');
    ctx.beginPath();
    ctx.arc(geo.cx, geo.cy, geo.R, 0, Math.PI * 2);
    ctx.fillStyle = sphere;
    ctx.fill();
    ctx.strokeStyle = 'rgba(124,180,255,.30)';
    ctx.lineWidth = .8;
    ctx.stroke();

    // orbital dashed rings
    ctx.save();
    ctx.translate(geo.cx, geo.cy);
    ctx.rotate(-.24);
    ctx.strokeStyle = 'rgba(124,177,255,.12)';
    ctx.lineWidth = .6;
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.ellipse(0, 0, geo.R * 1.16, geo.R * .38, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(.47);
    ctx.strokeStyle = 'rgba(255,152,191,.08)';
    ctx.beginPath();
    ctx.ellipse(0, 0, geo.R * 1.23, geo.R * .30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);

    // land dot matrix, drawn on the sphere surface
    if (landVectors.length) {
      const path = new Path2D();
      for (const v of landVectors) {
        const p = gProjectVec(v, 0, geo);
        if (p.z <= .025) continue;
        path.rect(p.x - .62, p.y - .62, 1.24, 1.24);
      }
      ctx.save();
      ctx.fillStyle = '#a6c9ff';
      ctx.globalAlpha = alpha * .36;
      ctx.fill(path);
      ctx.restore();
    }

    // graticule
    ctx.save();
    ctx.strokeStyle = 'rgba(121,170,247,.105)';
    ctx.lineWidth = .6;
    for (let lat = -60; lat <= 60; lat += 30) {
      let started = false;
      ctx.beginPath();
      for (let lon = -180; lon <= 180; lon += 4) {
        const p = gProject(lon, lat, 0, geo);
        if (p.z < -.04) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    for (let lon = -180; lon < 180; lon += 30) {
      let started = false;
      ctx.beginPath();
      for (let lat = -86; lat <= 86; lat += 4) {
        const p = gProject(lon, lat, 0, geo);
        if (p.z < -.04) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // collaboration arcs
    const selected = state.selectedCountry;
    const edges = D.collab
      .filter(([a, b]) => !selected || a === selected || b === selected)
      .sort((a, b) => b[2] - a[2])
      .slice(0, selected ? 24 : 105);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [aCode, bCode, n] of edges) {
      const a = countryMap.get(aCode), b = countryMap.get(bCode);
      if (!a || !b) continue;
      const va = vecFromLonLat(a.lon, a.lat);
      const vb = vecFromLonLat(b.lon, b.lat);
      const dim = state.selectedTheme && a.theme !== state.selectedTheme && b.theme !== state.selectedTheme;
      if (dim && !selected) continue;
      const col = mixHex(themeColor(a.theme), themeColor(b.theme), .5);
      const maxN = selected ? 40 : 24;
      const lift = .028 + .20 * Math.min(1, n / maxN);
      ctx.strokeStyle = mixRgba(themeColor(a.theme), themeColor(b.theme), .5, selected ? .48 : .13 + Math.min(.12, n * .004));
      ctx.lineWidth = selected ? .85 + Math.min(1.4, n * .045) : .45 + Math.min(1, n * .04);
      ctx.beginPath();
      let began = false;
      for (let i = 0; i <= 28; i++) {
        const t = i / 28;
        const v = slerp(va, vb, t);
        const alt = lift * Math.sin(Math.PI * t);
        const p = gProjectVec(v, alt, geo);
        if (p.z < -.06) { began = false; continue; }
        if (!began) { ctx.moveTo(p.x, p.y); began = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // country nodes
    const nodes = [];
    for (const c of D.countries) {
      const p = gProject(c.lon, c.lat, .005, geo);
      const dimTheme = state.selectedTheme && c.theme !== state.selectedTheme;
      let a = p.z > 0 ? 1 : .11;
      if (dimTheme) a *= .15;
      if (selected) {
        if (c.code === selected) a = 1;
        else a *= .28;
      }
      const r = 3.2 + Math.sqrt(c.count) * 1.28;
      nodes.push({ c, p, a, r });
    }
    nodes.sort((A, B) => A.p.z - B.p.z);
    for (const node of nodes) {
      const { c, p, a, r } = node;
      if (p.x < -40 || p.x > view.w + 40 || p.y < -40 || p.y > view.h + 40) continue;
      const color = themeColor(c.theme);
      const glow = r * 7.5;
      ctx.globalAlpha = alpha * a * (p.z > 0 ? .9 : .3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(starSprites[c.theme], p.x - glow / 2, p.y - glow / 2, glow, glow);
      ctx.globalAlpha = alpha * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.3, r * .30), 0, Math.PI * 2);
      ctx.fillStyle = p.z > 0 ? '#ffffff' : rgba(color, .5);
      ctx.fill();
      if (selected === c.code) {
        ctx.strokeStyle = rgba(color, .95);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 7 + Math.sin(now * .004) * 1.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([1, 5]);
        ctx.globalAlpha = alpha * .6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      c._gx = p.x; c._gy = p.y; c._gz = p.z; c._gr = r; c._ga = a;
    }
    ctx.globalCompositeOperation = 'source-over';
    drawCountryLabels(alpha, nodes, geo);
    ctx.restore();
  }

  function drawCountryLabels(alpha, nodes, geo) {
    const selected = state.selectedCountry;
    const boxes = [];
    ctx.save();
    ctx.font = '500 9.5px "Space Grotesk","PingFang SC",sans-serif';
    const front = nodes
      .filter(n => n.p.z > .03 && n.a > .12)
      .sort((a, b) => b.c.count - a.c.count);
    const limit = view.w < 520 ? 8 : (globe.zoom > 1.2 ? 24 : 15);
    let count = 0;
    for (const node of front) {
      if (count >= limit && node.c.code !== selected) continue;
      const { c, p, r } = node;
      const isSel = selected === c.code;
      const text = c.zh;
      const tw = ctx.measureText(text).width;
      const bw = tw + 23;
      const bh = 17;
      let x = p.x + r + 8;
      let y = p.y - bh / 2;
      if (x + bw > view.w - 14) x = p.x - r - bw - 8;
      if (y < 74) y = 74;
      if (y > view.h - 96) y = view.h - 96;
      const box = { x, y, w: bw, h: bh };
      if (!isSel && boxes.some(b => !(x > b.x + b.w || x + bw < b.x || y > b.y + b.h || y + bh < b.y))) continue;
      boxes.push(box);
      if (!isSel && count >= limit) continue;
      count++;
      const color = themeColor(c.theme);
      ctx.globalAlpha = alpha * (isSel ? 1 : .88);
      ctx.strokeStyle = rgba(color, isSel ? .65 : .24);
      ctx.lineWidth = .7;
      ctx.beginPath();
      ctx.moveTo(p.x + (x > p.x ? r + 2 : -r - 2), p.y);
      ctx.lineTo(x + (x > p.x ? -3 : bw + 3), y + bh / 2);
      ctx.stroke();
      ctx.fillStyle = isSel ? 'rgba(12,16,31,.92)' : 'rgba(6,9,19,.72)';
      roundRect(ctx, x, y, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = rgba(color, isSel ? .48 : .13);
      ctx.stroke();
      ctx.fillStyle = isSel ? '#ffffff' : 'rgba(227,235,251,.9)';
      ctx.fillText(text, x + 7, y + 11.6);
      ctx.fillStyle = rgba(color, isSel ? .95 : .62);
      ctx.font = '400 7px "Space Grotesk",monospace';
      ctx.fillText(String(c.count), x + tw + 11, y + 11.3);
      ctx.font = '500 9.5px "Space Grotesk","PingFang SC",sans-serif';
    }
    ctx.restore();
  }


  /* ---------------- rendering: cross-theme flows ---------------- */
  function flowLayout() {
    const w = view.w, h = view.h;
    const cx = w * (w > 860 ? (state.panelOpen ? .415 : .565) : .50);
    const cy = h * (w > 860 ? .50 : (w > 620 ? .56 : .55));
    const R = (w > 860 ? Math.min(w * .28, h * .30) : Math.min(w * .34, h * .25)) * flow.zoom;
    const nodes = {};
    FLOW_ORDER.forEach((th, i) => {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / 7 + flow.rot;
      const r = 14 + Math.sqrt(themes[th].count) * 1.65;
      nodes[th] = {
        x: cx + Math.cos(angle) * R,
        y: cy + Math.sin(angle) * R,
        r, angle
      };
    });
    flow.nodes = nodes;
    return { cx, cy, R };
  }

  function quadPoint(ax, ay, cx, cy, bx, by, t) {
    const u = 1 - t;
    return {
      x: u * u * ax + 2 * u * t * cx + t * t * bx,
      y: u * u * ay + 2 * u * t * cy + t * t * by
    };
  }

  function drawFlow(alpha) {
    if (alpha <= .01) return;
    const geo = flowLayout();
    const nodes = flow.nodes;
    const now = performance.now();
    const activeNode = state.selectedTheme || state.flowHoverNode || state.flowSelectedNode;
    const activeEdge = state.flowSelectedEdge || state.flowHoverEdge;
    const maxFlow = flowPairs[0]?.count || 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    // outer rings
    ctx.strokeStyle = 'rgba(146,174,240,.11)';
    ctx.lineWidth = .7;
    ctx.setLineDash([2, 7]);
    ctx.beginPath();
    ctx.arc(geo.cx, geo.cy, geo.R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(146,174,240,.045)';
    ctx.beginPath();
    ctx.arc(geo.cx, geo.cy, geo.R * 1.16, 0, Math.PI * 2);
    ctx.stroke();
    // ring tick marks
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 7 + flow.rot;
      ctx.strokeStyle = 'rgba(146,174,240,.10)';
      ctx.beginPath();
      ctx.moveTo(geo.cx + Math.cos(a) * (geo.R - 4), geo.cy + Math.sin(a) * (geo.R - 4));
      ctx.lineTo(geo.cx + Math.cos(a) * (geo.R + 6), geo.cy + Math.sin(a) * (geo.R + 6));
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'lighter';
    const arcs = [];
    // draw small flows first, big flows on top
    const ordered = flowPairs.slice().sort((a, b) => a.count - b.count);
    ordered.forEach((pair, k) => {
      ctx.globalAlpha = alpha;
      const A = nodes[pair.from], B = nodes[pair.to];
      if (!A || !B) return;
      const isActive = activeNode
        ? (pair.from === activeNode || pair.to === activeNode)
        : true;
      const edgeActive = activeEdge && activeEdge.from === pair.from && activeEdge.to === pair.to;
      const dim = (activeNode && !isActive) || (activeEdge && !edgeActive);
      if (dim) return;
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / len, uy = dy / len;
      const ax = A.x + ux * (A.r + 3), ay = A.y + uy * (A.r + 3);
      const bx = B.x - ux * (B.r + 5), by = B.y - uy * (B.r + 5);
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const side = FLOW_ORDER.indexOf(pair.from) < FLOW_ORDER.indexOf(pair.to) ? 1 : -1;
      const bow = (14 + 20 * Math.min(1, pair.count / maxFlow)) * side;
      const qx = geo.cx + (mx - geo.cx) * .40 - (dy / len) * bow;
      const qy = geo.cy + (my - geo.cy) * .40 + (dx / len) * bow;
      const strength = pair.count / maxFlow;
      const isHot = edgeActive || (activeNode && (pair.from === activeNode || pair.to === activeNode));
      const col = themeColor(pair.from);
      ctx.strokeStyle = rgba(col, isHot ? .62 : .075 + strength * .23);
      ctx.lineWidth = isHot ? 1.5 + strength * 2.2 : .55 + Math.sqrt(pair.count) * .28;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(qx, qy, bx, by);
      ctx.stroke();

      // direction chevron
      if (isHot || pair.count > 140) {
        const t = .82;
        const p1 = quadPoint(ax, ay, qx, qy, bx, by, t - .02);
        const p2 = quadPoint(ax, ay, qx, qy, bx, by, t + .02);
        const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const p = quadPoint(ax, ay, qx, qy, bx, by, t);
        ctx.save();
        ctx.fillStyle = isHot ? '#ffffff' : rgba(col, .78);
        ctx.strokeStyle = rgba(col, .9);
        ctx.lineWidth = .6;
        ctx.globalAlpha = alpha * (isHot ? 1 : .72);
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(ang) * 7, p.y + Math.sin(ang) * 7);
        ctx.lineTo(p.x + Math.cos(ang + 2.45) * 5, p.y + Math.sin(ang + 2.45) * 5);
        ctx.lineTo(p.x + Math.cos(ang - 2.45) * 5, p.y + Math.sin(ang - 2.45) * 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // flowing pulse
      if (isHot || pair.count > 180) {
        const t = (now * .000045 + k * .13) % 1;
        const p = quadPoint(ax, ay, qx, qy, bx, by, t);
        ctx.globalAlpha = alpha * (isHot ? .8 : .4) * Math.sin(Math.PI * t);
        ctx.fillStyle = '#f0f7ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, isHot ? 1.6 : 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      arcs.push({ ...pair, ax, ay, bx, by, qx, qy, isHot });
    });
    flow.arcs = arcs;

    // nodes
    for (const th of FLOW_ORDER) {
      const n = nodes[th];
      if (!n) continue;
      const dim = activeNode && th !== activeNode;
      const a = dim ? .38 : 1;
      const hovered = state.flowHoverNode === th || state.flowSelectedNode === th;
      const glow = n.r * (hovered ? 7 : 5.4);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * a * (hovered ? 1 : .85);
      ctx.drawImage(starSprites[th], n.x - glow / 2, n.y - glow / 2, glow, glow);
      ctx.globalAlpha = alpha * a;
      ctx.beginPath();
      ctx.arc(n.x, n.y, Math.max(2.5, n.r * .26), 0, Math.PI * 2);
      ctx.fillStyle = hovered ? '#ffffff' : '#eaf3ff';
      ctx.fill();
      ctx.strokeStyle = rgba(themeColor(th), dim ? .16 : .55);
      ctx.lineWidth = .9;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + 3, 0, Math.PI * 2);
      ctx.stroke();
      if (hovered) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = alpha * .8;
        ctx.setLineDash([1, 4]);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 10 + Math.sin(now * .004) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    drawFlowLabels(alpha);
    ctx.restore();
  }

  function drawFlowLabels(alpha) {
    const nodes = flow.nodes;
    const activeNode = state.selectedTheme || state.flowHoverNode || state.flowSelectedNode;
    const boxes = [];
    ctx.save();
    ctx.font = '500 10px "Space Grotesk","PingFang SC",sans-serif';
    for (const th of FLOW_ORDER) {
      const n = nodes[th];
      if (!n) continue;
      const dim = activeNode && th !== activeNode;
      const hovered = state.flowHoverNode === th || state.flowSelectedNode === th;
      const name = themeName(th);
      const count = String(themes[th].count);
      const tw = ctx.measureText(name).width;
      const bw = tw + 28;
      const bh = 20;
      const co = Math.cos(n.angle);
      const dx = co > .25 ? 1 : co < -.25 ? -1 : 0;
      let x = n.x + co * (n.r + 16) + (dx === 1 ? 3 : dx === -1 ? -bw - 3 : -bw / 2);
      let y = n.y + Math.sin(n.angle) * (n.r + 15) - bh / 2;
      x = clamp(x, 8, view.w - bw - 8);
      y = clamp(y, 76, view.h - 96);
      const box = { x, y, w: bw, h: bh };
      if (!hovered && boxes.some(b => !(x > b.x + b.w || x + bw < b.x || y > b.y + b.h || y + bh < b.y))) continue;
      boxes.push(box);
      ctx.globalAlpha = alpha * (dim ? .48 : hovered ? 1 : .86);
      ctx.fillStyle = dim ? 'rgba(6,9,19,.55)' : 'rgba(6,9,19,.72)';
      roundRect(ctx, x, y, bw, bh, 5);
      ctx.fill();
      ctx.strokeStyle = rgba(themeColor(th), dim ? .22 : hovered ? .55 : .18);
      ctx.lineWidth = .7;
      ctx.stroke();
      ctx.fillStyle = dim ? 'rgba(215,226,246,.62)' : hovered ? '#ffffff' : 'rgba(227,235,251,.9)';
      ctx.fillText(name, x + 8, y + 13.5);
      ctx.fillStyle = rgba(themeColor(th), dim ? .48 : .85);
      ctx.font = '400 7.5px "Space Grotesk",monospace';
      ctx.fillText(count, x + tw + 13, y + 13.2);
      ctx.font = '500 10px "Space Grotesk","PingFang SC",sans-serif';
    }
    ctx.restore();
  }

  function findFlowNode(x, y) {
    for (const th of FLOW_ORDER) {
      const n = flow.nodes[th];
      if (!n) continue;
      if (Math.hypot(x - n.x, y - n.y) < n.r + 9) return th;
    }
    return null;
  }

  function findFlowEdge(x, y) {
    let best = null, bestD = 9;
    for (const arc of flow.arcs) {
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const p = quadPoint(arc.ax, arc.ay, arc.qx, arc.qy, arc.bx, arc.by, t);
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < bestD) { bestD = d; best = arc; }
      }
    }
    return best;
  }

  function hoverContentFlowNode(th) {
    hoverCard.style.setProperty('--hc', themeColor(th));
    $('.hover-kicker span', hoverCard).textContent = 'THEME NODE';
    $('.hover-title', hoverCard).textContent = themeName(th);
    $('.hover-meta', hoverCard).textContent = `${themes[th].count} 篇论文 · 流出 ${formatFull(flowOut[th])} · 流入 ${formatFull(flowIn[th])} 次跨域引用`;
  }

  function hoverContentFlowEdge(arc) {
    hoverCard.style.setProperty('--hc', themeColor(arc.from));
    $('.hover-kicker span', hoverCard).textContent = 'CROSS-THEME FLOW';
    $('.hover-title', hoverCard).textContent = `${themeName(arc.from)} → ${themeName(arc.to)}`;
    $('.hover-meta', hoverCard).textContent = `${formatFull(arc.count)} 次跨域引用 · 点击查看桥梁论文`;
  }

  /* ---------------- labels: cluster ---------------- */
  const labelOffsets = {
    foundations: [0, -.72], language: [.30, -.72], vision: [-.34, -.70], agents: [-.32, -.66],
    trust: [.20, -.70], generative: [.30, -.72], science: [0, -.72]
  };
  const clusterLabelEls = {};
  function buildClusterLabels() {
    const root = $('#clusterLabels');
    root.innerHTML = '';
    for (const th of themeOrder) {
      const el = document.createElement('button');
      el.className = 'cluster-label';
      el.dataset.theme = th;
      el.style.setProperty('--c', themeColor(th));
      el.innerHTML = `<i class="cl-dot"></i><span class="cl-name">${themeName(th)}</span><span class="cl-meta">${themes[th].count}</span><span class="cl-arrow">↗</span>`;
      el.title = `聚焦 ${themeName(th)}`;
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (state.view !== 'galaxy') return;
        if (state.selectedTheme === th && !state.panelOpen) resetSelection();
        else focusTheme(th);
      });
      root.appendChild(el);
      clusterLabelEls[th] = el;
    }
  }

  function updateClusterLabels() {
    const hidden = state.view !== 'galaxy' || viewMix.v > .15 || flowMix.v > .15 || !state.booted;
    for (const th of themeOrder) {
      const el = clusterLabelEls[th];
      if (!el) continue;
      if (hidden) {
        el.style.opacity = 0;
        el.style.pointerEvents = 'none';
        continue;
      }
      const center = D.themeCenters[th].pos;
      const p = project(center[0], center[1], center[2]);
      const off = labelOffsets[th] || [0, 0];
      if (p.x < -100 || p.x > view.w + 100 || p.y < -60 || p.y > view.h + 60) {
        el.style.opacity = 0;
        el.style.pointerEvents = 'none';
        continue;
      }
      const rr = D.themeCenters[th].r * p.s;
      const x = clamp(p.x + off[0] * rr, 70, view.w - 70);
      const y = clamp(p.y + off[1] * rr, 84, view.h - 96);
      el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      if (el._metaYear !== state.year) {
        el._metaYear = state.year;
        const meta = el.querySelector('.cl-meta');
        if (meta) {
          const cum = themeCum[th]?.[state.year - D.meta.yearMin] ?? themes[th].count;
          meta.textContent = state.year < D.meta.yearMax ? `${cum} / ${themes[th].count}` : String(themes[th].count);
        }
      }
      const dim = state.selectedTheme && state.selectedTheme !== th;
      el.style.opacity = dim ? .16 : (state.focused ? .75 : 1);
      el.style.pointerEvents = 'auto';
      el.classList.toggle('is-dim', !!dim);
    }
  }

  /* ---------------- legends / stats ---------------- */
  function buildLegend(root) {
    root.innerHTML = '';
    for (const th of themeOrder) {
      const b = document.createElement('button');
      b.className = 'legend-item';
      b.dataset.theme = th;
      b.style.setProperty('--c', themeColor(th));
      b.innerHTML = `<i class="legend-dot"></i><span class="legend-name">${themeName(th)}</span><span class="legend-short">${themes[th].short}</span><span class="legend-count">${themes[th].count}</span><span class="legend-arrow">↗</span>`;
      b.addEventListener('click', e => {
        e.stopPropagation();
        toggleTheme(th);
      });
      root.appendChild(b);
    }
  }

  function syncLegend() {
    $$('.legend-item').forEach(el => {
      el.classList.toggle('is-active', el.dataset.theme === state.selectedTheme);
      el.setAttribute('aria-pressed', el.dataset.theme === state.selectedTheme ? 'true' : 'false');
    });
  }

  function setStat(name, value) {
    $$(`[data-stat="${name}"]`).forEach(el => el.textContent = value);
  }

  function formatNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'k';
    return Number(n).toLocaleString('en-US');
  }
  function formatFull(n) { return Number(n).toLocaleString('en-US'); }

  function fillIntroStats() {
    setStat('works', formatFull(D.meta.works));
    setStat('citations', formatNum(D.meta.citations));
    setStat('countries', allCountryCount);
    setStat('networkNodes', D.countries.length);
    setStat('networkLinks', networkLinks);
    setStat('networkCountries', allCountryCount);
    setStat('flowPairs', String(flowPairs.length));
    setStat('flowEdges', formatFull(flowTotal));
    setStat('flowShare', ((flowTotal / Math.max(1, D.allEdges.length)) * 100).toFixed(1) + '%');
    const totalField = Object.values(D.meta.fieldCounts || {}).reduce((a, b) => a + b, 0);
    const method = $('.method');
    if (method) method.innerHTML = `OpenAlex 开放数据 · CC0<br>${(totalField / 1e6).toFixed(2)}M 条领域记录抽取 · ${D.meta.works} 篇高被引样本<br><span style="color:#65708d">Anime.js v4 · Canvas 2D</span>`;
  }

  function buildFlowList() {
    if (!flowListEl) return;
    flowListEl.innerHTML = flowPairList.slice(0, 5).map(p => `
      <button class="flow-list-item" data-from="${p.from}" data-to="${p.to}">
        <span class="fl-from" style="--c:${themeColor(p.from)}"><i></i>${esc(themeName(p.from))}</span>
        <span class="fl-arrow">→</span>
        <span class="fl-to" style="--c:${themeColor(p.to)}"><i></i>${esc(themeName(p.to))}</span>
        <span class="fl-count">${formatFull(p.count)}</span>
        <span class="fl-open">↗</span>
      </button>`).join('');
    flowListEl.addEventListener('click', e => {
      const b = e.target.closest('[data-from]');
      if (!b) return;
      selectFlowEdge(b.dataset.from, b.dataset.to);
    });
  }

  function syncLightMode() {
    for (const b of lightOptions) {
      const active = b.dataset.light === state.lightMode;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function setLightMode(mode) {
    if (mode !== 'publish' && mode !== 'citation') return;
    if (state.introActive) finishIntro();
    state.lightMode = mode;
    syncLightMode();
    toast(mode === 'citation'
      ? '引用点亮：星光会随被引用历史逐年累积'
      : '论文点亮：论文诞生即呈现全部亮度');
  }

  /* ---------------- year / playback ---------------- */
  const eraFor = y => (
    y <= 2014 ? '深度学习复兴' :
    y <= 2017 ? '注意力机制' :
    y <= 2020 ? '预训练时代' :
    y <= 2022 ? '生成式爆发' :
    y <= 2024 ? '对齐与多模态' : '推理与智能体'
  );

  function updateTimelineUI() {
    const y = state.year;
    yearLabel.textContent = String(y);
    eraLabel.textContent = eraFor(y);
    yearRange.value = String(y);
    const pct = ((y - D.meta.yearMin) / (D.meta.yearMax - D.meta.yearMin)) * 100;
    yearRange.style.setProperty('--progress', pct.toFixed(1) + '%');
    const current = works.filter(w => w.year === y).length;
    const cum = works.filter(w => w.year <= y).length;
    yearCountEl.textContent = String(current);
    cumCountEl.textContent = String(cum);
  }

  function setYear(y, animate = false, init = false) {
    y = clamp(Math.round(y), D.meta.yearMin, D.meta.yearMax);
    if (state.introActive && !init) finishIntro();
    const prev = state.year;
    state.year = y;
    state.yearFloat = y;
    const batch = [];
    for (const w of works) {
      const should = w.year <= y;
      if (should && !w._on) {
        w._on = true;
        w.p = 0;
        batch.push(w);
      } else if (!should) {
        w._on = false;
        w.p = 0;
      }
    }
    if (batch.length) {
      if (animate && y > prev) {
        anime.animate(batch, {
          p: 1,
          duration: 980,
          delay: anime.stagger(8),
          ease: 'outExpo'
        });
      } else {
        for (const w of batch) w.p = 1;
      }
    }
    if (animate && y !== prev) {
      triggerPulse(y);
      ghostYear(y);
    }
    updateTimelineUI();
  }

  function triggerPulse(y) {
    pulse.v = 1;
    anime.animate(pulse, { v: 0, duration: 1600, ease: 'outExpo' });
    const recent = works.filter(w => w.year === y);
    const touched = new Set(recent.map(w => w.theme));
    for (const th of touched) {
      themes[th].glow = 1;
      anime.animate(themes[th], { glow: 0, duration: 2100, ease: 'outExpo' });
    }
  }

  function ghostYear(y) {
    yearGhost.textContent = String(y);
    yearGhost.style.opacity = 0;
    anime.animate(yearGhost, { opacity: [.20, 0], duration: 900, ease: 'outExpo' });
  }

  function syncPlayButton() {
    playBtn.classList.toggle('is-playing', state.playing);
    playBtn.setAttribute('aria-pressed', state.playing ? 'true' : 'false');
    playBtn.setAttribute('aria-label', state.playing ? '暂停时间演化' : '播放时间演化');
  }

  let playAnim = null;
  function togglePlay() {
    if (state.introActive) finishIntro();
    if (state.playing) {
      state.playing = false;
      if (playAnim) playAnim.pause();
      syncPlayButton();
      return;
    }
    if (state.year >= D.meta.yearMax) setYear(D.meta.yearMin, false);
    state.playing = true;
    state.yearFloat = state.year;
    syncPlayButton();
    const remaining = D.meta.yearMax - state.year;
    playAnim = anime.animate(state, {
      yearFloat: D.meta.yearMax,
      duration: Math.max(850, remaining * 1060),
      ease: 'linear',
      onUpdate: () => {
        const y = Math.min(D.meta.yearMax, Math.floor(state.yearFloat + 1e-5));
        if (y !== state.year) setYear(y, true);
      },
      onComplete: () => {
        state.playing = false;
        state.yearFloat = D.meta.yearMax;
        setYear(D.meta.yearMax, true);
        syncPlayButton();
      }
    });
  }

  /* ---------------- intro / boot ---------------- */
  let introAnim = null;
  function finishIntro() {
    if (!state.introActive) return;
    state.introActive = false;
    state.introP = 1;
    if (introAnim) introAnim.pause();
    for (const w of works) w.p = 1;
    setYear(state.year, false);
    updateTimelineUI();
  }

  function startIntro() {
    state.booted = true;
    if (reduced) {
      state.introActive = false;
      state.introP = 1;
      for (const w of works) w.p = 1;
      setYear(D.meta.yearMax, false);
      return;
    }
    state.introActive = true;
    state.introP = 0;
    introAnim = anime.animate(state, {
      introP: 1,
      duration: 2900,
      ease: 'inOutSine',
      onComplete: finishIntro
    });
    anime.animate('.hud-in', {
      opacity: [0, 1],
      duration: 1100,
      delay: anime.stagger(38),
      ease: 'outExpo'
    });
    anime.animate('#pageGalaxy .title-row > span', {
      translateY: ['110%', '0%'],
      duration: 1250,
      delay: anime.stagger(110, { start: 120 }),
      ease: 'outExpo'
    });
    anime.animate('#pageGalaxy .lede, #pageGalaxy .stat-row, #pageGalaxy .legend-head, #pageGalaxy .legend, #pageGalaxy .method', {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 900,
      delay: anime.stagger(60, { start: 400 }),
      ease: 'outExpo'
    });
  }

  function bootSequence() {
    const bar = { v: 0 };
    anime.animate(bar, {
      v: 1,
      duration: reduced ? 80 : 950,
      ease: 'inOutQuart',
      onUpdate: () => { bootProgress.style.width = (bar.v * 100).toFixed(1) + '%'; },
      onComplete: () => {
        boot.classList.add('is-done');
        startIntro();
        setTimeout(() => boot.remove(), 1000);
      }
    });
    const messages = ['连接开放科研图谱', '解析 945 篇高被引论文', '绘制 9,111 条引用关系'];
    let mi = 0;
    const timer = setInterval(() => {
      mi++;
      if (mi >= messages.length) { clearInterval(timer); return; }
      bootStatus.textContent = messages[mi];
    }, 380);
  }

  /* ---------------- theme focus ---------------- */
  function toggleTheme(th) {
    if (state.view === 'countries') {
      state.selectedTheme = state.selectedTheme === th ? null : th;
      syncLegend();
      updateClusterLabels();
      toast(state.selectedTheme ? `已高亮：${themeName(th)}` : '已恢复全部主题');
      return;
    }
    if (state.selectedTheme === th && state.panelOpen) {
      resetSelection();
      return;
    }
    focusTheme(th);
  }

  function focusTheme(th) {
    if (state.introActive) finishIntro();
    state.view = 'galaxy';
    state.selectedTheme = th;
    state.selectedPaper = null;
    state.focusKind = 'theme';
    state.panelOpen = true;
    camera.focusPoint = D.themeCenters[th].pos;
    camera.zoomTarget = 1.62;
    anime.animate(camera, { focusWeight: 1, duration: 1050, ease: 'outExpo' });
    document.body.classList.add('focused', 'panel-open');
    syncLegend();
    renderThemePanel(th);
    openPanelUI();
  }

  function resetSelection() {
    closePanel();
  }

  /* ---------------- panel ---------------- */
  function openPanelUI() {
    state.panelOpen = true;
    detailPanel.classList.add('is-open');
    document.body.classList.add('panel-open', 'focused');
  }

  function closePanel() {
    if (!state.panelOpen) {
      state.selectedTheme = null;
      state.selectedCountry = null;
      state.selectedPaper = null;
      state.flowSelectedNode = null;
      state.flowSelectedEdge = null;
      state.focusKind = null;
      syncLegend();
      resetCameraOnly();
      updateClusterLabels();
      return;
    }
    state.panelOpen = false;
    detailPanel.classList.remove('is-open');
    document.body.classList.remove('panel-open', 'focused');
    state.selectedPaper = null;
    state.selectedTheme = null;
    state.selectedCountry = null;
    state.flowSelectedNode = null;
    state.flowSelectedEdge = null;
    state.focusKind = null;
    syncLegend();
    resetCameraOnly();
    updateClusterLabels();
    if (state.view === 'countries') {
      // let the globe breathe again
    }
  }

  function resetCameraOnly() {
    camera.focusPoint = null;
    camera.zoomTarget = 1.02;
    anime.animate(camera, { focusWeight: 0, duration: 900, ease: 'outExpo' });
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function attr(s) { return esc(s).replace(/`/g, '&#96;'); }

  function authorLine(w) {
    const auth = w.authors || [];
    if (!auth.length) return '作者信息未收录';
    const extra = (w.nAuthors || auth.length) - auth.length;
    return esc(auth.join(', ')) + (extra > 0 ? ` 等 ${w.nAuthors} 位作者` : '');
  }

  function renderPaperPanel(i) {
    const w = works[i];
    const th = w.theme;
    const color = themeColor(th);
    detailPanel.style.setProperty('--panel-accent', color);
    detailPanel.style.setProperty('--paper-accent', color);
    panelType.textContent = '论文档案';
    const refs = outMap[i].slice().sort((a, b) => works[b].cites - works[a].cites).slice(0, 3);
    const citers = inMap[i].slice().sort((a, b) => works[b].cites - works[a].cites).slice(0, 3);
    const link = w.doi ? `https://doi.org/${w.doi}` : (w.oa || 'https://openalex.org/');
    const countriesText = (w.countries || []).slice(0, 4).join(' · ') || '未标注';
    const tags = [
      `<span class="tag">${esc(themes[th].en)}</span>`,
      `<span class="tag">${w.year}</span>`,
      `<span class="tag">${esc(w.type || 'article').toUpperCase()}</span>`
    ];
    if (w.open) tags.push('<span class="tag">OPEN ACCESS</span>');

    const networkRows = [];
    for (const j of refs) {
      const x = works[j];
      networkRows.push(`<button class="network-row" data-paper="${j}"><i></i><span>${esc(x.title)}</span><em>REF · ${x.year}</em></button>`);
    }
    for (const j of citers) {
      const x = works[j];
      networkRows.push(`<button class="network-row" data-paper="${j}"><i></i><span>${esc(x.title)}</span><em>CITED · ${x.year}</em></button>`);
    }

    panelBody.innerHTML = `
      <div class="paper-kicker" style="--paper-accent:${color}">PAPER / ${w.year} / ${esc(themes[th].en)}</div>
      <h2 class="paper-title">${esc(w.title)}</h2>
      <p class="paper-authors">${authorLine(w)}</p>
      <div class="paper-tags">${tags.join('')}</div>
      <div class="meta-grid">
        <div class="meta-cell"><span>被引次数</span><b>${formatFull(w.cites)}</b></div>
        <div class="meta-cell"><span>样本内引用</span><b>${outMap[i].length} / ${inMap[i].length}</b></div>
        <div class="meta-cell"><span>发表年份</span><b>${w.year}</b></div>
        <div class="meta-cell"><span>国家 / 地区</span><b>${w.countries?.length || 0}</b></div>
      </div>
      <div class="topic-line">OpenAlex Topic · <b>${esc(w.topic || '未分类')}</b><br>${esc(countriesText)}</div>
      <div class="abstract-label"><span>摘要</span><em>ABSTRACT</em></div>
      <p class="abstract-text ${w.abs ? '' : 'is-empty'}">${w.abs ? esc(w.abs) : '该记录暂无可用摘要。'}</p>
      <div class="network-block">
        <div class="network-title"><span>样本内引用网络</span><b>${outMap[i].length} REFS · ${inMap[i].length} CITERS</b></div>
        ${networkRows.join('') || '<div class="network-row"><i></i><span>样本内没有相连的引用记录。</span><em>—</em></div>'}
      </div>
      <a class="paper-link" href="${attr(link)}" target="_blank" rel="noopener">在 OpenAlex / DOI 查看原文 <b>↗</b></a>
    `;
    panelBody.scrollTop = 0;
    openPanelUI();
    animatePanelBars();
  }

  function renderThemePanel(th) {
    const t = themes[th];
    const color = themeColor(th);
    detailPanel.style.setProperty('--panel-accent', color);
    detailPanel.style.setProperty('--paper-accent', color);
    panelType.textContent = '主题星云';
    const g = growthMap[th];
    const ratio = g ? g.ratio : 1;
    const top = (t.papers || []).slice(0, 5);
    const ranks = top.map((idx, k) => {
      const w = works[idx];
      return `<button class="rank-item" data-paper="${idx}">
        <span class="num">${String(k + 1).padStart(2, '0')}</span>
        <span class="rank-text"><b>${esc(w.title)}</b><span>${w.year} · ${formatNum(w.cites)} CITES</span></span>
        <span class="rank-open">↗</span>
      </button>`;
    }).join('');
    panelBody.innerHTML = `
      <div class="theme-hero" style="--paper-accent:${color}">
        <div class="th-label">${esc(t.en)}</div>
        <h2>${esc(t.name)}</h2>
        <p>${esc(t.desc)}</p>
      </div>
      <div class="theme-stat-grid">
        <div><b>${t.count}</b><span>样本论文</span></div>
        <div><b>${formatNum(t.citations)}</b><span>累计被引</span></div>
        <div><b>${ratio.toFixed(1)}×</b><span>注意力变化</span></div>
      </div>
      <div class="section-label"><span>星云中最亮的论文</span><b>TOP 05</b></div>
      <div class="rank-list">${ranks}</div>
      <div class="section-label"><span>星云笔记</span><b>NOTE</b></div>
      <p class="abstract-text" style="margin-top:10px">${esc(t.blurb)}</p>
    `;
    panelBody.scrollTop = 0;
    openPanelUI();
    animatePanelBars();
  }

  function fingerprintHTML(c, color) {
    const globalTotal = Object.values(themes).reduce((a, t) => a + t.count, 0);
    const values = themeOrder.map(th => {
      const local = (c.themes[th] || 0) / Math.max(1, c.count);
      const global = themes[th].count / globalTotal;
      return { th, rca: local / Math.max(1e-9, global), local };
    });
    const maxR = 4.0;
    const cx = 160, cy = 114, R = 83;
    const angles = values.map((_, i) => -Math.PI / 2 + i * Math.PI * 2 / 7);
    const pointAt = (i, v) => {
      const rr = R * clamp(v / maxR, .03, 1);
      return { x: cx + Math.cos(angles[i]) * rr, y: cy + Math.sin(angles[i]) * rr };
    };
    const rings = [1, 2, 3].map(v => {
      const pts = values.map((_, i) => {
        const p = pointAt(i, v);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).join(' ');
      return `<polygon class="fp-ring" points="${pts}"/>`;
    }).join('');
    const axes = values.map((_, i) => {
      const p = pointAt(i, maxR);
      return `<line class="fp-axis" x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/>`;
    }).join('');
    const labels = values.map((v, i) => {
      const lr = R + 15;
      const p = { x: cx + Math.cos(angles[i]) * lr, y: cy + Math.sin(angles[i]) * lr };
      const anchor = Math.abs(p.x - cx) < 8 ? 'middle' : p.x > cx ? 'start' : 'end';
      return `<text class="fp-label" x="${p.x.toFixed(1)}" y="${(p.y + 3).toFixed(1)}" text-anchor="${anchor}" fill="${themeColor(v.th)}">${esc(themes[v.th].short)}</text>`;
    }).join('');
    const shapePts = values.map((v, i) => {
      const p = pointAt(i, v.rca);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');
    const dots = values.map((v, i) => {
      const p = pointAt(i, v.rca);
      return `<circle class="fp-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.7" fill="${themeColor(v.th)}" stroke="${themeColor(v.th)}"/>`;
    }).join('');
    const ringLabels = [1, 2, 3].map(v => {
      const p = pointAt(0, v);
      return `<text class="fp-ring-label" x="${(p.x + 4).toFixed(1)}" y="${(p.y + 2).toFixed(1)}">${v}×</text>`;
    }).join('');
    const top = values.filter(v => v.rca >= 1.12).sort((a, b) => b.rca - a.rca).slice(0, 3);
    const tags = top.length
      ? top.map(v => `<span class="rca-tag"><i style="--c:${themeColor(v.th)}"></i>${esc(themes[v.th].short)} ${v.rca.toFixed(1)}×</span>`).join('')
      : '<span class="rca-tag">方向分布均衡</span>';
    return `<div class="fingerprint-wrap">
      <div class="fingerprint-head"><span>RCA / 全球平均</span><b>${c.code}</b></div>
      <svg viewBox="0 0 320 232" role="img" aria-label="${esc(c.zh)}研究主题专业化雷达图">
        ${rings}${axes}
        <polygon points="${shapePts}" style="fill:${rgba(color, .14)};stroke:${color};stroke-width:1.1;stroke-linejoin:round"/>
        ${dots}${ringLabels}${labels}
      </svg>
      <div class="rca-tags">${tags}</div>
      <div class="rca-note">RCA = 本国该主题占比 ÷ 全球该主题占比。>1.0 表示相对专业化；样本较小，仅作方向观察。</div>
    </div>`;
  }

  function renderCountryPanel(code) {
    const c = countryMap.get(code);
    if (!c) return;
    const color = themeColor(c.theme);
    detailPanel.style.setProperty('--panel-accent', color);
    detailPanel.style.setProperty('--paper-accent', color);
    panelType.textContent = '国家网络';
    const share = (c.count / D.meta.works * 100).toFixed(1);
    const collabs = D.collab
      .filter(([a, b]) => a === code || b === code)
      .sort((a, b) => b[2] - a[2])
      .slice(0, 5);
    const maxCollab = collabs[0]?.[2] || 1;
    const collabRows = collabs.map(([a, b, n]) => {
      const other = a === code ? b : a;
      const cc = countryMap.get(other);
      const name = cc?.zh || other;
      return `<div class="collab-row">
        <span class="c-code">${other}</span><span class="c-name">${esc(name)}</span>
        <span class="c-track"><i style="width:${Math.max(8, n / maxCollab * 100)}%"></i></span>
        <span class="c-n">${n}</span>
      </div>`;
    }).join('');
    const topPapers = works
      .filter(w => w.country === code)
      .sort((a, b) => b.cites - a.cites)
      .slice(0, 4)
      .map((w, k) => `<button class="rank-item" data-paper="${w.i}">
        <span class="num">${String(k + 1).padStart(2, '0')}</span>
        <span class="rank-text"><b>${esc(w.title)}</b><span>${w.year} · ${formatNum(w.cites)} CITES · ${esc(themeName(w.theme))}</span></span>
        <span class="rank-open">↗</span>
      </button>`).join('');

    panelBody.innerHTML = `
      <div class="country-hero">
        <div class="country-code">${esc(c.code)}</div>
        <div><h2>${esc(c.zh)}</h2><p>${esc(c.en)} · 高被引样本节点<br>最大主题：${esc(themeName(c.theme))}</p></div>
      </div>
      <div class="country-stats">
        <div><b>${c.count}</b><span>篇论文</span></div>
        <div><b>${formatNum(c.cites)}</b><span>累计被引</span></div>
        <div><b>${share}%</b><span>样本占比</span></div>
      </div>
      <div class="section-label"><span>研究指纹</span><b>SPECIALIZATION</b></div>
      ${fingerprintHTML(c, color)}
      <div class="section-label"><span>主要合作国家</span><b>CO-AUTHORSHIP</b></div>
      <div class="bar-list" style="gap:0;margin-top:8px">${collabRows || '<div class="collab-row"><span class="c-name">样本内暂无重复合作记录</span></div>'}</div>
      <div class="section-label"><span>代表论文</span><b>TOP PAPERS</b></div>
      <div class="rank-list" style="margin-top:8px">${topPapers}</div>
    `;
    panelBody.scrollTop = 0;
    openPanelUI();
    animatePanelBars();
  }

  function renderFlowPanel(pair) {
    const from = pair.from, to = pair.to;
    const reverse = flowPairsByKey.get(to + '|' + from);
    const color = themeColor(from), colorTo = themeColor(to);
    detailPanel.style.setProperty('--panel-accent', color);
    detailPanel.style.setProperty('--paper-accent', color);
    panelType.textContent = '知识流';
    const papers = pair.papers.slice().sort((a, b) => works[b].cites - works[a].cites).slice(0, 5);
    const share = (pair.count / Math.max(1, flowTotal) * 100).toFixed(1);
    const ranks = papers.map((idx, k) => {
      const w = works[idx];
      return `<button class="rank-item" data-paper="${idx}">
        <span class="num">${String(k + 1).padStart(2, '0')}</span>
        <span class="rank-text"><b>${esc(w.title)}</b><span>${w.year} · ${formatNum(w.cites)} CITES · ${esc(themeName(w.theme))}</span></span>
        <span class="rank-open">↗</span>
      </button>`;
    }).join('');
    panelBody.innerHTML = `
      <div class="paper-kicker" style="--paper-accent:${color}">CROSS-THEME FLOW / SAMPLE</div>
      <div class="flow-route">
        <span style="--c:${color}"><i></i>${esc(themeName(from))}</span>
        <b>→</b>
        <span style="--c:${colorTo}"><i></i>${esc(themeName(to))}</span>
      </div>
      <div class="theme-stat-grid">
        <div><b>${formatNum(pair.count)}</b><span>跨域引用</span></div>
        <div><b>${share}%</b><span>占跨域引用</span></div>
        <div><b>${formatNum(reverse?.count || 0)}</b><span>反向引用</span></div>
      </div>
      <p class="abstract-text" style="margin-top:0">引用方向：<b style="color:#dce6fb;font-weight:400">${esc(themeName(from))}</b> 的论文引用 <b style="color:#dce6fb;font-weight:400">${esc(themeName(to))}</b> 的论文。弧线越粗，知识流越强；这条通道由 ${pair.papers.length} 篇样本论文驱动。</p>
      <div class="section-label"><span>带动这条知识流的论文</span><b>BRIDGE PAPERS</b></div>
      <div class="rank-list">${ranks || '<div class="network-row"><i></i><span>样本内暂无驱动论文。</span><em>—</em></div>'}</div>
      <div class="network-block">
        <div class="network-title"><span>反向通道</span><b>${formatNum(reverse?.count || 0)} REFS</b></div>
        <div class="network-row"><i></i><span>${esc(themeName(to))} → ${esc(themeName(from))} 的引用流，表示另一种知识迁移方向。</span><em>双向</em></div>
      </div>
    `;
    panelBody.scrollTop = 0;
    openPanelUI();
    animatePanelBars();
  }

  function renderFlowNodePanel(th) {
    const color = themeColor(th);
    const outPairs = flowPairs.filter(p => p.from === th).slice(0, 4);
    const inPairs = flowPairs.filter(p => p.to === th).slice(0, 4);
    detailPanel.style.setProperty('--panel-accent', color);
    detailPanel.style.setProperty('--paper-accent', color);
    panelType.textContent = '主题节点';
    const outTotal = flowOut[th] || 0, inTotal = flowIn[th] || 0;
    const maxOut = outPairs[0]?.count || 1;
    const outRows = outPairs.map(p => `<div class="bar-row">
      <span class="b-name" style="color:${themeColor(p.to)}">→ ${esc(themeName(p.to))}</span>
      <span class="b-track"><i class="b-fill" data-width="${(p.count / maxOut * 100).toFixed(1)}" style="--bc:${themeColor(p.to)}"></i></span>
      <span class="b-val">${formatNum(p.count)}</span>
    </div>`).join('');
    const maxIn = inPairs[0]?.count || 1;
    const inRows = inPairs.map(p => `<div class="bar-row">
      <span class="b-name" style="color:${themeColor(p.from)}">← ${esc(themeName(p.from))}</span>
      <span class="b-track"><i class="b-fill" data-width="${(p.count / maxIn * 100).toFixed(1)}" style="--bc:${themeColor(p.from)}"></i></span>
      <span class="b-val">${formatNum(p.count)}</span>
    </div>`).join('');
    const top = (themes[th].papers || []).slice(0, 4).map((idx, k) => {
      const w = works[idx];
      return `<button class="rank-item" data-paper="${idx}">
        <span class="num">${String(k + 1).padStart(2, '0')}</span>
        <span class="rank-text"><b>${esc(w.title)}</b><span>${w.year} · ${formatNum(w.cites)} CITES</span></span>
        <span class="rank-open">↗</span>
      </button>`;
    }).join('');
    panelBody.innerHTML = `
      <div class="theme-hero" style="--paper-accent:${color}">
        <div class="th-label">THEME NODE / ${esc(themes[th].en)}</div>
        <h2>${esc(themeName(th))}</h2>
        <p>${esc(themes[th].blurb)}</p>
      </div>
      <div class="theme-stat-grid">
        <div><b>${themes[th].count}</b><span>样本论文</span></div>
        <div><b>${formatNum(outTotal)}</b><span>流出引用</span></div>
        <div><b>${formatNum(inTotal)}</b><span>流入引用</span></div>
      </div>
      <div class="section-label"><span>流向其他星云</span><b>OUTBOUND</b></div>
      <div class="bar-list" style="margin-top:10px">${outRows}</div>
      <div class="section-label"><span>接收其他星云</span><b>INBOUND</b></div>
      <div class="bar-list" style="margin-top:10px">${inRows}</div>
      <div class="section-label"><span>节点中最亮的论文</span><b>TOP PAPERS</b></div>
      <div class="rank-list" style="margin-top:8px">${top}</div>
    `;
    panelBody.scrollTop = 0;
    openPanelUI();
    animatePanelBars();
  }

  function animatePanelBars() {
    const bars = $$('.b-fill', panelBody);
    for (const b of bars) {
      const target = b.dataset.width + '%';
      anime.animate(b, { width: ['0%', target], duration: 900, delay: anime.stagger(55), ease: 'outExpo' });
    }
    const ranks = $$('.rank-item', panelBody);
    if (ranks.length) {
      anime.animate(ranks, { opacity: [0, 1], translateX: [8, 0], duration: 550, delay: anime.stagger(55), ease: 'outExpo' });
    }
  }

  /* ---------------- selection ---------------- */
  function selectPaper(i) {
    if (i == null || !works[i]) return;
    if (state.introActive) finishIntro();
    const w = works[i];
    if (state.view === 'countries' || state.view === 'flows') {
      state.selectedPaper = i;
      state.focusKind = 'paper';
      renderPaperPanel(i);
      return;
    }
    state.selectedPaper = i;
    state.selectedTheme = w.theme;
    state.focusKind = 'paper';
    state.panelOpen = true;
    camera.focusPoint = w.pos;
    camera.zoomTarget = Math.max(2.05, camera.zoom);
    anime.animate(camera, { focusWeight: 1, duration: 950, ease: 'outExpo' });
    syncLegend();
    renderPaperPanel(i);
  }

  function selectCountry(code) {
    const c = countryMap.get(code);
    if (!c) return;
    if (state.introActive) finishIntro();
    state.selectedCountry = code;
    state.selectedPaper = null;
    state.selectedTheme = null;
    state.focusKind = 'country';
    globe.zoomTarget = Math.max(1.08, globe.zoomTarget);
    const targetYaw = c.lon * Math.PI / 180;
    const twoPi = Math.PI * 2;
    let dy = ((targetYaw - globe.yaw + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
    anime.animate(globe, {
      yaw: globe.yaw + dy,
      pitch: c.lat * Math.PI / 180 * .72,
      zoomTarget: Math.max(1.08, globe.zoomTarget),
      duration: 1250,
      ease: 'outExpo'
    });
    syncLegend();
    renderCountryPanel(code);
  }

  function selectFlowEdge(from, to) {
    const pair = flowPairsByKey.get(from + '|' + to);
    if (!pair) return;
    if (state.introActive) finishIntro();
    state.flowSelectedEdge = { from, to };
    state.flowSelectedNode = null;
    state.selectedTheme = null;
    state.selectedPaper = null;
    state.focusKind = 'flow';
    syncLegend();
    renderFlowPanel(pair);
  }

  function selectFlowNode(th) {
    if (!themes[th]) return;
    if (state.introActive) finishIntro();
    state.flowSelectedNode = th;
    state.flowSelectedEdge = null;
    state.selectedTheme = th;
    state.selectedPaper = null;
    state.focusKind = 'flow-node';
    syncLegend();
    renderFlowNodePanel(th);
  }

  /* ---------------- view switching ---------------- */
  function syncGlobeLock() {
    globeLock.classList.toggle('is-locked', globe.locked);
    globeLock.setAttribute('aria-pressed', globe.locked ? 'true' : 'false');
    globeLockText.textContent = globe.locked ? '已锁定' : '锁定自转';
    globeLock.title = globe.locked ? '点击恢复绕极轴自动旋转（15 秒/圈）' : '点击锁定绕极轴自动旋转（15 秒/圈）';
  }

  function setView(next, opts = {}) {
    if (next === 'insights') { openInsights(); return; }
    if (state.insightOpen) closeInsights(true);
    if (next === state.view && !opts.force) return;
    state.view = next;
    closePanel();
    state.selectedTheme = null;
    state.selectedPaper = null;
    state.selectedCountry = null;
    state.flowSelectedNode = null;
    state.flowSelectedEdge = null;
    syncLegend();

    const pages = { galaxy: 'pageGalaxy', countries: 'pageCountries', flows: 'pageFlows' };
    for (const [v, id] of Object.entries(pages)) {
      $('#' + id).classList.toggle('is-active', v === next);
    }
    document.body.classList.toggle('globe-mode', next === 'countries');
    document.body.classList.toggle('flow-mode', next === 'flows');

    if (next === 'countries') {
      flowMix.v = 0;
      anime.animate(viewMix, { v: 1, duration: 950, ease: 'inOutQuart' });
      zoomHelp.textContent = 'DRAG TO ROTATE · CLICK A NODE';
      globe.zoomTarget = 1;
    } else if (next === 'flows') {
      viewMix.v = 0;
      flowMix.v = 0;
      anime.animate(flowMix, { v: 1, duration: 1050, ease: 'inOutQuart' });
      flow.zoomTarget = 1;
      zoomHelp.textContent = 'HOVER A FLOW · CLICK TO READ';
      const rows = $$('#pageFlows .title-row > span');
      if (rows.length) anime.animate(rows, { translateY: ['115%', '0%'], duration: 950, delay: anime.stagger(90), ease: 'outExpo' });
    } else {
      anime.animate(viewMix, { v: 0, duration: 850, ease: 'inOutQuart' });
      anime.animate(flowMix, { v: 0, duration: 850, ease: 'inOutQuart' });
      zoomHelp.textContent = 'SCROLL · DRAG · CLICK A STAR';
      camera.zoomTarget = 1.02;
      const rows = $$('#pageGalaxy .title-row > span');
      if (rows.length) anime.animate(rows, { translateY: ['115%', '0%'], duration: 900, delay: anime.stagger(80), ease: 'outExpo' });
    }

    if (next === 'countries') {
      const rows = $$('#pageCountries .title-row > span');
      if (rows.length) anime.animate(rows, { translateY: ['115%', '0%'], duration: 950, delay: anime.stagger(90), ease: 'outExpo' });
    }

    $$('.nav-item[data-view]').forEach(b => {
      const active = b.dataset.view === next;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  /* ---------------- insights ---------------- */
  function buildInsights() {
    const field = D.insights.fieldSeries;
    const first = field[0] || 1, last = field[field.length - 1] || 0;
    const growth = Math.round((last / first - 1) * 100);
    const maxField = Math.max(...field) * 1.08;
    const x0 = 8, x1 = 592, y0 = 12, y1 = 118;
    const pts = field.map((v, i) => [
      x0 + i * (x1 - x0) / (field.length - 1),
      y1 - (v / maxField) * (y1 - y0)
    ]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = `M${x0} ${y1} ` + pts.map(p => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ` L${x1} ${y1} Z`;
    const grid = [.25, .5, .75].map(p => `<line x1="${x0}" x2="${x1}" y1="${y1 - (y1 - y0) * p}" y2="${y1 - (y1 - y0) * p}" stroke="rgba(140,170,230,.09)" stroke-width=".7"/>`).join('');
    const chart = `<svg viewBox="0 0 600 130" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGradient" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#4ed8ff"/><stop offset=".62" stop-color="#8b9dff"/><stop offset="1" stop-color="#ff8daf"/></linearGradient>
        <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#4ed8ff" stop-opacity=".18"/><stop offset="1" stop-color="#4ed8ff" stop-opacity="0"/></linearGradient>
      </defs>
      ${grid}
      <path class="chart-area" d="${area}"/>
      <path class="chart-line" d="${line}" pathLength="1000" style="stroke-dasharray:1000;stroke-dashoffset:1000"/>
      <circle class="chart-dot" cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="3"/>
    </svg>`;

    const growthRows = D.insights.growth.map((g, idx) => {
      const vals = D.insights.themeYear[g.theme] || [];
      const mx = Math.max(...vals, 1);
      const sparks = vals.map(v => `<i style="height:${Math.max(1, v / mx * 20).toFixed(1)}px;--gc:${themeColor(g.theme)}"></i>`).join('');
      return `<div class="growth-row ${idx === 0 ? 'is-top' : ''}">
        <span class="g-name"><i></i>${esc(themeName(g.theme))}</span>
        <span class="spark">${sparks}</span>
        <span class="g-ratio">${g.ratio.toFixed(2)}×</span>
      </div>`;
    }).join('');

    const matrix = D.insights.matrix.slice(0, 10);
    const maxCell = Math.max(...matrix.flatMap(r => Object.values(r.values)), 1);
    const themeHeaders = themeOrder.map(th => `<div class="hm-head">${esc(themes[th].short)}</div>`).join('');
    const heatRows = matrix.map(row => {
      const cells = themeOrder.map(th => {
        const v = row.values[th] || 0;
        const a = .045 + (v / maxCell) * .60;
        const txt = v >= 1 ? Math.round(v) : '·';
        return `<div class="hm-cell" title="${esc(row.zh)} · ${esc(themeName(th))}: ${v}%" style="background:${rgba(themeColor(th), a)}">${txt}</div>`;
      }).join('');
      return `<div class="hm-country">${esc(row.zh)}<b>${row.code}</b></div>${cells}`;
    }).join('');

    const bridgeRows = D.insights.bridges.slice(0, 6).map((b, k) => `
      <button class="bridge-item" data-paper="${b.i}">
        <span class="b-index">${String(k + 1).padStart(2, '0')}</span>
        <span class="b-main"><span class="b-title">${esc(b.title)}</span><span class="b-meta">${b.year} · ${esc(themeName(b.theme))} · ${formatNum(b.cites)} CITES</span></span>
        <span class="b-cross">${b.cross}</span>
      </button>`).join('');

    insightsGrid.innerHTML = `
      <article class="insight-card">
        <div class="card-head"><span class="card-index">01 / FIELD PULSE</span><span class="tag">OPENALEX</span></div>
        <div class="card-kicker">领域年产出</div>
        <h3>AI 正在加速扩张</h3>
        <p class="card-note">AI / CV / 信号处理领域，2012—2025 年每年被 OpenAlex 收录的论文总量。</p>
        <div class="big-metric"><b>2.97×</b><span>${growth >= 0 ? '+' : ''}${growth}% · 2012 → 2025</span></div>
        <div class="growth-chart">${chart}</div>
        <div class="chart-note"><span>2012 · ${formatNum(first)}</span><span>2025 · ${formatNum(last)}</span></div>
      </article>

      <article class="insight-card">
        <div class="card-head"><span class="card-index">02 / ATTENTION SHIFT</span><span class="tag">SAMPLE</span></div>
        <div class="card-kicker">高被引注意力迁移</div>
        <h3>语言与推理，成为最大引力源</h3>
        <p class="card-note">高被引样本中，各主题在 2012—2016 与 2021—2025 的论文量比值。右侧是 14 年脉冲。</p>
        <div class="theme-growth-list">${growthRows}</div>
      </article>

      <article class="insight-card">
        <div class="card-head"><span class="card-index">03 / NATIONAL DNA</span><span class="tag">COUNTRY × THEME</span></div>
        <div class="card-kicker">国家研究方向</div>
        <h3>每个国家，都有自己的光谱</h3>
        <p class="card-note">Top 10 国家的高被引论文主题构成（%）。颜色越亮，方向越集中。</p>
        <div class="heatmap">
          <div class="hm-head"></div>${themeHeaders}${heatRows}
        </div>
        <div class="hm-legend"><i></i><span>低</span><span>主题占比</span><span>高</span></div>
      </article>

      <article class="insight-card">
        <div class="card-head"><span class="card-index">04 / BRIDGE PAPERS</span><span class="tag">CROSS-THEME</span></div>
        <div class="card-kicker">跨界桥梁</div>
        <h3>连接原本分离的星云</h3>
        <p class="card-note">按样本内跨主题引用边数量排序。点击论文，直接回到星系中的那颗星。</p>
        <div class="bridge-list">${bridgeRows}</div>
      </article>
    `;

    $$('.bridge-item', insightsGrid).forEach(el => {
      el.addEventListener('click', () => {
        const i = Number(el.dataset.paper);
        closeInsights();
        setView('galaxy', { force: true });
        setTimeout(() => selectPaper(i), 420);
      });
    });
  }

  function animateInsights() {
    $$('.insight-card', insightsGrid).forEach(el => { el.style.opacity = 0; });
    anime.animate($$('.insight-card', insightsGrid), {
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 750,
      delay: anime.stagger(80),
      ease: 'outExpo'
    });
    $$('.growth-row .spark i', insightsGrid).forEach(el => { el.style.transform = 'scaleY(0)'; });
    anime.animate($$('.growth-row .spark i', insightsGrid), {
      scaleY: [0, 1],
      duration: 620,
      delay: anime.stagger(5),
      ease: 'outExpo'
    });
    const line = $('.chart-line', insightsGrid);
    if (line) {
      line.style.strokeDashoffset = 1000;
      anime.animate(line, { strokeDashoffset: [1000, 0], duration: 1550, delay: 260, ease: 'outExpo' });
    }
    $$('.chart-dot', insightsGrid).forEach((el, i) => {
      anime.animate(el, { opacity: [0, 1], duration: 500, delay: 1300 + i * 120, ease: 'outExpo' });
    });
  }

  function openInsights() {
    if (state.introActive) finishIntro();
    if (state.panelOpen) closePanel();
    state.insightOpen = true;
    if (!insightsGrid.dataset.built) {
      buildInsights();
      insightsGrid.dataset.built = '1';
    }
    insightsEl.classList.add('is-open');
    insightsEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('insight-open');
    $$('.nav-item[data-view]').forEach(b => b.classList.toggle('is-active', b.dataset.view === 'insights'));
    animateInsights();
  }

  function closeInsights(immediate = false) {
    if (!state.insightOpen) return;
    state.insightOpen = false;
    insightsEl.classList.remove('is-open');
    insightsEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('insight-open');
    $$('.nav-item[data-view]').forEach(b => {
      const active = b.dataset.view === state.view;
      b.classList.toggle('is-active', active);
    });
    if (immediate) return;
  }

  /* ---------------- hover ---------------- */
  function findStar(x, y) {
    let best = null, bestScore = Infinity;
    for (const w of works) {
      if (!w._visible || w._alpha < .12) continue;
      const dx = x - w._sx, dy = y - w._sy;
      const rad = Math.max(7.5, w._size * 1.35 + 3);
      const d = dx * dx + dy * dy;
      if (d < rad * rad && d < bestScore) {
        best = w.i;
        bestScore = d;
      }
    }
    return best;
  }

  function findCountry(x, y) {
    let best = null, bestScore = Infinity;
    for (const c of D.countries) {
      if (c._gz == null || c._gz < -.03 || c._ga < .12) continue;
      const dx = x - c._gx, dy = y - c._gy;
      const rad = Math.max(8, c._gr + 5);
      const d = dx * dx + dy * dy;
      if (d < rad * rad && d < bestScore) {
        best = c.code;
        bestScore = d;
      }
    }
    return best;
  }

  function hoverContentPaper(i) {
    const w = works[i];
    const th = w.theme;
    const cit = citationStats(w);
    hoverCard.style.setProperty('--hc', themeColor(th));
    $('.hover-kicker span', hoverCard).textContent = `${themes[th].en} · ${w.year}`;
    $('.hover-title', hoverCard).textContent = w.title;
    $('.hover-meta', hoverCard).textContent = state.lightMode === 'citation'
      ? `截至 ${state.year} 被引 ${formatFull(cit.cum)} · 本年 +${formatFull(cit.annual)} · 总计 ${formatFull(w.cites)}`
      : `${formatFull(w.cites)} 次引用 · ${w.topic || 'AI'}`;
  }

  function hoverContentCountry(code) {
    const c = countryMap.get(code);
    hoverCard.style.setProperty('--hc', themeColor(c.theme));
    $('.hover-kicker span', hoverCard).textContent = 'COUNTRY NODE';
    $('.hover-title', hoverCard).textContent = `${c.zh} / ${c.en}`;
    $('.hover-meta', hoverCard).textContent = `${c.count} 篇高被引 · 主导 ${themeName(c.theme)}`;
  }

  function placeHover(x, y) {
    const cw = hoverCard.offsetWidth || 300;
    let left = x + 18;
    let top = y + 18;
    if (left + cw > innerWidth - 16) left = x - cw - 18;
    if (top + 100 > innerHeight - 16) top = y - 100;
    hoverCard.style.left = left + 'px';
    hoverCard.style.top = top + 'px';
  }

  function syncHover() {
    if (state.panelOpen || state.insightOpen || state.introActive) {
      hoverCard.classList.remove('is-visible');
      state.hoverPaper = null;
      state.hoverCountry = null;
      state.flowHoverNode = null;
      state.flowHoverEdge = null;
      return;
    }
    if (state.view === 'galaxy') {
      const hit = findStar(pointer.x, pointer.y);
      if (hit !== state.hoverPaper) {
        state.hoverPaper = hit;
        if (hit != null) {
          hoverContentPaper(hit);
          hoverCard.classList.add('is-visible');
        } else {
          hoverCard.classList.remove('is-visible');
        }
      }
      state.hoverCountry = null;
      state.flowHoverNode = null;
      state.flowHoverEdge = null;
      if (hit != null) placeHover(pointer.x, pointer.y);
      canvas.style.cursor = state.dragging ? 'grabbing' : (hit != null ? 'pointer' : 'crosshair');
    } else if (state.view === 'countries') {
      const hit = findCountry(pointer.x, pointer.y);
      if (hit !== state.hoverCountry) {
        state.hoverCountry = hit;
        if (hit) {
          hoverContentCountry(hit);
          hoverCard.classList.add('is-visible');
        } else {
          hoverCard.classList.remove('is-visible');
        }
      }
      state.hoverPaper = null;
      state.flowHoverNode = null;
      state.flowHoverEdge = null;
      if (hit) placeHover(pointer.x, pointer.y);
      canvas.style.cursor = state.dragging ? 'grabbing' : (hit ? 'pointer' : 'grab');
    } else {
      const node = findFlowNode(pointer.x, pointer.y);
      let edge = null;
      if (!node) edge = findFlowEdge(pointer.x, pointer.y);
      const edgeKey = edge ? edge.from + '|' + edge.to : null;
      const curKey = state.flowHoverEdge ? state.flowHoverEdge.from + '|' + state.flowHoverEdge.to : null;
      const changed = node !== state.flowHoverNode || edgeKey !== curKey;
      state.flowHoverNode = node;
      if (changed) {
        state.flowHoverEdge = edge;
        if (node) {
          hoverContentFlowNode(node);
          hoverCard.classList.add('is-visible');
        } else if (edge) {
          hoverContentFlowEdge(edge);
          hoverCard.classList.add('is-visible');
        } else {
          hoverCard.classList.remove('is-visible');
        }
      }
      state.hoverPaper = null;
      state.hoverCountry = null;
      if (node || edge) placeHover(pointer.x, pointer.y);
      canvas.style.cursor = state.dragging ? 'grabbing' : (node || edge ? 'pointer' : 'grab');
    }
  }

  /* ---------------- pointer ---------------- */
  const pointer = { x: 0, y: 0, downX: 0, downY: 0, lastX: 0, lastY: 0 };
  const activePointers = new Map();
  let pinch = null;
  let dragged = false;

  canvas.addEventListener('pointerdown', e => {
    if (state.insightOpen) return;
    if (state.introActive) { finishIntro(); return; }
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture?.(e.pointerId);
    pointer.x = pointer.downX = pointer.lastX = e.clientX;
    pointer.y = pointer.downY = pointer.lastY = e.clientY;
    state.dragging = true;
    state.pointerMoved = false;
    dragged = false;
    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.view === 'countries' ? globe.zoomTarget : camera.zoomTarget };
    }
  });

  window.addEventListener('pointermove', e => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (!state.dragging || !activePointers.has(e.pointerId)) {
      if (!state.dragging) syncHover();
      return;
    }
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size >= 2 && pinch) {
      const [a, b] = [...activePointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / Math.max(20, pinch.dist);
      if (state.view === 'countries') globe.zoomTarget = clamp(pinch.zoom * ratio, .78, 1.9);
      else camera.zoomTarget = clamp(pinch.zoom * ratio, .72, 4.4);
      state.pointerMoved = true;
      hoverCard.classList.remove('is-visible');
      return;
    }
    const dx = e.clientX - pointer.lastX;
    const dy = e.clientY - pointer.lastY;
    if (Math.abs(e.clientX - pointer.downX) + Math.abs(e.clientY - pointer.downY) > 5) {
      state.pointerMoved = true;
      dragged = true;
    }
    pointer.lastX = e.clientX;
    pointer.lastY = e.clientY;
    if (state.view === 'countries') {
      globe.yaw -= dx * .0052;
      globe.pitch = clamp(globe.pitch - dy * .0042, -1.15, 1.15);
    } else if (state.view === 'flows') {
      flow.rot += dx * .0038;
    } else {
      camera.yaw += dx * .0045;
      camera.pitch = clamp(camera.pitch + dy * .0035, -1.12, 1.12);
    }
    hoverCard.classList.remove('is-visible');
  }, { passive: true });

  window.addEventListener('pointerup', e => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.delete(e.pointerId);
    canvas.releasePointerCapture?.(e.pointerId);
    if (activePointers.size < 2) pinch = null;
    if (activePointers.size === 0) {
      const wasDragging = state.dragging;
      state.dragging = false;
      if (wasDragging && !state.pointerMoved) {
        if (state.view === 'galaxy') {
          const hit = findStar(e.clientX, e.clientY);
          if (hit != null) selectPaper(hit);
          else if (state.panelOpen || state.selectedTheme) resetSelection();
        } else if (state.view === 'flows') {
          const node = findFlowNode(e.clientX, e.clientY);
          if (node) selectFlowNode(node);
          else {
            const edge = findFlowEdge(e.clientX, e.clientY);
            if (edge) selectFlowEdge(edge.from, edge.to);
            else if (state.panelOpen) closePanel();
          }
        } else {
          const hit = findCountry(e.clientX, e.clientY);
          if (hit) selectCountry(hit);
          else if (state.panelOpen) closePanel();
        }
      }
      syncHover();
      canvas.style.cursor = state.view === 'countries' || state.view === 'flows' ? 'grab' : 'crosshair';
    }
  });

  canvas.addEventListener('pointerleave', () => {
    if (!state.dragging) {
      hoverCard.classList.remove('is-visible');
      state.hoverPaper = null;
      state.hoverCountry = null;
      state.flowHoverNode = null;
      state.flowHoverEdge = null;
    }
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (state.insightOpen) return;
    if (state.introActive) finishIntro();
    if (state.view === 'countries') {
      globe.zoomTarget = clamp(globe.zoomTarget * Math.exp(-e.deltaY * .00115), .78, 1.9);
    } else if (state.view === 'flows') {
      flow.zoomTarget = clamp(flow.zoomTarget * Math.exp(-e.deltaY * .0012), .74, 1.55);
    } else {
      camera.zoomTarget = clamp(camera.zoomTarget * Math.exp(-e.deltaY * .0012), .72, 4.4);
    }
    hoverCard.classList.remove('is-visible');
  }, { passive: false });

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.insightOpen) { closeInsights(); return; }
      if (state.panelOpen) { closePanel(); return; }
      if (state.selectedTheme || state.selectedCountry) { closePanel(); return; }
      if (state.introActive) { finishIntro(); return; }
    }
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      togglePlay();
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (state.insightOpen || state.panelOpen || document.activeElement === yearRange) return;
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      if (state.playing) { state.playing = false; if (playAnim) playAnim.pause(); syncPlayButton(); }
      setYear(state.year + d, false);
    }
  });

  /* ---------------- UI wiring ---------------- */
  function toast(text) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('is-visible'), 2100);
  }

  function initUI() {
    buildLegend($('#legend'));
    buildLegend($('#legendCountries'));
    buildFlowList();
    buildClusterLabels();
    fillIntroStats();
    buildInsights();
    insightsGrid.dataset.built = '1';
    syncLegend();
    updateTimelineUI();

    $('#brandHome').addEventListener('click', e => {
      e.preventDefault();
      closeInsights(true);
      if (state.panelOpen) closePanel();
      setView('galaxy', { force: true });
      state.selectedTheme = null;
      state.selectedPaper = null;
      state.selectedCountry = null;
      syncLegend();
      resetCameraOnly();
    });

    $$('.nav-item[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.view === 'insights') {
          if (state.insightOpen) closeInsights();
          else openInsights();
        } else setView(btn.dataset.view);
      });
    });

    $('#panelClose').addEventListener('click', closePanel);
    globeLock.addEventListener('click', () => {
      globe.locked = !globe.locked;
      syncGlobeLock();
      toast(globe.locked ? '地球视角已锁定' : '已恢复绕极轴自动旋转');
    });
    syncGlobeLock();
    $('#insightsClose').addEventListener('click', () => closeInsights());
    insightsEl.addEventListener('click', e => {
      if (e.target === insightsEl) closeInsights();
    });

    panelBody.addEventListener('click', e => {
      const btn = e.target.closest('[data-paper]');
      if (!btn) return;
      const i = Number(btn.dataset.paper);
      if (state.view === 'countries') renderPaperPanel(i);
      else selectPaper(i);
    });

    playBtn.addEventListener('click', togglePlay);
    for (const b of lightOptions) b.addEventListener('click', () => setLightMode(b.dataset.light));
    yearRange.addEventListener('input', () => {
      if (state.playing) { state.playing = false; if (playAnim) playAnim.pause(); syncPlayButton(); }
      setYear(Number(yearRange.value), false);
      ghostYear(state.year);
    });

    canvas.addEventListener('dblclick', e => {
      const i = findStar(e.clientX, e.clientY);
      if (i != null) selectPaper(i);
    });
  }

  /* ---------------- main loop ---------------- */
  let lastLabelUpdate = 0;
  let lastZoomText = '';
  let lastFrameTime = 0;
  function frame(now) {
    if (!lastFrameTime) lastFrameTime = now;
    const dt = Math.min(64, now - lastFrameTime);
    lastFrameTime = now;
    if (canvas.width === 0) resize();
    camera.zoom += (camera.zoomTarget - camera.zoom) * .085;
    globe.zoom += (globe.zoomTarget - globe.zoom) * .09;
    flow.zoom += (flow.zoomTarget - flow.zoom) * .09;
    if (state.view === 'countries' && !state.dragging && !state.selectedCountry && !state.panelOpen && !globe.locked) {
      globe.yaw += globe.autoSpeed * (dt / 1000);
    }
    if (state.view === 'flows' && !state.dragging && !state.panelOpen && !state.flowSelectedEdge && !state.flowSelectedNode && !state.flowHoverNode && !state.flowHoverEdge) {
      flow.rot += .000055 * (dt / 16.667);
    }
    // intro camera breathing
    ctx.clearRect(0, 0, view.w, view.h);
    drawBackground(now);
    const sceneMix = Math.max(viewMix.v, flowMix.v);
    if (sceneMix < .995) drawGalaxy(1 - sceneMix);
    if (viewMix.v > .005) drawGlobe(viewMix.v);
    if (flowMix.v > .005) drawFlow(flowMix.v);
    updateClusterLabels();

    const z = state.view === 'countries' ? globe.zoom : state.view === 'flows' ? flow.zoom : camera.zoom;
    const zt = z.toFixed(1) + '×';
    if (zt !== lastZoomText) {
      zoomLabel.textContent = zt;
      lastZoomText = zt;
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- start ---------------- */
  resize();
  initUI();
  setYear(D.meta.yearMax, false, true);
  requestAnimationFrame(frame);
  bootSequence();

  // expose a small debug surface for exhibitions / automated captures
  window.__GALAXY__ = {
    D, state, camera, globe, flow, works, setView, setYear, selectPaper, selectCountry,
    openInsights, closeInsights, closePanel, finishIntro, togglePlay, setLightMode, selectFlowEdge, selectFlowNode
  };
})();
