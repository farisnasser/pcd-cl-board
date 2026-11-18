/* The one-wall figure: closed form for a single secondary with unit gradients.
   d = g0 + lambda * g1,  lambda = max(0, tau - g1.g0)   (|g1| = 1)            */
(function () {
  'use strict';
  var svg = document.getElementById('geo');
  if (!svg) return;

  var NS = 'http://www.w3.org/2000/svg';
  var W = 480, H = 380, OX = 215, OY = 300, U = 120;
  var C = { primary: '#2B5FA8', wall: '#B4530A', soft: '#FBE7D0', step: '#0B6E6E', ink: '#141A1D', slate: '#566168' };

  var tauIn = document.getElementById('tauRange');
  var angIn = document.getElementById('angRange');
  var state = { tau: 0.5, g1: [-0.6, 0.8] };   // the paper's example

  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function px(v) { return [OX + v[0] * U, OY - v[1] * U]; }
  function fmt(x, d) {
    var s = Math.abs(x).toFixed(d == null ? 2 : d);
    if (Number(s) === 0) return s;
    return (x < 0 ? '−' : '') + s;
  }

  /* clip the viewBox rectangle to the half-plane  n.p >= c  (in pixel space) */
  function clip(poly, n, c) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var da = a[0] * n[0] + a[1] * n[1] - c, db = b[0] * n[0] + b[1] * n[1] - c;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        var t = da / (da - db);
        out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    return out;
  }
  function pts(poly) { return poly.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }

  function arrow(g, from, to, color, width, dash) {
    var a = px(from), b = px(to);
    var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len < 4) { g.appendChild(el('circle', { cx: a[0], cy: a[1], r: 5, fill: color })); return; }
    var ux = dx / len, uy = dy / len, head = Math.min(13, len * 0.6);
    var bx = b[0] - ux * head, by = b[1] - uy * head;
    var attrs = { x1: a[0], y1: a[1], x2: bx, y2: by, stroke: color, 'stroke-width': width, 'stroke-linecap': 'butt' };
    if (dash) attrs['stroke-dasharray'] = dash;
    g.appendChild(el('line', attrs));
    g.appendChild(el('polygon', {
      points: pts([[b[0], b[1]], [bx - uy * head * 0.5, by + ux * head * 0.5], [bx + uy * head * 0.5, by - ux * head * 0.5]]),
      fill: color
    }));
  }
  function label(g, at, text, color, dx, dy, anchor) {
    var p = px(at);
    var x = Math.max(8, Math.min(W - 8, p[0] + (dx || 0)));
    var y = Math.max(16, Math.min(H - 8, p[1] + (dy || 0)));
    var t = el('text', { x: x, y: y, fill: color, 'class': 'geo-label', 'text-anchor': anchor || 'start',
      stroke: '#fff', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, text);
    g.appendChild(t);
  }

  function solve() {
    var g0 = [1, 0], g1 = state.g1, tau = state.tau;
    var dot = g1[0] * g0[0] + g1[1] * g0[1];
    var lam = Math.max(0, tau - dot);
    var d = [g0[0] + lam * g1[0], g0[1] + lam * g1[1]];
    return { g0: g0, g1: g1, tau: tau, dot: dot, lam: lam, d: d,
      oldProg: g1[0] * d[0] + g1[1] * d[1], newProg: d[0] };
  }

  function draw() {
    var s = solve();
    while (svg.lastChild && svg.lastChild.nodeName !== 'desc') svg.removeChild(svg.lastChild);

    var defs = el('defs', {});
    var pat = el('pattern', { id: 'geoHatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    pat.appendChild(el('rect', { width: 8, height: 8, fill: '#fff' }));
    pat.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#CBD2D5', 'stroke-width': 3 }));
    defs.appendChild(pat);
    svg.appendChild(defs);

    var g = el('g', {});
    svg.appendChild(g);
    var box = [[0, 0], [W, 0], [W, H], [0, H]];
    /* pixel-space normal of g1: g1.v >= c  <=>  (g1x, -g1y).(p - O) >= c*U */
    var n = [s.g1[0], -s.g1[1]], base = n[0] * OX + n[1] * OY;
    /* region where the old task's loss rises: g1.d < 0 */
    var rises = clip(box, [-n[0], -n[1]], -base);
    if (rises.length) g.appendChild(el('polygon', { points: pts(rises), fill: 'url(#geoHatch)', opacity: 0.9 }));
    /* the margin band: 0 <= g1.d < tau */
    if (s.tau > 0) {
      var band = clip(clip(box, n, base), [-n[0], -n[1]], -(base + s.tau * U));
      if (band.length) g.appendChild(el('polygon', { points: pts(band), fill: C.soft }));
    }
    /* walls: through the origin (tau = 0) and at tau */
    function wallLine(c, attrs) {
      var mid = [OX + n[0] * c * U, OY + n[1] * c * U], t = [-n[1], n[0]], L = 700;
      var a = Object.assign({ x1: mid[0] - t[0] * L, y1: mid[1] - t[1] * L, x2: mid[0] + t[0] * L, y2: mid[1] + t[1] * L }, attrs);
      g.appendChild(el('line', a));
    }
    if (s.tau > 0) wallLine(0, { stroke: C.slate, 'stroke-width': 1.2, 'stroke-dasharray': '3 5' });
    wallLine(s.tau, { stroke: C.wall, 'stroke-width': 2.2, 'stroke-dasharray': '9 6' });

    /* axes hint: the primary's progress, dropped from the tip of d */
    var dp = px(s.d), foot = px([s.d[0], 0]);
    if (Math.abs(s.d[1]) > 0.02) {
      g.appendChild(el('line', { x1: dp[0], y1: dp[1], x2: foot[0], y2: foot[1], stroke: C.primary, 'stroke-width': 1.4, 'stroke-dasharray': '4 4' }));
      g.appendChild(el('line', { x1: OX, y1: OY + 14, x2: foot[0], y2: OY + 14, stroke: C.primary, 'stroke-width': 3 }));
      g.appendChild(el('text', { x: (OX + foot[0]) / 2, y: OY + 32, 'class': 'geo-small', 'text-anchor': 'middle' },
        'g̃₀ᵀd̃ = ' + fmt(s.newProg)));
    }

    arrow(g, [0, 0], s.g0, C.primary, 4);
    arrow(g, [0, 0], s.g1, C.wall, 4);
    if (s.lam > 1e-9) arrow(g, s.g0, s.d, C.wall, 1.6, '5 4');
    arrow(g, [0, 0], s.d, C.step, 6);
    g.appendChild(el('circle', { cx: OX, cy: OY, r: 5, fill: C.ink }));

    label(g, s.g0, 'g̃₀', C.primary, 8, 20);
    var left = s.g1[0] < 0;
    label(g, s.g1, 'g̃₁', C.wall, left ? -10 : 10, -8, left ? 'end' : 'start');
    label(g, s.d, 'd̃', C.step, 10, -10);

    document.getElementById('tauOut').textContent = s.tau.toFixed(2);
    var ang = Math.round(Math.atan2(s.g1[1], s.g1[0]) * 180 / Math.PI);
    document.getElementById('angOut').textContent = ang + '°';
    document.getElementById('roLam').textContent = fmt(s.lam);
    document.getElementById('roD').textContent = '(' + fmt(s.d[0]) + ', ' + fmt(s.d[1]) + ')';
    document.getElementById('roOld').textContent = fmt(s.oldProg);
    document.getElementById('roNew').textContent = fmt(s.newProg);

    var badge = document.getElementById('geoState');
    if (s.lam <= 1e-9) {
      badge.className = 'state free';
      badge.textContent = 'The wall is not active: the primary already gives the old task its share, and the step is the primary.';
    } else if (s.newProg < -1e-9) {
      badge.className = 'state back';
      badge.textContent = 'The wall is active, and the margin is large enough that the new task loses first-order progress on this step.';
    } else {
      badge.className = 'state bent';
      badge.textContent = 'The wall is active: the step adds ' + fmt(s.lam) + ' of the old task’s gradient and lands on the wall.';
    }
    tauIn.style.setProperty('--fill', (s.tau * 100) + '%');
    angIn.style.setProperty('--fill', (ang / 180 * 100) + '%');
  }

  tauIn.addEventListener('input', function () { state.tau = Number(tauIn.value); draw(); });
  angIn.addEventListener('input', function () {
    var a = Number(angIn.value) * Math.PI / 180;
    state.g1 = [Math.cos(a), Math.sin(a)];
    draw();
  });
  document.querySelectorAll('[data-preset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var p = b.getAttribute('data-preset');
      if (p === 'paper') { state.tau = 0.5; state.g1 = [-0.6, 0.8]; angIn.value = 127; }
      if (p === 'gem') { state.tau = 0; }
      if (p === 'agree') { state.g1 = [Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)]; angIn.value = 45; }
      tauIn.value = state.tau;
      draw();
    });
  });
  draw();
})();
