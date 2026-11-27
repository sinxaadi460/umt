/* VidyaSetu — common JS */
(function () {
    'use strict';
    /* ---------------- Sweet popup (own, no library) ---------------- */
    var ICON = {
        success: '<svg viewBox="0 0 80 80" class="sp-ic sp-ok"><circle cx="40" cy="40" r="34"/><path d="M24 41l11 11 22-24"/></svg>',
        error: '<svg viewBox="0 0 80 80" class="sp-ic sp-err"><circle cx="40" cy="40" r="34"/><path d="M28 28l24 24M52 28L28 52"/></svg>',
        warning: '<svg viewBox="0 0 80 80" class="sp-ic sp-warn"><circle cx="40" cy="40" r="34"/><path d="M40 22v24"/><circle cx="40" cy="56" r="2.6"/></svg>',
        info: '<svg viewBox="0 0 80 80" class="sp-ic sp-info"><circle cx="40" cy="40" r="34"/><circle cx="40" cy="25" r="2.6"/><path d="M40 35v22"/></svg>',
        question: '<svg viewBox="0 0 80 80" class="sp-ic sp-q"><circle cx="40" cy="40" r="34"/><path d="M31 31a9 9 0 1 1 13 8c-3 2-4 3-4 7"/><circle cx="40" cy="55" r="2.6"/></svg>'
    };
    var EN = !!(window.APP && APP.lang === 'en');
    var L = function (hi, en) { return EN ? en : hi; };
    var TITLE = EN ? { success: 'Done! 🎉', error: 'Oops!', warning: 'Please note', info: 'Information', question: 'Are you sure?' }
        : { success: 'Ho gaya! 🎉', error: 'Oops!', warning: 'Dhyan dein', info: 'Jaankari', question: 'Pakka?' };
    function escH(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
    function popup(type, title, text, opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            var w = document.createElement('div');
            w.className = 'sp-wrap';
            w.innerHTML = '<div class="sp-box sp-' + type + '" role="dialog" aria-modal="true"><div class="sp-burst"></div>' + (ICON[type] || ICON.info) +
                '<h3>' + escH(title || TITLE[type]) + '</h3><p>' + escH(text || '') + '</p><div class="sp-btns">' +
                (opts.cancel ? '<button type="button" class="btn btn-light sp-no">' + escH(opts.cancel) + '</button>' : '') +
                '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + ' sp-yes">' + escH(opts.ok || 'OK') + '</button></div></div>';
            document.body.appendChild(w);
            requestAnimationFrame(function () { w.classList.add('in'); });
            var yes = w.querySelector('.sp-yes'); yes.focus();
            function close(v) { w.classList.remove('in'); w.classList.add('out'); setTimeout(function () { w.remove(); }, 260); document.removeEventListener('keydown', key); resolve(v); }
            function key(e) { if (e.key === 'Escape') close(false); if (e.key === 'Enter') { e.preventDefault(); close(true); } }
            document.addEventListener('keydown', key);
            yes.onclick = function () { close(true); };
            var no = w.querySelector('.sp-no'); if (no) no.onclick = function () { close(false); };
            w.addEventListener('click', function (e) { if (e.target === w) close(false); });
        });
    }
    function toast(type, text) {
        var box = document.querySelector('.sp-toasts');
        if (!box) { box = document.createElement('div'); box.className = 'sp-toasts'; document.body.appendChild(box); }
        var t = document.createElement('div');
        t.className = 'sp-toast sp-' + type;
        t.innerHTML = (ICON[type] || ICON.info) + '<span>' + escH(text) + '</span><i class="sp-bar"></i>';
        box.appendChild(t);
        requestAnimationFrame(function () { t.classList.add('in'); });
        function rm() { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 300); }
        t.onclick = rm; setTimeout(rm, 4500);
    }
    window.SPop = {
        alert: function (type, title, text) { return popup(type, title, text); },
        confirm: function (text, opts) { return popup('question', (opts && opts.title) || TITLE.question, text, Object.assign({ cancel: L('Nahi', 'No'), ok: L('Haan, karo', 'Yes, do it') }, opts || {})); },
        toast: toast
    };
    window.alert = function (m) { popup('info', '', String(m)); };

    // flash messages from the server -> toast (short success / info) or popup (errors, long text)
    document.querySelectorAll('script.flash-data').forEach(function (s) {
        var list = []; try { list = JSON.parse(s.textContent); } catch (e) { }
        var chain = Promise.resolve();
        list.forEach(function (f) {
            if ((f.t === 'success' || f.t === 'info') && f.m.length < 90) toast(f.t, f.m);
            else chain = chain.then(function () { return popup(f.t, '', f.m); });
        });
    });

    // confirm buttons / links -> sweet confirm
    document.addEventListener('click', function (e) {
        var el = e.target.closest('[data-confirm]');
        if (!el) return;
        if (el.dataset.spOk === '1') { el.dataset.spOk = ''; return; }
        e.preventDefault(); e.stopPropagation();
        var danger = el.classList.contains('btn-danger');
        SPop.confirm(el.getAttribute('data-confirm'), { danger: danger, ok: danger ? L('Haan, delete', 'Yes, delete') : L('Haan, karo', 'Yes, do it') }).then(function (ok) {
            if (!ok) return;
            el.dataset.spOk = '1';
            if (el.tagName === 'A') { location.href = el.href; return; }
            el.click();
        });
    }, true);
    // submit buttons show a spinner (no double submit)
    document.addEventListener('submit', function (e) {
        var b = e.submitter;
        if (!b || b.classList.contains('no-spin')) return;
        if (b.name) { var h = document.createElement('input'); h.type = 'hidden'; h.name = b.name; h.value = b.value; e.target.appendChild(h); }
        setTimeout(function () { if (e.defaultPrevented) return; b.disabled = true; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + escH(b.textContent.trim()); }, 0);
    });

    // Sidebar: page change par scroll position wahi rahe (top par na bhage)
    var sideNav = document.querySelector('.side-nav');
    if (sideNav) {
        var KEY = 'sideScroll:' + (document.body.className.match(/panel-\w+/) || ['p'])[0];
        try {
            var saved = sessionStorage.getItem(KEY);
            if (saved !== null) sideNav.scrollTop = +saved;
            var act = sideNav.querySelector('a.active');
            if (act) {
                var r = act.getBoundingClientRect(), n = sideNav.getBoundingClientRect();
                if (r.top < n.top || r.bottom > n.bottom) act.scrollIntoView({ block: 'center' });
            }
        } catch (e) { }
        var save = function () { try { sessionStorage.setItem(KEY, String(sideNav.scrollTop)); } catch (e) { } };
        sideNav.addEventListener('scroll', save, { passive: true });
        sideNav.addEventListener('click', save);
        window.addEventListener('beforeunload', save);
    }

    // Logo / mohar / signature upload: safed background hata kar transparent PNG (admin + institute branding)
    (function () {
        document.querySelectorAll('.js-brand').forEach(function (inp) {
            inp.addEventListener('change', function () {
                var f = inp.files[0], key = inp.dataset.key, wb = document.querySelector('.js-white[data-key="' + key + '"]'), hid = inp.form.querySelector('input[name="' + key + '_data"]');
                hid.value = '';
                if (!f || !wb || !wb.checked) return;
                var img = new Image();
                img.onload = function () {
                    var s = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
                    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
                    var g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
                    var d = g.getImageData(0, 0, c.width, c.height), p = d.data, minX = c.width, minY = c.height, maxX = 0, maxY = 0;
                    for (var i = 0; i < p.length; i += 4) {
                        var lum = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
                        if (lum > 200) p[i + 3] = 0; else if (lum > 150) p[i + 3] = Math.round(255 * (200 - lum) / 50); // soft edge
                        if (p[i + 3] > 40) { var x = (i / 4) % c.width, y = Math.floor(i / 4 / c.width); if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
                    }
                    g.putImageData(d, 0, 0);
                    if (maxX <= minX) return;
                    var pad = 6, o = document.createElement('canvas'); o.width = maxX - minX + pad * 2; o.height = maxY - minY + pad * 2;
                    o.getContext('2d').drawImage(c, minX - pad, minY - pad, o.width, o.height, 0, 0, o.width, o.height); // crop empty margins
                    hid.value = o.toDataURL('image/png');
                    var pv = inp.parentElement.querySelector('.brand-pv'); pv.innerHTML = ''; var im = new Image(); im.src = hid.value; im.style.maxHeight = '72px'; im.style.maxWidth = '100%'; pv.appendChild(im);
                    inp.value = ''; // send only the cleaned PNG
                    SPop.toast('success', L('Background hata diya — Save dabayein.', 'Background removed — press Save.'));
                };
                img.src = URL.createObjectURL(f);
            });
        });
    })();

    // AJAX helper
    window.apiPost = function (url, data) {
        var fd = data instanceof FormData ? data : new FormData();
        if (!(data instanceof FormData)) Object.keys(data || {}).forEach(function (k) { fd.append(k, typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]); });
        fd.append('_csrf', (window.APP && APP.csrf) || '');
        return fetch(url, { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-Requested-With': 'fetch' } })
            .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'Server error (' + r.status + ')' }; }); });
    };

    // table search filter (client side)
    document.querySelectorAll('[data-filter-table]').forEach(function (inp) {
        var tbl = document.querySelector(inp.getAttribute('data-filter-table'));
        inp.addEventListener('input', function () {
            var q = inp.value.toLowerCase();
            tbl.querySelectorAll('tbody tr').forEach(function (tr) { tr.style.display = tr.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none'; });
        });
    });

    // select-all checkboxes
    document.querySelectorAll('[data-check-all]').forEach(function (cb) {
        cb.addEventListener('change', function () {
            document.querySelectorAll(cb.getAttribute('data-check-all')).forEach(function (x) { if (x.closest('tr') && x.closest('tr').style.display === 'none') return; x.checked = cb.checked; x.dispatchEvent(new Event('change', { bubbles: true })); });
        });
    });

    // image preview for file inputs
    document.querySelectorAll('input[type=file][data-preview]').forEach(function (inp) {
        inp.addEventListener('change', function () {
            var img = document.querySelector(inp.getAttribute('data-preview'));
            if (img && inp.files[0]) { img.src = URL.createObjectURL(inp.files[0]); img.style.display = ''; }
        });
    });

    /* ---------------- Help bot ---------------- */
    var box = document.getElementById('eduBot');
    if (!box) return;
    var cfg = {};
    try { cfg = JSON.parse(box.getAttribute('data-bot')); } catch (e) { }
    var fab = box.querySelector('.ebot-fab'), panel = box.querySelector('.ebot-box'), msgs = box.querySelector('.ebot-msgs'),
        quick = box.querySelector('.ebot-quick'), form = box.querySelector('.ebot-form'), started = false;
    box.querySelector('.ebot-head b').textContent = cfg.name || 'Help';
    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function say(text, who, html) {
        var m = document.createElement('div');
        m.className = 'm ' + (who || 'bot');
        if (html) m.innerHTML = text; else m.textContent = text;
        msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight;
    }
    function typing(cb) {
        var t = document.createElement('div'); t.className = 'm bot'; t.textContent = '...'; msgs.appendChild(t); msgs.scrollTop = msgs.scrollHeight;
        setTimeout(function () { t.remove(); cb(); }, 450);
    }
    function renderQuick() {
        quick.innerHTML = '';
        (cfg.faq || []).forEach(function (f, i) { var b = document.createElement('button'); b.type = 'button'; b.textContent = f.q; b.onclick = function () { ask(f.q); }; quick.appendChild(b); });
        (cfg.links || []).forEach(function (l) { var a = document.createElement('a'); a.href = l[1]; a.textContent = '➜ ' + l[0]; quick.appendChild(a); });
        var wa = document.createElement('a'); wa.className = 'wa'; wa.href = cfg.wa; wa.target = '_blank'; wa.rel = 'noopener'; wa.innerHTML = '<i class="fa-brands fa-whatsapp"></i> WhatsApp ' + esc(cfg.phone || ''); quick.appendChild(wa);
    }
    function score(q, f) {
        var words = q.toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; });
        var hay = (f.q + ' ' + f.a).toLowerCase(), s = 0;
        words.forEach(function (w) { if (hay.indexOf(w) > -1) s += f.q.toLowerCase().indexOf(w) > -1 ? 2 : 1; });
        return s;
    }
    function ask(q) {
        say(q, 'me');
        var best = null, bs = 0;
        (cfg.faq || []).forEach(function (f) { var s = score(q, f); if (s > bs) { bs = s; best = f; } });
        typing(function () {
            if (best && bs > 0) say(best.a);
            else say(L('Is sawal ka jawab abhi mere paas nahi hai. 🙏 Neeche WhatsApp button se seedha team se baat karein — ', 'I don\x27t have an answer to this yet. 🙏 Talk to our team directly with the WhatsApp button below — ') + (cfg.phone || ''));
        });
    }
    fab.addEventListener('click', function () {
        panel.hidden = !panel.hidden;
        box.querySelector('.ebot-ping').style.display = 'none';
        if (!started && !panel.hidden) { started = true; say(cfg.hello || 'Namaste!'); renderQuick(); }
    });
    box.querySelector('.ebot-x').addEventListener('click', function () { panel.hidden = true; });
    form.addEventListener('submit', function (e) { e.preventDefault(); var i = form.querySelector('input'); var v = i.value.trim(); if (v) { ask(v); i.value = ''; } });
})();
