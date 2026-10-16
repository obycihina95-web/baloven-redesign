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
