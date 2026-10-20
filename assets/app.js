// Баловень — общие скрипты
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // мобильное меню
  const header = $('header');
  $('.burger')?.addEventListener('click', () => header.classList.toggle('open'));

  // открыто / закрыто по московскому времени
  const st = $('[data-open-status]');
  if (st) {
    const h = +new Intl.DateTimeFormat('ru-RU', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Moscow' }).format(new Date());
    const open = h >= 10 && h < 23;
    st.textContent = open ? 'Сейчас открыто · до 23:00' : 'Сейчас закрыто · откроемся в 10:00';
    if (!open) $('[data-open-dot]')?.classList.add('closed');
  }

  // фильтр афиши
  const filters = $('[data-filters]');
  if (filters) {
    const apply = f => {
      $$('.chip', filters).forEach(c => c.classList.toggle('on', c.dataset.f === f));
      let total = 0;
      $$('[data-month]').forEach(m => {
        let n = 0;
        $$('.ev', m).forEach(e => { const ok = f === 'all' || e.dataset.cat === f; e.classList.toggle('hide', !ok); if (ok) n++; });
        m.classList.toggle('hide', !n); total += n;
      });
      $('[data-empty]').style.display = total ? 'none' : 'block';
    };
    $$('.chip', filters).forEach(c => c.addEventListener('click', () => apply(c.dataset.f)));
  }

  // вкладки меню (+ переход по #breakfast / #lunch)
  const tabs = $('[data-tabs]');
  if (tabs) {
    const show = id => {
      if (!$('#' + id + '.tab-pane')) return;
      $$('.tab', tabs).forEach(t => t.classList.toggle('on', t.dataset.tab === id));
      $$('.tab-pane').forEach(p => p.classList.toggle('on', p.id === id));
    };
    $$('.tab', tabs).forEach(t => t.addEventListener('click', () => { show(t.dataset.tab); history.replaceState(null, '', '#' + t.dataset.tab); }));
    $$('[data-tab-link]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); show(a.dataset.tabLink); history.replaceState(null, '', '#' + a.dataset.tabLink); tabs.scrollIntoView({ behavior: 'smooth' }); }));
    const fromHash = () => {
      const h = location.hash.slice(1);
      if (h && $('#' + h + '.tab-pane')) { show(h); setTimeout(() => tabs.scrollIntoView(), 50); }
    };
    fromHash();
    addEventListener('hashchange', fromHash);

    // подсветка раздела меню при прокрутке
    const links = $$('.side-in a');
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-40% 0px -55% 0px' });
    $$('.mcat').forEach(s => io.observe(s));
  }

  // дни недели в ланче, сегодняшний — по умолчанию
  $$('[data-week]').forEach(w => {
    const btns = $$('.wd', w), panes = $$('.wd-pane', w);
    const sel = i => { btns.forEach(b => b.classList.toggle('on', +b.dataset.day === i)); panes.forEach(p => p.classList.toggle('on', +p.dataset.day === i)); };
    btns.forEach(b => b.addEventListener('click', () => sel(+b.dataset.day)));
    const d = (new Date().getDay() + 6) % 7; // пн = 0
    if (d < 5) { btns[d].classList.add('today'); sel(d); }
  });

  // формы
  $$('[data-form]').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); f.classList.add('done'); }));

  // форма бронирования: столик / мероприятие / банкет
  const bf = $('[data-booking]');
  if (bf) {
    const labels = { table: 'Забронировать столик', event: 'Забронировать столик', banq: 'Отправить заявку' };
    const sel = $('[data-event-select]', bf), picked = $('.picked', bf);
    const showPicked = () => { picked.innerHTML = 'Столик на событие: <b>' + sel.options[sel.selectedIndex].text + '</b>'; picked.classList.add('on'); };
    const setMode = m => {
      bf.dataset.mode = m;
      $$('.seg button', bf).forEach(b => b.classList.toggle('on', b.dataset.m === m));
      $('[data-submit]', bf).textContent = labels[m];
      m === 'event' ? showPicked() : picked.classList.remove('on');
    };
    $$('.seg button', bf).forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));
    sel.addEventListener('change', showPicked);
    const q = new URLSearchParams(location.search);
    if (q.get('event')) sel.value = q.get('event');
    if (q.get('type')) setMode(q.get('type'));
  }
})();

/* ---------- голосовой поиск ---------- */
(function () {
  const ov = document.getElementById('searchOv');
  if (!ov) return;
  const INDEX = window.BALOVEN_INDEX || [];
  const ROOT = document.body.dataset.root || '';
  const input = document.getElementById('sInput');
  const results = document.getElementById('sResults');
  const status = document.getElementById('sStatus');
  const HINT = status.textContent;

  const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const stem = (w) => (w.length > 4 ? w.replace(/(ами|ями|ого|его|ому|ему|ыми|ими|ах|ях|ов|ев|ей|ой|ий|ый|ая|яя|ое|ее|ую|юю|ам|ям|ом|ем|ы|и|а|я|е|у|ю|о|ь)$/, '') : w);
  const STOP = new Set('я мы вы хочу хотим хотелось хотелось бы бы мне нам нас у в во на с со к ко по за для и или а но что как где когда какой какая какие есть ли можно нужно надо пожалуйста покажи покажите найди найдите подскажи подскажите посоветуй есть это там тут вас у вас ваш ваше ваши сегодня завтра чтобы чем ну вот еще ещё очень что-нибудь какое-нибудь'.split(' '));
  const prepared = INDEX.map((r) => ({ r, title: norm(r.t), body: norm(r.t + ' ' + r.d + ' ' + r.k) }));

  function search(q) {
    const words = norm(q).split(' ').filter((w) => w && !STOP.has(w)).map(stem);
    if (!words.length) return [];
    const out = [];
    prepared.forEach((x) => {
      let score = 0, hit = 0;
      words.forEach((w) => {
        if (x.title.includes(w)) { score += 3; hit++; }
        else if (x.body.includes(w)) { score += 1; hit++; }
      });
      if (hit) out.push({ r: x.r, hit, score: score + hit * 2 });
    });
    const best = Math.max(0, ...out.map((x) => x.hit));
    return out.filter((x) => best < 2 || x.hit >= best).sort((a, b) => b.score - a.score).slice(0, 12).map((x) => x.r);
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function render(q) {
    if (!q.trim()) { results.innerHTML = ''; return; }
    const found = search(q);
    if (!found.length) {
      results.innerHTML = `<div class="s-empty"><p>Пока не нашли «${esc(q)}». Позвоните — подскажем: <a href="tel:+74992357367">+7 499 235 73 67</a></p><a class="btn btn-primary" href="${ROOT}booking.html">Забронировать стол</a></div>`;
      return;
    }
    const groups = {};
    found.forEach((r) => (groups[r.g] = groups[r.g] || []).push(r));
    results.innerHTML = Object.keys(groups).map((g) => `<div class="s-group"><h6>${esc(g)}</h6>` + groups[g].map((r) =>
      `<a class="s-item" href="${ROOT}${r.u}"><span class="dot2" style="background:${r.c}"></span><span><span class="t">${esc(r.t)}</span><span class="d">${esc(r.d)}</span></span><span class="p">${esc(r.p)}</span></a>`).join('') + '</div>').join('');
  }

  function openSearch(q, voice) {
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    input.value = q || '';
    render(input.value);
    if (voice) startVoice(); else setTimeout(() => input.focus(), 50);
  }
  function closeSearch() {
    stopVoice();
    ov.classList.remove('open');
    document.body.style.overflow = '';
    status.textContent = HINT;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  const micBtn = ov.querySelector('.mic');
  function stopVoice() {
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    micBtn.classList.remove('listening');
    document.body.classList.remove('listening-on');
  }
  function startVoice() {
    if (rec) { stopVoice(); return; }
    if (!SR) {
      status.textContent = 'Голосовой ввод работает в Chrome, Edge, Safari и Яндекс Браузере. Напишите запрос текстом.';
      input.focus();
      return;
    }
    rec = new SR();
    rec.lang = 'ru-RU'; rec.interimResults = true; rec.continuous = false;
    micBtn.classList.add('listening');
    document.body.classList.add('listening-on');
    status.textContent = 'Слушаю… Например: «хочу пасту» или «квартирник в воскресенье»';
    let text = '';
    rec.onresult = (e) => {
      text = Array.from(e.results).map((r) => r[0].transcript).join('');
      input.value = text;
      render(text);
    };
    rec.onerror = (e) => {
      status.textContent = e.error === 'not-allowed' ? 'Разрешите доступ к микрофону в браузере — или напишите запрос текстом.'
        : e.error === 'no-speech' ? 'Ничего не услышали. Нажмите на микрофон и скажите ещё раз.'
        : 'Не получилось распознать. Попробуйте ещё раз или напишите текстом.';
    };
    rec.onend = () => {
      rec = null;
      micBtn.classList.remove('listening');
      document.body.classList.remove('listening-on');
      if (text) status.textContent = `Вы сказали: «${text}»`;
    };
    try { rec.start(); } catch (e) { stopVoice(); }
  }

  input.addEventListener('input', () => render(input.value));
  document.addEventListener('click', (e) => {
    const v = e.target.closest('[data-voice]');
    if (v) { e.preventDefault(); if (ov.contains(v)) startVoice(); else openSearch('', true); return; }
    const c = e.target.closest('[data-search]');
    if (c) { e.preventDefault(); openSearch(c.dataset.search); return; }
    if (e.target.closest('[data-close-search]') || e.target === ov) closeSearch();
  });
  document.querySelectorAll('form[data-inline-search]').forEach((f) => f.addEventListener('submit', (e) => {
    e.preventDefault();
    openSearch(f.querySelector('input').value);
  }));
  results.addEventListener('click', (e) => { if (e.target.closest('a')) closeSearch(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ov.classList.contains('open')) closeSearch();
    else if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { e.preventDefault(); openSearch(''); }
  });
})();
