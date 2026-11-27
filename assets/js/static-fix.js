/* static-fix.js
   Uploaded photos / logos / course images live on the live server, not in this static copy.
   Instead of a broken-image icon, show a neat placeholder. Safe to delete once you serve real uploads. */
(function () {
  var AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#e7f6ee"/>' +
    '<circle cx="48" cy="38" r="17" fill="#9bd5b6"/><path d="M14 92c4-21 18-31 34-31s30 10 34 31z" fill="#9bd5b6"/></svg>');
  var BLANK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#eef5f1"/>' +
    '<path d="M38 52l16-18 12 13 8-9 16 14z" fill="#b9d8c8"/><circle cx="44" cy="30" r="6" fill="#b9d8c8"/></svg>');

  function fix(img) {
    if (!img || img.getAttribute('data-fb')) return;
    img.setAttribute('data-fb', '1');
    var portrait = img.classList.contains('thumb') || (img.parentNode && /hello|whobox|avatar/.test(img.parentNode.className || ''));
    img.src = portrait ? AVATAR : BLANK;
  }

  document.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'IMG') fix(e.target);
  }, true);

  function scan() {
    var imgs = document.images;
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].complete && imgs[i].naturalWidth === 0) fix(imgs[i]);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
  window.addEventListener('load', scan);
})();
