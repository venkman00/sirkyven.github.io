(function () {
  var toggle = document.getElementById('theme-toggle');
  function sync() {
    if (toggle) toggle.setAttribute('aria-checked', String(document.body.classList.contains('theme-dark')));
  }
  function flip() {
    document.body.classList.toggle('theme-dark');
    try { localStorage.setItem('theme', document.body.classList.contains('theme-dark') ? 'dark' : 'light'); } catch (e) {}
    sync();
  }
  if (toggle) toggle.addEventListener('click', flip);
  window.addEventListener('keydown', function (e) {
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((e.key === 'd' || e.key === 'D') && !e.ctrlKey && !e.metaKey && !e.altKey) flip();
  });
  sync();

  // Heading anchors
  document.querySelectorAll('article h2[id], article h3[id], article h4[id]').forEach(function (h) {
    var a = document.createElement('a');
    a.href = '#' + h.id;
    a.className = 'anchor internal-link';
    a.setAttribute('aria-label', 'Link to this section');
    a.textContent = '#';
    h.appendChild(a);
  });
})();
