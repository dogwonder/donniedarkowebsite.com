/* shared stage behaviour for level 4.
   - fitStage(): letterbox-scale the 800x500 stage to the viewport.
   - assemble(): reveal pre-split .w words one at a time, then fire callback. */

(function () {

  /* period-correct chrome: registration crop-brackets + edge ticks, the way a
     2001 Hi-ReS! stage framed itself. monochrome, adapts to dark/paper via CSS. */
  function buildChrome() {
    var stage = document.querySelector('.stage');
    if (!stage || stage.querySelector('.chrome')) return;
    var c = document.createElement('div');
    c.className = 'chrome';
    c.setAttribute('aria-hidden', 'true');
    ['tl', 'tr', 'bl', 'br'].forEach(function (k) {
      var r = document.createElement('span'); r.className = 'reg ' + k; c.appendChild(r);
    });
    /* [edge, position-fraction, length-px] */
    [['t', 0.30, 6], ['t', 0.63, 4], ['b', 0.44, 6], ['b', 0.80, 4],
     ['l', 0.50, 6], ['r', 0.37, 5], ['r', 0.72, 4]].forEach(function (t) {
      var e = document.createElement('span'), edge = t[0], pos = (t[1] * 100) + '%', len = t[2] + 'px';
      if (edge === 't') { e.className = 'tick v'; e.style.top = '0'; e.style.left = pos; e.style.height = len; }
      else if (edge === 'b') { e.className = 'tick v'; e.style.bottom = '0'; e.style.left = pos; e.style.height = len; }
      else if (edge === 'l') { e.className = 'tick h'; e.style.left = '0'; e.style.top = pos; e.style.width = len; }
      else { e.className = 'tick h'; e.style.right = '0'; e.style.top = pos; e.style.width = len; }
      c.appendChild(e);
    });
    stage.appendChild(c);
  }
  window.addEventListener('load', buildChrome);
  buildChrome();

  /* reveal words (.w) in document order inside `root`.
     opts: { per: ms-between-words, start: initial delay, done: fn } */
  window.assemble = function (root, opts) {
    opts = opts || {};
    var per = opts.per || 120;
    var start = opts.start || 0;
    var done = opts.done;
    var words = Array.prototype.slice.call(root.querySelectorAll('.w'));
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      words.forEach(function (w) { w.classList.add('in'); });
      if (done) setTimeout(done, 0);
      return;
    }
    words.forEach(function (w, i) {
      setTimeout(function () { w.classList.add('in'); }, start + i * per);
    });
    if (done) setTimeout(done, start + words.length * per + 120);
  };
})();
