/* PCD-CL project page: charts, scroll behaviour, video fallback, copy buttons. */
(function () {
  'use strict';
  var D = window.PCDCL_DATA || {};
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ helpers */
  function h(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function scale(min, max) {
    return function (x) { return Math.max(0, Math.min(100, (x - min) / (max - min) * 100)); };
  }
  function read(ok) {
    return ok ? '<span class="read yes">supported</span>' : '<span class="read no">not separated</span>';
  }

  /* one chart row: a name, a track with marks, a value cell */
  function row(opts) {
    var r = h('div', 'row');
    r.appendChild(h('div', 'name', opts.name + (opts.sub ? '<small>' + opts.sub + '</small>' : '')));
    var t = h('div', 'track' + (opts.bar ? ' bar' : ''));
    t.setAttribute('aria-hidden', 'true');
    (opts.marks || []).forEach(function (m) { t.appendChild(m); });
    r.appendChild(t);
    r.appendChild(h('div', 'val', opts.val || ''));
    return r;
  }
  function at(cls, left, extra) {
    var n = h('span', cls);
    n.style.left = left + '%';
    if (extra) for (var k in extra) n.style[k] = extra[k];
    return n;
  }
  function span(sc, lo, hi, color) {
    var a = sc(lo), b = sc(hi);
    var n = at('span', a, { width: Math.max(0, b - a) + '%' });
    if (color) n.style.background = color;
    return n;
  }
  function axis(sc, ticks, unit, fmt) {
    var r = h('div', 'row axis');
    r.appendChild(h('div', 'name', ''));
    var t = h('div', 'ticks');
    t.setAttribute('aria-hidden', 'true');
    ticks.forEach(function (v) {
      var s = h('span', '', fmt ? fmt(v) : String(v));
      s.style.left = sc(v) + '%';
      t.appendChild(s);
    });
    r.appendChild(t);
    r.appendChild(h('div', 'val', unit || ''));
    return r;
  }
  function head(fig, title, sub, pill) {
    if (pill) fig.appendChild(h('span', 'pill posthoc', pill));
    fig.appendChild(h('p', 'chart-title', title));
    if (sub) fig.appendChild(h('p', 'chart-sub', sub));
  }
  function legend(items) {
    var ul = h('ul', 'legend');
    items.forEach(function (it) { ul.appendChild(h('li', '', it)); });
    return ul;
  }
  function signed(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v); }

  /* ------------------------------------------------------------ charts */
  var KIND = {
    ref: { cls: 'mk diamond', leg: '<span class="mk diamond"></span>reference run' },
    base: { cls: 'mk grey fill', leg: '<span class="mk grey fill"></span>baseline' },
    pcd: { cls: 'mk circle teal fill', leg: '<span class="mk circle teal fill"></span>PCD' }
  };

  function ladder() {
    var host = document.getElementById('chartLadder');
    if (!host || !D.ladder) return;
    D.ladder.forEach(function (panel, i) {
      var max = i === 0 ? 100 : 50, sc = scale(0, max);
      var fig = h('figure', 'chart');
      head(fig, panel.title, 'final accuracy, class-incremental (%)');
      panel.rows.forEach(function (r) {
        var m = r.final_acc, marks = [];
        marks.push(span(sc, m.mean - m.std, m.mean + m.std));
        m.values.forEach(function (v) { marks.push(at('pt', sc(v))); });
        marks.push(at(KIND[r.kind].cls, sc(m.mean)));
        fig.appendChild(row({ name: esc(r.name), marks: marks, val: m.label }));
      });
      fig.appendChild(axis(sc, i === 0 ? [0, 25, 50, 75, 100] : [0, 10, 20, 30, 40, 50], '%'));
      if (i === 0) fig.appendChild(legend([KIND.pcd.leg, KIND.base.leg, KIND.ref.leg, '<span class="pt"></span>one run', '<span class="span"></span>± 1 std']));
      host.appendChild(fig);
    });
  }

  function substitutes() {
    var fig = document.getElementById('chartSub');
    if (!fig || !D.substitutes) return;
    head(fig, 'Two remedies, one job', 'Split MNIST, 500 stored examples · final accuracy, class-incremental (%)');
    var sc = scale(0, 100), last = '';
    D.substitutes.cells.forEach(function (c) {
      if (c.primary !== last) { fig.appendChild(h('p', 'chart-group', 'Primary: ' + esc(c.primary.toLowerCase()))); last = c.primary; }
      var m = c.final_acc;
      var bar = h('span', 'barfill' + (c.tau === 'τ = 0' ? ' pale' : ''));
      bar.style.width = sc(m.mean) + '%';
      fig.appendChild(row({ name: c.tau === 'τ = 0' ? 'No margin, τ = 0' : 'Margin, τ = 0.75', bar: true, marks: [bar], val: m.label }));
    });
    fig.appendChild(axis(sc, [0, 25, 50, 75, 100], '%'));
    var e = D.substitutes.effects;
    fig.appendChild(h('p', 'chart-foot',
      'Paired differences in final accuracy. Margin 0.75 against none: <span class="num">' + e.margin_newonly.final_acc.label + '</span> without replay in the primary, <span class="num">' +
      e.margin_replay.final_acc.label + '</span> with it. Replay in the primary against none: <span class="num">' + e.replay_tau0.final_acc.label +
      '</span> at τ = 0, <span class="num">' + e.replay_tau075.final_acc.label + '</span> at τ = 0.75.'));
  }

  function forest(id, rows, opts) {
    var fig = document.getElementById(id);
    if (!fig || !rows) return;
    var metric = opts.metric;
    fig.style.setProperty('--namecol', '35%');
    fig.style.setProperty('--valcol', '118px');

    function render(refocus) {
      var m = opts.metrics[metric];
      fig.innerHTML = '';
      head(fig, opts.title, m.sub);

      var seg = h('div', 'seg');
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', 'Metric shown in this chart');
      Object.keys(opts.metrics).forEach(function (k) {
        var b = h('button', '', opts.metrics[k].name);
        b.type = 'button';
        b.setAttribute('aria-pressed', k === metric ? 'true' : 'false');
        b.addEventListener('click', function () { if (k !== metric) { metric = k; render(true); } });
        seg.appendChild(b);
      });
      fig.appendChild(seg);

      var sc = scale(m.min, m.max), last = '';
      rows.forEach(function (r) {
        if (r.group !== last) { fig.appendChild(h('p', 'chart-group', esc(r.group))); last = r.group; }
        var d = r[metric], marks = [];
        marks.push(at('zero', sc(0)));
        marks.push(span(sc, d.mean - d.std, d.mean + d.std));
        d.diffs.forEach(function (v) { if (v >= m.min && v <= m.max) marks.push(at('pt', sc(v))); });
        marks.push(at('mk circle' + (d.supported ? ' fill' : ''), sc(d.mean)));
        fig.appendChild(row({ name: esc(r.name), marks: marks,
          val: d.label + '<small>' + d.sign + ' pairs agree</small>' + read(d.supported) }));
      });
      fig.appendChild(axis(sc, m.ticks, 'points', signed));
      fig.appendChild(legend([
        '<span class="mk circle fill"></span>supported',
        '<span class="mk circle"></span>not separated',
        '<span class="pt"></span>one of the 9 pairs',
        '<span class="span"></span>± 1 paired std'
      ]));
      if (m.foot) fig.appendChild(h('p', 'chart-foot', m.foot));
      if (refocus) {
        var on = seg.querySelector('[aria-pressed="true"]');
        if (on) on.focus();
      }
    }
    render(false);
  }

  function rq2() {
    var fig = document.getElementById('chartRq2');
    if (!fig || !D.rq2) return;
    head(fig, 'PCD-EWC against EWC', 'Split MNIST, no memory · final accuracy, task-incremental (%) · each method at its validation pick');
    var sc = scale(90, 100), sup = { '0.01': '10⁻²', '0.1': '10⁻¹', '1': '1', '10': '10', '100': '10²' };
    D.rq2.forEach(function (r) {
      var marks = [];
      marks.push(span(sc, r.ewc.mean - r.ewc.std, r.ewc.mean + r.ewc.std, 'var(--c-base)'));
      marks.push(span(sc, r.pcdewc.mean - r.pcdewc.std, r.pcdewc.mean + r.pcdewc.std, 'var(--teal)'));
      marks.push(at('mk grey fill', sc(r.ewc.mean)));
      marks.push(at('mk circle teal fill', sc(r.pcdewc.mean)));
      fig.appendChild(row({
        name: 'Penalty scale c = ' + sup[r.c],
        sub: 'EWC ' + r.ewc.label + '<br>PCD-EWC ' + r.pcdewc.label,
        marks: marks,
        val: r.diff.label + '<small>' + r.diff.sign + ' pairs agree</small>' + read(r.diff.supported)
      }));
    });
    fig.appendChild(axis(sc, [90, 92, 94, 96, 98, 100], '%'));
    fig.appendChild(legend(['<span class="mk circle teal fill"></span>PCD-EWC', '<span class="mk grey fill"></span>EWC', '<span class="span"></span>± 1 std over runs']));
    fig.appendChild(h('p', 'chart-foot', 'Right column: PCD-EWC minus EWC, paired. Averaged over the five scales within each run: <span class="num">' +
      D.rq2avg.label + '</span> (' + D.rq2avg.sign + ' pairs), ' + (D.rq2avg.supported ? 'supported' : 'not separated') + '.'));
  }

  var SERIES = {
    er: { cls: 'mk grey fill', leg: '<span class="mk grey fill"></span>ER', short: 'ER' },
    gem: { cls: 'mk diamond', leg: '<span class="mk diamond"></span>GEM', short: 'GEM' },
    pcd0: { cls: 'mk circle teal', leg: '<span class="mk circle teal"></span>PCD, no margin', short: 'PCD τ=0' },
    'pcd0.75': { cls: 'mk circle teal fill', leg: '<span class="mk circle teal fill"></span>PCD with a margin', short: 'PCD τ>0' },
    pcd: { cls: 'mk circle teal fill', short: 'PCD τ>0' }
  };
  function sweep() {
    var fig = document.getElementById('chartSweep');
    if (!fig || !D.sweep) return;
    fig.style.setProperty('--valcol', '92px');
    fig.style.setProperty('--namecol', '38%');
    head(fig, 'Memory size on Split MNIST', 'final accuracy, class-incremental (%) · mean ± std over nine runs', 'Post hoc');
    var sc = scale(68, 94);
    var NAME = { er: 'ER', gem: 'GEM', pcd0: 'PCD, τ = 0', 'pcd0.75': 'PCD, τ = 0.75', pcd: 'PCD, τ = 0.25' };
    function one(key, p) {
      fig.appendChild(row({ name: NAME[key], marks: [span(sc, p.mean - p.std, p.mean + p.std), at(SERIES[key].cls, sc(p.mean))], val: p.label }));
    }
    fig.appendChild(h('p', 'chart-group', '100 stored examples, every method retuned'));
    D.sweep.tuned.forEach(function (t) { one(t.key, t); });
    D.sweep.M.forEach(function (M, i) {
      fig.appendChild(h('p', 'chart-group', M + ' stored examples, ' + (M === '500' ? 'the frozen final runs' : 'settings carried over from 500')));
      D.sweep.series.forEach(function (s) { one(s.key, s.points[i]); });
    });
    fig.appendChild(axis(sc, [70, 75, 80, 85, 90], '%'));
    fig.appendChild(legend([SERIES['pcd0.75'].leg, SERIES.pcd0.leg, SERIES.gem.leg, SERIES.er.leg, '<span class="span"></span>± 1 std']));
    fig.appendChild(h('p', 'chart-foot', 'Paired differences at 100 stored examples, retuned: PCD minus ER <span class="num">' +
      D.low['low/pcd-er'].final_acc.label + '</span>, PCD minus GEM <span class="num">' + D.low['low/pcd-gem'].final_acc.label +
      '</span>, margin against none <span class="num">' + D.low['low/margin'].final_acc.label + '</span>.'));
  }

  function scaleChart() {
    var fig = document.getElementById('chartScale');
    if (!fig || !D.scale) return;
    fig.style.setProperty('--valcol', '150px');
    fig.style.setProperty('--namecol', '22%');
    head(fig, 'Scale invariance, tested directly', 'PCD-EWC at one fixed setting · final accuracy, task-incremental (%)', 'Post hoc');
    var sc = scale(93, 100), sup = { '0.01': '10⁻²', '0.1': '10⁻¹', '1': '1', '10': '10', '100': '10²' };
    D.scale.c.forEach(function (c, i) {
      var a = D.scale.series[0].points[i], b = D.scale.series[1].points[i], marks = [];
      marks.push(span(sc, a.mean - a.std, a.mean + a.std, 'var(--c-base)'));
      marks.push(span(sc, b.mean - b.std, b.mean + b.std, 'var(--c-posthoc)'));
      marks.push(at('mk circle violet fill', sc(b.mean)));
      marks.push(at('mk grey open', sc(a.mean)));
      fig.appendChild(row({ name: 'c = ' + sup[c], marks: marks, val: '<small>default ' + a.label + '<br>small ' + b.label + '</small>' }));
    });
    fig.appendChild(axis(sc, [94, 96, 98, 100], '%'));
    fig.appendChild(legend(['<span class="mk grey"></span>ε = 10⁻⁸, the default', '<span class="mk circle violet fill"></span>ε = 10⁻¹⁶', '<span class="span"></span>± 1 std over runs']));
    fig.appendChild(h('p', 'chart-foot', 'The penalty is multiplied by c. With the default constant the result depends on c; with a small constant it does not.'));
  }

  ladder();
  substitutes();
  var WIDE = { min: -12, max: 12, ticks: [-10, -5, 0, 5, 10] };
  forest('chartRq1', D.rq1, {
    title: 'What each change is worth', metric: 'final_acc',
    metrics: {
      final_acc: { name: 'Final accuracy', min: -9, max: 11, ticks: [-8, -4, 0, 4, 8],
        sub: 'paired difference in final accuracy, class-incremental (points) · first minus second · above zero is better' },
      forgetting: { name: 'Forgetting', min: WIDE.min, max: WIDE.max, ticks: WIDE.ticks,
        sub: 'paired difference in forgetting (points) · first minus second · below zero means less forgetting' },
      learn_acc: { name: 'Learning accuracy', min: WIDE.min, max: WIDE.max, ticks: WIDE.ticks,
        sub: 'paired difference in learning accuracy (points) · first minus second · above zero is better' }
    }
  });
  forest('chartRq3', D.rq3, {
    title: 'Priority rules against a shared margin', metric: 'forgetting',
    metrics: {
      forgetting: { name: 'Forgetting', min: -3, max: 3, ticks: [-3, -2, -1, 0, 1, 2, 3],
        sub: 'paired difference in forgetting (points) · below zero means less forgetting',
        foot: 'The one supported row is the shrinking schedule on Split MNIST, and it is an increase in forgetting.' },
      final_acc: { name: 'Final accuracy', min: -3, max: 4, ticks: [-3, -2, -1, 0, 1, 2, 3, 4],
        sub: 'paired difference in final accuracy, class-incremental (points) · above zero is better' },
      learn_acc: { name: 'Learning accuracy', min: -3, max: 3, ticks: [-3, -2, -1, 0, 1, 2, 3],
        sub: 'paired difference in learning accuracy (points) · above zero is better' }
    }
  });
  rq2();
  sweep();
  scaleChart();

  /* ------------------------------------------------------------ math */
  function typeset() {
    if (!window.renderMathInElement) return false;
    window.renderMathInElement(document.querySelector('main'), {
      delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
      throwOnError: false
    });
    return true;
  }
  if (!typeset()) window.addEventListener('load', typeset);

  /* ------------------------------------------------------------ reveal */
  var risers = Array.prototype.slice.call(document.querySelectorAll('.rise'));
  function showAll() { risers.forEach(function (n) { n.classList.add('seen'); }); }
  if (reduce || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    risers.forEach(function (n) { io.observe(n); });
    /* never leave content hidden: a background tab, a print preview or a jump by hash */
    window.addEventListener('beforeprint', showAll);
    if (location.search.indexOf('static') !== -1) showAll();
  }
  window.PCDCL_READY = true;
  var heroPath = document.getElementById('heroPath');
  if (heroPath) heroPath.classList.add('go');

  /* ------------------------------------------------------------ progress + side nav */
  var bar = document.getElementById('progress');
  var nav = document.getElementById('sidenav');
  var links = nav ? Array.prototype.slice.call(nav.querySelectorAll('a')) : [];
  var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var ticking = false;
  function onScroll() {
    ticking = false;
    var doc = document.documentElement, top = window.pageYOffset || doc.scrollTop;
    var max = doc.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (max > 0 ? Math.min(100, top / max * 100) : 0) + '%';
    if (nav) nav.classList.toggle('on', top > window.innerHeight * 0.5);
    var cur = 0, line = top + window.innerHeight * 0.35;
    targets.forEach(function (t, i) { if (t && t.offsetParent !== null && t.getBoundingClientRect().top + top <= line) cur = i; });
    links.forEach(function (a, i) { if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ------------------------------------------------------------ video fallback */
  var video = document.getElementById('studyVideo');
  var screen = document.getElementById('screen');
  if (video && screen) {
    var missing = function () { screen.classList.add('is-missing'); video.removeAttribute('controls'); video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1; };
    var src = video.querySelector('source');
    if (src) src.addEventListener('error', missing);
    video.addEventListener('error', missing);
    var check = function () { if (video.networkState === 3 /* NETWORK_NO_SOURCE */) missing(); };
    check();
    window.addEventListener('load', function () { setTimeout(check, 400); });
    video.addEventListener('loadedmetadata', function () { screen.classList.remove('is-missing'); video.setAttribute('controls', ''); video.removeAttribute('aria-hidden'); video.tabIndex = 0; });
  }

  /* ------------------------------------------------------------ copy */
  var toast = document.getElementById('toast'), toastTimer;
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('on'); }, 1800);
  }
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var pre = document.getElementById(btn.getAttribute('data-copy'));
      if (!pre) return;
      var text = pre.textContent;
      var done = function () { say('Copied to clipboard'); };
      var fallback = function () {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (err) { say('Select the text and copy it'); }
        document.body.removeChild(ta);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
  });
})();
