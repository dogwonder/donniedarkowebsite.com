// Level 4 — "Cellar Door". Shared helpers for the HTML-native level scenes
// (/cellar/door/…). Included per-page like missing.js, NOT bundled into app.min.js.
//
// Determinism: every helper that randomises honours a `?seed=<n>` query param.
// A real visitor gets Math.random (a true hunt); the headless walkthrough passes
// ?seed=42 so hotspot positions — and therefore the screenshots — are stable
// run-to-run. propagateSeed() carries the param across scene links so one seeded
// entry stays seeded through the whole level.

var level4Scripts = {

    // Small deterministic PRNG (mulberry32). Returns a () => [0,1) function.
    mulberry32: function(seed) {
        var a = seed >>> 0;
        return function() {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    // The page's random source: seeded when ?seed= is present, Math.random otherwise.
    random: function() {
        var seed = new URLSearchParams(window.location.search).get('seed');
        return seed != null ? this.mulberry32(parseInt(seed, 10) || 0) : Math.random;
    },

    // Position an absolutely-positioned hotspot at a random point within a band of
    // the 800×500 stage (canvas-local coords), as percentages so it scales with
    // the responsive .aspect-ratio box. Returns the chosen stage coords.
    placeHotspot: function(selector, band) {
        var el = document.querySelector(selector);
        if (!el) return null;
        var rnd = this.random();
        var x = band.x0 + rnd() * (band.x1 - band.x0);
        var y = band.y0 + rnd() * (band.y1 - band.y0);
        el.style.left = (x / 800) * 100 + '%';
        el.style.top = (y / 500) * 100 + '%';
        return { x: Math.round(x), y: Math.round(y) };
    },

    // Carry the current query string (the seed) onto every in-level link, so a
    // seeded run stays deterministic across all six scenes.
    propagateSeed: function() {
        if (!window.location.search) return;
        document.querySelectorAll('a[href^="/cellar/door/"]').forEach(function(a) {
            if (a.href.indexOf('?') === -1) a.href += window.location.search;
        });
    },

    // Word-by-word assembling type (missingScripts.animateText with a tunable
    // cadence and no audio). Fires `wordsFinished` on completion. The element
    // should start display:none so the full text never flashes before assembly.
    animateText: function(elementId, msPerWord) {
        var text = document.getElementById(elementId);
        if (!text) return;
        var delay = msPerWord || 90;
        // Split on ALL whitespace and drop empties — source indentation/newlines
        // would otherwise become invisible "words" that stall the assembly.
        var words = text.innerHTML.split(/\s+/).filter(function(w) { return w.length; });
        text.innerHTML = '';
        text.style.display = 'block';
        var promises = words.map(function(word, i) {
            return new Promise(function(resolve) {
                setTimeout(function() {
                    text.innerHTML += word + ' ';
                    resolve();
                }, i * delay);
            });
        });
        Promise.all(promises).then(function() {
            document.dispatchEvent(new CustomEvent('wordsFinished'));
            console.log('wordsFinished');
        });
    }

};
