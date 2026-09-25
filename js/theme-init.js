/* Gewähltes Design (hell oder dunkel) vor dem ersten Zeichnen setzen, damit nichts aufblitzt. */
(function () {
  try {
    var t = localStorage.getItem('hexa-theme');
    if (t !== 'light' && t !== 'dark') return;
    document.documentElement.setAttribute('data-theme', t);
    var m = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < m.length; i++) m[i].setAttribute('content', t === 'dark' ? '#0D1020' : '#EDEFF4');
  } catch (e) { /* Speicher gesperrt */ }
})();
