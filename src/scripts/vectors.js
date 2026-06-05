/* ============================================================================
   vectors — the original's abstract angular shards, drawn into an inline SVG.
   one <svg class="vectors" viewBox="0 0 800 500" preserveAspectRatio="none">
   per stage; Vectors.build(svg, [ ...motifs ]) paints them in stage coords.
   motifs:
     {t:'needle', x,y, len, ang, w, color, op}        long thin spear/triangle
     {t:'rings',  x,y, n, rmin,rmax, spread, color, op, sw, seed}  ring cluster
     {t:'bundle', x,y, n, len, spread, ang, color, op, sw}  parallel line bundle
     {t:'band',   points, color, op}                  angular filled polygon
     {t:'cross',  x,y, r, color, op, sw, ring}         crosshair + (optional ring)
     {t:'dot',    x,y, r, color, op}                   small target dot
   ang is degrees; 0 = →, 90 = ↓.  red = #fc0d1b.
   ========================================================================== */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function rng(seed) { var s = seed || 1; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

  /* keyframes for animated motifs — injected once, honours reduced-motion */
  function ensureAnimCSS() {
    if (document.getElementById('vec-anim-css')) return;
    var s = document.createElement('style');
    s.id = 'vec-anim-css';
    s.textContent =
      '@keyframes vecSweep{from{stroke-dashoffset:var(--seg);}to{stroke-dashoffset:0;}}' +
      '@media (prefers-reduced-motion: reduce){[style*="vecSweep"]{animation:none!important;stroke-dasharray:none!important;}}';
    document.head.appendChild(s);
  }

  var V = {
    needle: function (svg, o) {
      var a = o.ang * Math.PI / 180, w = o.w == null ? 3 : o.w;
      var x2 = o.x + Math.cos(a) * o.len, y2 = o.y + Math.sin(a) * o.len;
      var px = Math.cos(a + Math.PI / 2) * w, py = Math.sin(a + Math.PI / 2) * w;
      var pts = [[o.x + px, o.y + py], [o.x - px, o.y - py], [x2, y2]]
        .map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
      svg.appendChild(el('polygon', { points: pts, fill: o.color || '#9a9a9a', opacity: o.op == null ? 0.5 : o.op }));
    },
    rings: function (svg, o) {
      var r = rng(o.seed), g = el('g', { opacity: o.op == null ? 0.85 : o.op });
      for (var i = 0; i < o.n; i++) {
        var rad = o.rmin + (o.rmax - o.rmin) * r();
        var ox = o.x + (r() - 0.5) * (o.spread || 80), oy = o.y + (r() - 0.5) * (o.spread || 80);
        g.appendChild(el('circle', { cx: ox.toFixed(1), cy: oy.toFixed(1), r: rad.toFixed(1),
          fill: 'none', stroke: o.color || '#fc0d1b', 'stroke-width': o.sw || 3 }));
      }
      svg.appendChild(g);
    },
    bundle: function (svg, o) {
      var a = o.ang * Math.PI / 180, g = el('g', { opacity: o.op == null ? 0.7 : o.op });
      ensureAnimCSS();
      for (var i = 0; i < o.n; i++) {
        var t = (o.n === 1 ? 0 : i / (o.n - 1) - 0.5);
        var ox = o.x + Math.cos(a + Math.PI / 2) * t * (o.spread || 40);
        var oy = o.y + Math.sin(a + Math.PI / 2) * t * (o.spread || 40);
        var len = o.len * (0.55 + 0.45 * Math.abs(Math.cos(t * 3.3)));
        var ln = el('line', { x1: ox.toFixed(1), y1: oy.toFixed(1),
          x2: (ox + Math.cos(a) * len).toFixed(1), y2: (oy + Math.sin(a) * len).toFixed(1),
          stroke: o.color || '#fc0d1b', 'stroke-width': o.sw || 1.4 });
        if (o.anim) {
          /* a bright pulse travels each line toward its origin end (top-right);
             stagger the phase across the bundle so the sweep crosses BL->TR */
          var pulse = Math.max(40, len * 0.32);
          ln.setAttribute('stroke-dasharray', pulse + ' ' + (len + pulse));
          ln.setAttribute('stroke-linecap', 'round');
          var dur = o.animDur || 2.6;
          var delay = (-(i / o.n) * dur).toFixed(2);
          ln.style.setProperty('--seg', (len + pulse).toFixed(1));
          ln.style.animation = 'vecSweep ' + dur + 's linear ' + delay + 's infinite';
        }
        g.appendChild(ln);
      }
      svg.appendChild(g);
    },
    band: function (svg, o) {
      svg.appendChild(el('polygon', { points: o.points, fill: o.color || '#c20a14', opacity: o.op == null ? 0.85 : o.op }));
    },
    cross: function (svg, o) {
      var r = o.r || 7, c = o.color || '#7a7a7a', sw = o.sw || 1, g = el('g', { opacity: o.op == null ? 0.7 : o.op });
      g.appendChild(el('line', { x1: o.x - r, y1: o.y, x2: o.x + r, y2: o.y, stroke: c, 'stroke-width': sw }));
      g.appendChild(el('line', { x1: o.x, y1: o.y - r, x2: o.x, y2: o.y + r, stroke: c, 'stroke-width': sw }));
      if (o.ring) g.appendChild(el('circle', { cx: o.x, cy: o.y, r: (r * 0.7).toFixed(1), fill: 'none', stroke: c, 'stroke-width': sw }));
      svg.appendChild(g);
    },
    dot: function (svg, o) {
      svg.appendChild(el('circle', { cx: o.x, cy: o.y, r: o.r || 2, fill: o.color || '#fc0d1b', opacity: o.op == null ? 1 : o.op }));
    }
  };

  window.Vectors = {
    build: function (svg, items) { (items || []).forEach(function (it) { if (V[it.t]) V[it.t](svg, it); }); }
  };
})();
