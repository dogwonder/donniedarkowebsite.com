// Counts one page load with the stats Worker (workers/stats, #18). No cookies, no IDs, nothing about the visitor.
// Each site hosts its own copy, and each page names itself, since page IDs are never taken from URLs:
// <script src="/stats.js" data-endpoint="https://stats.co-local.co.uk/c" data-site="mysite" data-page="home" defer></script>
(() => {
  const { endpoint, site, page } = document.currentScript?.dataset ?? {};
  if (!endpoint || !site || !page || navigator.globalPrivacyControl || navigator.doNotTrack === "1") return;
  // text/plain keeps it a simple request, so there's no preflight and one count is one request
  const body = JSON.stringify({ site, page });
  if (!navigator.sendBeacon?.(endpoint, new Blob([body], { type: "text/plain" })))
    fetch(endpoint, { method: "POST", body, mode: "no-cors", keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
})();
