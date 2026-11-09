// threadviz: animated thread timelines, drawn from a JSON spec.
// Threads are vertical lines; time flows down. Inspired by
// Ivan Daniluk's "Visualizing Concurrency in Go" (divan.dev).
//
// <figure class="tviz">
//   <script type="application/json">{ "T": 8, "lanes": [...], ... }</script>
//   <figcaption>...</figcaption>
// </figure>
//
// Spec:
//   T        total time units                      unit   px per time unit (default 34)
//   lanes    [{id, label, kind?: "resource"}]
//   segments [{lane, from, to, state: run|blocked|wait, label?}]
//   arrows   [{from, to, at, dt?, kind?: msg|spawn|read|write|bad, label?}]
//   marks    [{lane, at, label, kind?: ok|bad}]
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var W = 640, TOP = 62, LEFT = 30, RIGHT = 20, BOTTOM = 18;
  var counter = 0;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, cls, anchor) {
    var t = el('text', { x: x, y: y, 'class': cls || '', 'text-anchor': anchor || 'middle' }, parent);
    t.textContent = str;
    return t;
  }

  var LEGEND = {
    run: 'running', blocked: 'blocked (waiting for a lock)', wait: 'waiting / parked',
    msg: 'hand-off', spawn: 'starts thread', read: 'read', write: 'write', bad: 'problem'
  };

  function render(fig) {
    var spec;
    try { spec = JSON.parse(fig.querySelector('script[type="application/json"]').textContent); }
    catch (e) { return; }
    var id = 'tv' + (++counter);
    var unit = spec.unit || 34;
    var lanes = spec.lanes;
    var H = TOP + spec.T * unit + BOTTOM;
    var span = (W - LEFT - RIGHT) / lanes.length;
    var X = {};
    lanes.forEach(function (l, i) { X[l.id] = LEFT + span * (i + 0.5); });
    function Y(t) { return TOP + t * unit; }

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': spec.title || 'Thread timeline' });
    var defs = el('defs', {}, svg);
    ['msg', 'spawn', 'read', 'write', 'bad'].forEach(function (k) {
      var m = el('marker', { id: id + '-h-' + k, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', 'class': 'tv-head tv-' + k }, m);
    });
    var clip = el('clipPath', { id: id + '-clip' }, defs);
    var clipRect = el('rect', { x: 0, y: 0, width: W, height: H }, clip);

    // Time axis
    el('line', { x1: 12, y1: TOP, x2: 12, y2: H - BOTTOM, 'class': 'tv-axis', 'marker-end': 'url(#' + id + '-h-spawn)' }, svg);
    var tl = text(svg, 0, 0, 'time', 'tv-axis-label');
    tl.setAttribute('transform', 'translate(8,' + (TOP + 22) + ') rotate(-90)');

    // Lane headers and resource bands (always visible)
    lanes.forEach(function (l) {
      if (l.kind === 'resource') {
        el('rect', { x: X[l.id] - 30, y: TOP - 6, width: 60, height: spec.T * unit + 12, rx: 6, 'class': 'tv-resource' }, svg);
      }
      text(svg, X[l.id], TOP - 26, l.label, 'tv-lane' + (l.kind === 'resource' ? ' tv-lane-res' : ''));
      if (l.sub) text(svg, X[l.id], TOP - 12, l.sub, "tv-sub");
    });

    var g = el('g', { 'clip-path': 'url(#' + id + '-clip)' }, svg);

    (spec.segments || []).forEach(function (s) {
      var x = X[s.lane];
      el('line', { x1: x, y1: Y(s.from), x2: x, y2: Y(s.to), 'class': 'tv-seg tv-' + s.state }, g);
      if (s.label) {
        var right = x < W - 120;
        text(g, x + (right ? 9 : -9), (Y(s.from) + Y(s.to)) / 2 + 4, s.label, 'tv-seg-label tv-' + s.state + '-text', right ? 'start' : 'end');
      }
    });
    // Start dots and end caps per thread lane
    lanes.forEach(function (l) {
      if (l.kind === 'resource') return;
      var segs = (spec.segments || []).filter(function (s) { return s.lane === l.id; });
      if (!segs.length) return;
      var start = Math.min.apply(null, segs.map(function (s) { return s.from; }));
      var end = Math.max.apply(null, segs.map(function (s) { return s.to; }));
      el('circle', { cx: X[l.id], cy: Y(start), r: 4, 'class': 'tv-dot' }, g);
      if (!l.open) el('line', { x1: X[l.id] - 6, y1: Y(end), x2: X[l.id] + 6, y2: Y(end), 'class': 'tv-cap' }, g);
    });

    (spec.arrows || []).forEach(function (a) {
      var kind = a.kind || 'msg';
      var x1 = X[a.from], x2 = X[a.to];
      var dir = x2 > x1 ? 1 : -1;
      var pad = (lanes.filter(function (l) { return l.id === a.to; })[0] || {}).kind === 'resource' ? 30 : 7;
      var padFrom = (lanes.filter(function (l) { return l.id === a.from; })[0] || {}).kind === 'resource' ? 30 : 7;
      var y1 = Y(a.at), y2 = Y(a.at + (a.dt == null ? 0.35 : a.dt));
      el('line', { x1: x1 + dir * padFrom, y1: y1, x2: x2 - dir * pad, y2: y2, 'class': 'tv-arrow tv-' + kind, 'marker-end': 'url(#' + id + '-h-' + kind + ')' }, g);
      if (a.label) text(g, (x1 + x2) / 2, (y1 + y2) / 2 - 6, a.label, 'tv-arrow-label tv-' + kind + '-text');
    });

    (spec.marks || []).forEach(function (m) {
      var x = X[m.lane], y = Y(m.at);
      var right = x < W - 140;
      el('circle', { cx: x, cy: y, r: 5, 'class': 'tv-mark tv-mark-' + (m.kind || 'ok') }, g);
      text(g, x + (right ? 11 : -11), y + 4, m.label, 'tv-mark-label tv-mark-' + (m.kind || 'ok') + '-text', right ? 'start' : 'end');
    });

    var cursor = el('line', { x1: LEFT - 6, x2: W - 6, y1: TOP, y2: TOP, 'class': 'tv-cursor' }, svg);

    // Legend built from what this diagram uses
    var used = {};
    (spec.segments || []).forEach(function (s) { used[s.state] = 1; });
    (spec.arrows || []).forEach(function (a) { used[a.kind || 'msg'] = 1; });
    var legend = document.createElement('div');
    legend.className = 'tv-legend';
    Object.keys(LEGEND).forEach(function (k) {
      if (!used[k]) return;
      var item = document.createElement('span');
      var isLine = ['run', 'blocked', 'wait'].indexOf(k) >= 0;
      item.innerHTML = '<svg width="22" height="10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" class="' +
        (isLine ? 'tv-seg tv-' + k : 'tv-arrow tv-' + k) + '"/></svg>' + LEGEND[k];
      legend.appendChild(item);
    });

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tv-play';
    btn.textContent = '↻ Replay';

    var stage = document.createElement('div');
    stage.className = 'tv-stage';
    stage.appendChild(svg);
    stage.appendChild(btn);
    var cap = fig.querySelector('figcaption');
    fig.insertBefore(stage, cap);
    fig.insertBefore(legend, cap);

    var raf = null;
    function show(t) {
      var y = Y(t);
      clipRect.setAttribute('height', y + 8);
      cursor.setAttribute('y1', y);
      cursor.setAttribute('y2', y);
      cursor.style.opacity = t >= spec.T ? 0 : 1;
    }
    function play() {
      if (raf) cancelAnimationFrame(raf);
      var ms = (spec.speed || 550) * spec.T;
      var t0 = null;
      function step(now) {
        if (t0 === null) t0 = now;
        var t = Math.min(spec.T, (now - t0) / ms * spec.T);
        show(t);
        if (t < spec.T) raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
    }
    btn.addEventListener('click', play);

    if (reduceMotion || !('IntersectionObserver' in window)) { show(spec.T); return; }
    show(0);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { play(); io.disconnect(); }
      });
    }, { threshold: 0.4 });
    io.observe(stage);
  }

  document.querySelectorAll('figure.tviz').forEach(render);
})();
