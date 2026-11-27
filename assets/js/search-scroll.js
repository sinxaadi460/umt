/* Search + scroll everywhere: dropdowns, long tables, lists (VidyaSetu) */
(function () {
    var MIN_OPTS = 7, MIN_ROWS = 8;
    function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

    // 1) Searchable dropdown: native <select> stays (form submit, onchange etc.), we add a search panel on top
    function enhanceSelect(sel) {
        if (sel.multiple || sel.dataset.ss || sel.hasAttribute('data-no-search') || sel.options.length < MIN_OPTS || sel.closest('.ss-wrap') || sel.closest('[data-no-search], .dz-props')) return;
        sel.dataset.ss = '1';
        var wrap = document.createElement('div'); wrap.className = 'ss-wrap';
        if (sel.style.width) wrap.style.width = sel.style.width;
        if (sel.style.maxWidth) wrap.style.maxWidth = sel.style.maxWidth;
        sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel);
        sel.classList.add('ss-native'); sel.tabIndex = -1;
        var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'input ss-btn';
        var pop = document.createElement('div'); pop.className = 'ss-pop'; pop.hidden = true;
        pop.innerHTML = '<div class="ss-search"><i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Search / dhundein..." autocomplete="off"></div><div class="ss-list" role="listbox"></div><div class="ss-foot"></div>';
        wrap.appendChild(btn); wrap.appendChild(pop);
        var inp = pop.querySelector('input'), list = pop.querySelector('.ss-list'), foot = pop.querySelector('.ss-foot'), act = -1;
        function label() { var o = sel.options[sel.selectedIndex]; btn.textContent = o ? o.text : ''; btn.title = btn.textContent; btn.disabled = sel.disabled; btn.classList.remove('ss-invalid'); }
        function items() { return Array.prototype.slice.call(list.querySelectorAll('.ss-opt:not([hidden])')); }
        function build() {
            list.innerHTML = '';
            Array.prototype.forEach.call(sel.options, function (o, i) {
                var d = document.createElement('div'); d.className = 'ss-opt' + (i === sel.selectedIndex ? ' on' : '') + (o.disabled ? ' dis' : '');
                d.textContent = o.text || ' '; d.dataset.i = i;
                if (o.parentNode && o.parentNode.tagName === 'OPTGROUP') d.dataset.g = o.parentNode.label;
                list.appendChild(d);
            });
        }
        function filter() {
            var q = norm(inp.value), n = 0;
            list.querySelectorAll('.ss-opt').forEach(function (d) { var hit = !q || norm(d.textContent + ' ' + (d.dataset.g || '')).indexOf(q) > -1; d.hidden = !hit; if (hit) n++; });
            foot.textContent = n + ' / ' + sel.options.length;
            var its = items(), on = -1;
            its.forEach(function (d, i) { if (d.classList.contains('on')) on = i; });
            setAct(q ? 0 : on);
        }
        function setAct(i) {
            var its = items(); its.forEach(function (d) { d.classList.remove('act'); });
            act = Math.max(-1, Math.min(i, its.length - 1));
            if (act >= 0) { its[act].classList.add('act'); its[act].scrollIntoView({ block: 'nearest' }); }
        }
        function pick(i) {
            var o = sel.options[i]; if (!o || o.disabled) return;
            if (sel.selectedIndex !== i) { sel.selectedIndex = i; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
            label(); close(); btn.focus();
        }
        function open() {
            if (sel.disabled) return;
            document.querySelectorAll('.ss-pop').forEach(function (p) { if (p !== pop) { p.hidden = true; p.parentNode.classList.remove('open'); } });
            build(); inp.value = ''; pop.hidden = false; wrap.classList.add('open'); filter(); inp.focus();
        }
        function close() { pop.hidden = true; wrap.classList.remove('open'); }
        btn.addEventListener('click', function () { pop.hidden ? open() : close(); });
        btn.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
            else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey) { e.preventDefault(); open(); inp.value = e.key; filter(); }
        });
        inp.addEventListener('input', filter);
        inp.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAct(act + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(act - 1); }
            else if (e.key === 'Enter') { e.preventDefault(); var its = items(); if (its[act]) pick(+its[act].dataset.i); }
            else if (e.key === 'Escape' || e.key === 'Tab') { close(); btn.focus(); }
        });
        list.addEventListener('mousedown', function (e) { var d = e.target.closest('.ss-opt'); if (d) { e.preventDefault(); pick(+d.dataset.i); } });
        document.addEventListener('mousedown', function (e) { if (!wrap.contains(e.target)) close(); });
        sel.addEventListener('change', label);
        sel.addEventListener('invalid', function () { btn.classList.add('ss-invalid'); });
        if (sel.form) sel.form.addEventListener('reset', function () { setTimeout(label, 0); });
        label();
        synced.push(function () { var t = (sel.options[sel.selectedIndex] || {}).text || ''; if (t !== btn.textContent || btn.disabled !== sel.disabled) label(); });
    }
    var synced = [];
    setInterval(function () { synced.forEach(function (f) { f(); }); }, 600); // value set by page scripts (no change event)

    // 2) Long tables: search box on top + own scroll with sticky header
    function enhanceTable(tbl) {
        if (tbl.dataset.ts || tbl.hasAttribute('data-no-search') || !tbl.tBodies[0]) return;
        if (tbl.tBodies[0].rows.length < MIN_ROWS) return;
        tbl.dataset.ts = '1';
        var box = tbl.closest('.table-wrap');
        if (box) box.classList.add('ts-scroll');
        var anchor = box || tbl;
        if (tbl.id && document.querySelector('[data-filter-table="#' + tbl.id + '"]')) return; // page already has its own search
        var bar = document.createElement('div'); bar.className = 'ts-bar';
        bar.innerHTML = '<div class="ss-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Is list me search karein..."></div><span class="small muted ts-count"></span>';
        anchor.parentNode.insertBefore(bar, anchor);
        var inp = bar.querySelector('input'), cnt = bar.querySelector('.ts-count');
        function run() {
            var q = norm(inp.value), n = 0, all = tbl.tBodies[0].rows;
            Array.prototype.forEach.call(all, function (tr) { var hit = !q || norm(tr.textContent).indexOf(q) > -1; tr.style.display = hit ? '' : 'none'; if (hit) n++; });
            cnt.textContent = n + ' / ' + all.length;
        }
        inp.addEventListener('input', run); run();
    }

    // 3) Simple lists: <input data-filter-list="#box"> filters [data-row] children
    function enhanceListFilter(inp) {
        if (inp.dataset.fl) return; inp.dataset.fl = '1';
        var box = document.querySelector(inp.getAttribute('data-filter-list')); if (!box) return;
        inp.addEventListener('input', function () { var q = norm(inp.value); box.querySelectorAll('[data-row]').forEach(function (r) { r.style.display = !q || norm(r.textContent).indexOf(q) > -1 ? '' : 'none'; }); });
    }

    function scan(root) {
        root = root || document;
        root.querySelectorAll('select').forEach(enhanceSelect);
        root.querySelectorAll('table.tbl').forEach(enhanceTable);
        root.querySelectorAll('[data-filter-list]').forEach(enhanceListFilter);
    }
    window.SearchScroll = { scan: scan, select: enhanceSelect };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(); }); else scan();
})();
