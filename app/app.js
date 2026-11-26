// Интерфейс тренажёра. Логика (повторение, тесты, замки, файл прогресса) — в srs.js.
// Путь по разделу: Изучение (картинки + подписи) → Тест (все ответы верны с первого раза — следующий раздел открыт).
// Дальше — «Повторить сегодня» (карточки с переворотом) и итоговый экзамен после всех разделов.
(function () {
  'use strict';
  const { LEV, PASS, EXAM_N, shuf, score } = SRS;
  const KEY = 'argus-srs', KEY_SEC = 'argus-sec';
  const app = document.getElementById('app'), modal = document.getElementById('modal'),
    mbox = document.getElementById('mbox'), fimp = document.getElementById('fimp');

  let DATA = [], T = [], ART = {}, S = null, st = {}, sec = {};
  const lastTypes = {};   // типы вопросов прошлой попытки — при пересдаче даём другие
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- хранение ----
  let storageOk = true;
  const load = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  st = load(KEY); sec = load(KEY_SEC);
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(st)); localStorage.setItem(KEY_SEC, JSON.stringify(sec)); }
    catch (e) { if (storageOk) { storageOk = false; toast('Прогресс не сохраняется в этом браузере. Используйте «Сохранить прогресс».'); } }
  };
  const lv = id => SRS.lv(st, id);
  const due = id => SRS.due(st, id);
  const grade = (id, ok) => { SRS.grade(st, id, ok); save(); };
  const dueList = () => T.filter(t => due(t.id) && SRS.isOpen(sec, t.si));
  const artOf = (t, kind = 'what') => (ART[`${t.si + 1}-${t.ti + 1}`] || {})[kind];
  const hasPic = t => !!artOf(t);
  const isOpen = si => SRS.isOpen(sec, si);
  const passedN = () => DATA.filter((s, si) => SRS.passed(sec, si)).length;

  function toast(msg, ms = 3500) {
    const d = document.createElement('div');
    d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }
  const top = () => window.scrollTo(0, 0);

  // ---- главная ----
  function home() {
    S = null;
    const d = dueList().length, known = T.filter(t => lv(t.id) >= 4).length;
    const next = DATA.findIndex((s, si) => isOpen(si) && !SRS.passed(sec, si));
    const pn = passedN(), examOpen = SRS.allPassed(sec, DATA.length);
    app.innerHTML = `<div class="top"><div><h1>Словарь безопасности Argus</h1><div class="mut">${T.length} терминов · ${DATA.length} разделов · сдано разделов: ${pn} из ${DATA.length} · запомнено надолго: ${known}</div></div>
 <button id="bexam" ${examOpen ? '' : 'disabled'} title="${examOpen ? '' : 'Откроется, когда сданы все разделы'}">${examOpen ? 'Итоговый экзамен' : `🔒 Экзамен (сдано ${pn} из ${DATA.length})`}</button></div>
 <div class="hero"><div class="today"><div><div class="sm">Повторить сегодня</div><div class="big">${d}</div><div class="sm">${d ? 'карточек ждут повторения' : pn ? 'всё повторено — можно дальше' : 'начните с первого раздела'}</div></div>
 <div class="acts">${d ? '<button class="w" id="bdue">Повторить</button>' : ''}${next >= 0 ? `<button id="bnext" class="${d ? '' : 'w'}">${st[T.find(t => t.si === next).id] ? 'Продолжить' : 'Начать'}: раздел ${next + 1}</button>` : ''}</div></div>
 <div class="map"><div class="sm" style="font-weight:600;margin-bottom:12px">Карта знаний — каждая клетка один термин</div>
 ${DATA.map((s, si) => `<div class="grp${isOpen(si) ? '' : ' locked'}"><div class="lab">${isOpen(si) ? '' : '🔒 '}${si + 1}. ${esc(s.title)}</div><div class="cells">${s.terms.map((t, ti) => { const id = si + '-' + ti; return `<button class="cell l${lv(id)}" data-c="${id}" title="${esc(t.t)} — ${LEV[lv(id)]}" aria-label="${esc(t.t)} — ${LEV[lv(id)]}"></button>`; }).join('')}</div></div>`).join('')}
 <div class="legend">${LEV.map((n, i) => `<span><i class="l${i}"></i>${n}</span>`).join('')}</div></div></div>
 <div class="secs">${DATA.map((s, si) => {
      const n = s.terms.length, k = s.terms.filter((t, ti) => lv(si + '-' + ti) >= 3).length, best = sec[si];
      const open = isOpen(si), ok = SRS.passed(sec, si);
      const status = ok ? `<span class="ok-badge">✓ сдан · ${best}%</span>` : !open ? `🔒 откроется после раздела ${si}` : best != null ? `не сдан · лучший ${best}%, нужно ${PASS}%` : 'не начат';
      return `<div class="sec${open ? '' : ' locked'}"><div><h3>${si + 1}. ${esc(s.title)}</h3><p>${esc(s.intro)}</p></div><div><div class="sm mut">${status}</div><div class="bar"><b style="width:${k / n * 100}%"></b></div><div class="sm mut">${k} из ${n} терминов уверенно</div></div>
 <div class="acts">${open ? `<button class="pri" data-s="${si}">Изучить</button><button data-q="${si}">Тест</button><button data-p="${si}" title="Промпт для разговора с Claude">Промпт</button>` : ''}</div></div>`;
    }).join('')}</div>
 <div class="backup"><h3>Резервная копия прогресса</h3><p class="sm mut" style="margin:0 0 12px">Прогресс хранится только на этом телефоне. Сохраняйте файл раз в неделю и перед сменой телефона.</p>
 <div class="acts"><button id="bexp" ${Object.keys(st).length || pn ? '' : 'disabled'}>Сохранить прогресс</button><button id="bimp">Загрузить прогресс</button></div></div>
 <p class="sm mut" style="margin-top:20px">Как учиться: раздел → «Изучить» (картинки и объяснения) → «Тест» (все ответы без ошибок — тогда откроется следующий раздел) → разговор с Claude по промпту. На следующий день — «Повторить».</p>`;
    app.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.s) study(+b.dataset.s);
      else if (b.dataset.q) sectionTest(+b.dataset.q);
      else if (b.dataset.p) prompt(+b.dataset.p);
      else if (b.dataset.c) { const si = +b.dataset.c.split('-')[0]; if (isOpen(si)) peek(b.dataset.c); else toast(`Раздел ${si + 1} откроется после сдачи раздела ${si}`); }
      else if (b.id == 'bdue') cards(shuf(dueList()), 'Повторение на сегодня');
      else if (b.id == 'bnext') study(next);
      else if (b.id == 'bexam') exam();
      else if (b.id == 'bexp') exportProgress();
      else if (b.id == 'bimp') { fimp.value = ''; fimp.click(); }
    };
    top();
  }

  function back(t) {
    return `<div class="t">${esc(t.t)}</div>
 <div class="row"><div class="k">Простыми словами</div><div class="x">${esc(t.d)}</div></div>
 ${t.e ? `<div class="row risk"><div class="k">Чем грозит / пример</div><div class="x">${esc(t.e)}</div></div>` : ''}
 ${t.a ? `<div class="row"><div class="k">Где в Argus</div><span class="code">${esc(t.a)}</span></div>` : ''}`;
  }
  function peek(id) {
    const t = T.find(x => x.id == id);
    openM(`<div class="tag mut">${esc(DATA[t.si].title)} · ${LEV[lv(id)]}</div>${artOf(t) ? `<div class="pic" style="margin:10px 0"><img src="art/${esc(artOf(t))}" alt=""></div>` : ''}<div class="back-m">${back(t)}</div><div class="acts" style="margin-top:16px"><button class="dark" data-x>Закрыть</button></div>`);
  }
  function openM(h) { mbox.innerHTML = h; modal.classList.add('on'); mbox.querySelector('button')?.focus(); }
  const closeM = () => modal.classList.remove('on');
  modal.onclick = e => {
    if (e.target == modal || e.target.closest('[data-x]')) closeM();
    const c = e.target.closest('[data-copy]');
    if (c) {
      const txt = mbox.querySelector('pre').textContent;
      const fail = () => { c.textContent = 'Выделите текст и скопируйте вручную'; };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => { c.textContent = 'Скопировано'; }, fail); else fail();
    }
  };

  // ---- изучение: картинка «что это» + подпись, комикс «чем грозит» + подпись ----
  function study(si, list, title) {
    if (!isOpen(si)) return toast(`Раздел ${si + 1} откроется после сдачи раздела ${si}`);
    S = { m: 's', si, list: list || T.filter(t => t.si === si), i: 0, title: title || DATA[si].title }; drawStudy();
  }
  function drawStudy() {
    const { list, i } = S, t = list[i], w = artOf(t), r = artOf(t, 'risk'), last = i === list.length - 1;
    app.innerHTML = `<div class="view"><div class="crumbs"><button id="bh">← Все разделы</button><span class="mut sm">${esc(S.title)} · изучение · ${i + 1} / ${list.length}</span></div>
 <div class="prog"><b style="width:${(i + 1) / list.length * 100}%"></b></div>
 <div id="stv"><div class="st-term">${esc(t.t)}</div>
 ${w ? `<div class="st-pic"><img src="art/${esc(w)}" alt="Картинка: что такое ${esc(t.t)}" draggable="false"></div>` : ''}
 <div class="st-cap"><div class="k">Что это</div><div class="x">${esc(t.d)}</div></div>
 ${r ? `<div class="st-pic"><img src="art/${esc(r)}" alt="Комикс: чем грозит" draggable="false"></div>` : ''}
 ${t.e ? `<div class="st-cap risk"><div class="k">Чем грозит</div><div class="x">${esc(t.e)}</div></div>` : ''}
 ${t.a ? `<div class="st-cap"><div class="k">Пункт Argus</div><span class="code">${esc(t.a)}</span></div>` : ''}</div>
 <div class="st-nav"><button id="sp" ${i ? '' : 'disabled'}>← Назад</button><button class="pri" id="sn">${last ? 'К тесту →' : 'Дальше →'}</button></div></div>`;
    app.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id == 'bh') home();
      else if (b.id == 'sp') stepStudy(-1);
      else if (b.id == 'sn') stepStudy(1);
    };
    bindHSwipe(document.getElementById('stv'), dir => stepStudy(dir));
    top();
  }
  function stepStudy(dir) {
    if (!S || S.m !== 's') return;
    const n = S.i + dir;
    if (n < 0) return;
    if (n >= S.list.length) return sectionTest(S.si);
    S.i = n; drawStudy();
  }
  // свайп по экрану изучения: влево — дальше, вправо — назад
  function bindHSwipe(el, cb) {
    let x0 = 0, y0 = 0, on = false;
    el.addEventListener('pointerdown', e => { on = true; x0 = e.clientX; y0 = e.clientY; });
    el.addEventListener('pointerup', e => {
      if (!on) return; on = false;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) cb(dx < 0 ? 1 : -1);
    });
    el.addEventListener('pointercancel', () => { on = false; });
  }

  // ---- повторение: карточки с переворотом ----
  function cards(list, title) {
    if (!list.length) return home();
    S = { m: 'c', list: [...list], i: 0, title, miss: [], again: new Set() }; drawCard();
  }
  function drawCard() {
    const { list, i } = S, t = list[i], a = artOf(t), again = S.again.has(t.id);
    app.innerHTML = `<div class="view"><div class="crumbs"><button id="bh">← Все разделы</button><span class="mut sm">${esc(S.title)} · ${i + 1} / ${list.length}</span></div>
 <div class="prog"><b style="width:${i / list.length * 100}%"></b></div>
 <div class="card" id="cd" tabindex="0" role="button" aria-label="Перевернуть карточку"><span class="swipe-l" id="sl">Не вспомнил</span><span class="swipe-r" id="sr">Вспомнил</span><div class="inner">
 <div class="face front"><div class="tag">${esc(DATA[t.si].title)} · ${again ? 'ещё раз' : LEV[lv(t.id)]}</div>
 ${a ? `<div class="pic"><img src="art/${esc(a)}" alt="Иллюстрация к термину" draggable="false"></div>` : ''}
 <div class="big">${esc(t.t)}</div><div class="hint">Объясните вслух своими словами, потом коснитесь карточки</div></div>
 <div class="face back">${back(t)}<div class="hint mut sm" style="margin-top:auto">Свайп вправо — вспомнил, влево — не вспомнил</div></div></div></div>
 <div class="ans" id="ans" style="visibility:hidden"><button id="bn">Не вспомнил</button><button class="pri" id="by">Вспомнил</button></div>
 <div class="keys">Пробел — перевернуть · 1 — не вспомнил · 2 — вспомнил</div></div>`;
    app.onclick = e => {
      const b = e.target.closest('button,#cd'); if (!b) return;
      if (b.id == 'bh') home();
      else if (b.id == 'cd') { if (!swipe.justDragged) flip(); }
      else if (b.id == 'bn') rate(0);
      else if (b.id == 'by') rate(1);
    };
    bindSwipe(document.getElementById('cd'));
    top();
  }
  const isFlipped = () => document.getElementById('cd')?.classList.contains('f');
  function flip() { const c = document.getElementById('cd'); c.classList.toggle('f'); document.getElementById('ans').style.visibility = 'visible'; }
  // «Не вспомнил» — карточка уходит в конец колоды и вернётся, пока не вспомните.
  function rate(ok) {
    if (S.busy) return;
    const t = S.list[S.i];
    grade(t.id, ok);   // ошибся сегодня → даже если потом вспомнил, повтор завтра (см. srs.js)
    if (!ok) { S.miss.push(t); S.again.add(t.id); S.list.push(t); }
    S.i++;
    if (S.i < S.list.length) drawCard();
    else { const weak = [...new Set(S.miss)], n = new Set(S.list.map(x => x.id)).size; done(n - weak.length, n, weak, S.title); }
  }

  // Свайп карточки: работает только после переворота — сначала нужно увидеть ответ.
  const swipe = { justDragged: false };
  function bindSwipe(el) {
    let x0 = 0, y0 = 0, dx = 0, drag = false, down = false;
    const sl = el.querySelector('#sl'), sr = el.querySelector('#sr');
    const reset = () => { el.classList.remove('drag'); el.style.transform = ''; sl.style.opacity = 0; sr.style.opacity = 0; };
    el.addEventListener('pointerdown', e => { if (e.button > 0) return; down = true; drag = false; dx = 0; x0 = e.clientX; y0 = e.clientY; swipe.justDragged = false; });
    el.addEventListener('pointermove', e => {
      if (!down) return;
      dx = e.clientX - x0; const dy = e.clientY - y0;
      if (!drag && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) { drag = true; el.classList.add('drag'); try { el.setPointerCapture(e.pointerId); } catch (_) {} }
      if (!drag) return;
      const k = isFlipped() ? 1 : 0.25;
      el.style.transform = `translateX(${dx * k}px) rotate(${dx * k / 30}deg)`;
      if (isFlipped()) { sr.style.opacity = Math.max(0, Math.min(1, dx / 90)); sl.style.opacity = Math.max(0, Math.min(1, -dx / 90)); }
    });
    const end = () => {
      if (!down) return; down = false;
      if (!drag) return;
      swipe.justDragged = true; setTimeout(() => { swipe.justDragged = false; }, 50);
      if (Math.abs(dx) > 90 && isFlipped() && !S.busy) {
        const ok = dx > 0 ? 1 : 0;
        el.classList.remove('drag');
        el.style.transform = `translateX(${ok ? 130 : -130}%) rotate(${ok ? 12 : -12}deg)`; el.style.opacity = 0;
        S.busy = true; setTimeout(() => { S.busy = false; rate(ok); }, 200);
      } else {
        if (Math.abs(dx) > 90 && !isFlipped()) toast('Сначала переверните карточку', 1800);
        reset();
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { down = false; if (drag) reset(); });
  }

  // ---- тест раздела и экзамен ----
  function sectionTest(si) {
    if (!isOpen(si)) return toast(`Раздел ${si + 1} откроется после сдачи раздела ${si}`);
    const list = T.filter(t => t.si === si);
    startQuiz(SRS.buildTest(list, list, hasPic, lastTypes), `Тест: раздел ${si + 1}`, si, list);
  }
  function exam() {
    if (!SRS.allPassed(sec, DATA.length)) return toast('Экзамен откроется, когда сданы все разделы');
    const list = SRS.examPick(T, DATA.length, EXAM_N);
    startQuiz(SRS.buildTest(list, T, () => false, lastTypes), 'Итоговый экзамен', 'exam', T);
  }
  function startQuiz(qs, title, si, pool) {
    qs.forEach(q => { lastTypes[q.t.id] = q.ty; });
    S = { m: 'q', qs, i: 0, title, si, pool, n: qs.length, ok: 0, miss: [], res: {} }; drawQ();
  }
  // Сверху всегда понятно, где вы: «Вопрос 3 из 13» или «Работа над ошибками: 1 из 2».
  function stepLabel() {
    if (S.i < S.n) return `Вопрос ${S.i + 1} из ${S.n}`;
    return `Работа над ошибками: ${S.i - S.n + 1} из ${S.qs.length - S.n}`;
  }
  function drawQ() {
    const q = S.qs[S.i], pic = q.pic && artOf(q.t);
    app.innerHTML = `<div class="view"><div class="crumbs"><button id="bh">← Выйти</button><span class="mut sm">${esc(S.title)}</span></div>
 <div class="q-step"><b>${stepLabel()}</b>${q.re ? '<span class="re-badge">на оценку не влияет</span>' : ''}</div>
 <div class="prog"><b style="width:${S.i / S.qs.length * 100}%"></b></div>
 <div class="q"><div class="q-hint">${esc(q.hint)}</div>
 ${pic ? `<div class="pic q-pic"><img src="art/${esc(pic)}" alt="Картинка без подписи"></div>` : ''}${q.ask ? `<div class="ask">${esc(q.ask)}</div>` : ''}</div>
 <div class="opts">${q.opts.map((o, k) => `<button data-o="${o.id}">${k + 1}. ${esc(o.txt)}</button>`).join('')}</div><div id="fb"></div></div>`;
    app.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.id == 'bh') { if (confirm('Выйти из теста? Ответы этого теста не засчитаются для сдачи раздела.')) home(); } else if (b.dataset.o && !S.ans) pick(b.dataset.o); else if (b.id == 'bnx') nextQ(); };
    S.ans = false; top();
  }
  function pick(id) {
    const q = S.qs[S.i], ok = id == q.t.id; S.ans = true;
    if (!q.re) {
      grade(q.t.id, ok);
      const r = S.res[q.t.si] || (S.res[q.t.si] = { ok: 0, n: 0 }); r.n++;
      if (ok) { S.ok++; r.ok++; }
      else { S.miss.push(q.t); S.qs.push(SRS.reAsk(q, S.pool, S.si === 'exam' ? () => false : hasPic)); }
    } else if (ok) grade(q.t.id, true);   // разобрал ошибку — повтор завтра, а не сегодня (на оценку не влияет)
    app.querySelectorAll('[data-o]').forEach(b => { if (b.dataset.o == q.t.id) b.classList.add('right'); else if (b.dataset.o == id) b.classList.add('wrong'); b.disabled = b.dataset.o != q.t.id && b.dataset.o != id; });
    const more = S.i + 1 < S.qs.length, toErrors = more && S.i + 1 === S.n;
    document.getElementById('fb').innerHTML = `<div class="fb ${ok ? 'fb-ok' : 'fb-bad'}"><div class="fb-h">${ok ? '✓ Верно' : '✗ Неверно'}</div>
 <div><b>${esc(q.t.t)}</b> — ${esc(q.t.d)}</div>
 ${!ok && !q.re ? '<div class="sm mut" style="margin-top:6px">Этот термин спросим ещё раз в конце — в «работе над ошибками».</div>' : ''}</div>
 <button class="pri" id="bnx">${!more ? 'Посмотреть итог' : toErrors ? 'К работе над ошибками →' : 'Дальше'}</button>`;
    const nx = document.getElementById('bnx'); nx.focus({ preventScroll: true }); nx.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function nextQ() { S.i++; if (S.i < S.qs.length) drawQ(); else quizDone(); }

  function quizDone() {
    const { ok, n, si, title } = S, pct = score(ok, n), weak = [...new Set(S.miss)];
    if (si === 'exam') return examDone(pct, weak);
    const was = SRS.passed(sec, si);
    sec[si] = Math.max(sec[si] || 0, pct); save();
    const pass = pct >= PASS, nextOpen = pass && si + 1 < DATA.length;
    S = { m: 'r' };
    app.innerHTML = `<div class="view res"><div class="crumbs"><button id="bh">← Все разделы</button><span class="mut sm">${esc(title)}</span></div>
 <div class="big ${pass ? '' : 'bad'}">${pct}%</div><h2>${pass ? (was ? 'Раздел сдан снова' : 'Раздел сдан!') : 'Пока не сдан'}</h2>
 <p style="margin-top:8px">Верно с первого раза: <b>${ok} из ${n}</b>. Для сдачи нужно ${n} из ${n} — без единой ошибки.</p>
 <p class="mut" style="margin-top:10px">${pass ? (nextOpen ? `Открыт раздел ${si + 2}: «${esc(DATA[si + 1].title)}».` : si + 1 === DATA.length ? 'Это был последний раздел.' : '') : 'Есть ошибки — следующий раздел пока закрыт. Повторите слабые термины и пройдите тест заново с первого вопроса (вопросы будут другие).'}</p>
 ${weak.length ? `<p class="mut" style="margin-top:14px">Слабые термины — вернутся в повторение:</p><ul class="weak">${weak.map(t => `<li>${esc(t.t)}</li>`).join('')}</ul>` : ''}
 <div class="acts" style="margin-top:16px">${pass ? (nextOpen ? `<button class="pri" id="bns">Раздел ${si + 2} →</button>` : SRS.allPassed(sec, DATA.length) ? '<button class="pri" id="bex">Итоговый экзамен</button>' : '') : `${weak.length ? '<button class="pri" id="bw">Повторить слабые</button>' : ''}<button id="brt">Пересдать</button>`}
 ${weak.length ? '<button id="bp">Промпт для Claude по слабым</button>' : ''}<button id="bh2">К разделам</button></div></div>`;
    app.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id == 'bh' || b.id == 'bh2') home();
      else if (b.id == 'bns') study(si + 1);
      else if (b.id == 'bex') exam();
      else if (b.id == 'bw') study(si, weak, 'Слабые термины');
      else if (b.id == 'brt') sectionTest(si);
      else if (b.id == 'bp') prompt(null, weak);
    };
    top();
  }
  function examDone(pct, weak) {
    const res = S.res; S = { m: 'r' };
    app.innerHTML = `<div class="view res"><div class="crumbs"><button id="bh">← Все разделы</button><span class="mut sm">Итоговый экзамен</span></div>
 <div class="big">${pct}%</div><h2>Итог по разделам</h2>
 <div class="exam-rows">${DATA.map((s, si) => { const r = res[si] || { ok: 0, n: 0 }, p = score(r.ok, r.n); return `<div class="exam-row"><span>${si + 1}. ${esc(s.title)}</span><span class="${p >= PASS ? '' : 'bad'}">${r.ok} из ${r.n}</span></div>`; }).join('')}</div>
 ${weak.length ? `<p class="mut" style="margin-top:14px">Слабые термины:</p><ul class="weak">${weak.map(t => `<li>${esc(t.t)}</li>`).join('')}</ul>` : '<p>Ни одной ошибки — отлично!</p>'}
 <div class="acts" style="margin-top:16px">${weak.length ? '<button class="pri" id="bw">Повторить слабые</button><button id="bp">Промпт для Claude по слабым</button>' : ''}<button id="bh2">К разделам</button></div></div>`;
    app.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id == 'bh' || b.id == 'bh2') home();
      else if (b.id == 'bw') cards(shuf(weak), 'Слабые термины');
      else if (b.id == 'bp') prompt(null, weak);
    };
    top();
  }

  function done(ok, n, miss, title) {
    const pct = score(ok, n); S = { m: 'r' };
    app.innerHTML = `<div class="view res"><div class="crumbs"><button id="bh">← Все разделы</button><span class="mut sm">${esc(title)}</span></div>
 <div class="big">${pct}%</div><h2>${ok} из ${n} вспомнили с первого раза</h2>
 ${miss.length ? `<p class="mut" style="margin-top:14px">Трудные сегодня — повторим завтра:</p><ul class="weak">${miss.map(t => `<li>${esc(t.t)}</li>`).join('')}</ul>` : ''}
 <div class="acts" style="margin-top:16px">${miss.length ? '<button id="bp">Промпт для Claude по трудным</button>' : ''}<button class="pri" id="bh2">К разделам</button></div></div>`;
    app.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.id == 'bh' || b.id == 'bh2') home(); else if (b.id == 'bp') prompt(null, miss); };
    top();
  }

  // ---- промпт для Claude (текст из прототипа) ----
  const PR = `Ты — мой наставник по информационной безопасности для владельца бизнеса без опыта программирования. Я делаю для клиентов Telegram-ботов, сайты и интеграции через ИИ-помощника и проверяю их своей программой OMNI Argus. Моя цель — уверенно отвечать клиентам и разработчикам на вопросы о безопасности, надёжности и расходах.
Тема сегодня: TOPIC
Как учить:
1. По одному термину: объясни в 2–3 предложениях простыми словами, без кода.
2. Приведи пример из малого бизнеса (бот записи, интернет-магазин, CRM): что случится, если это не сделано, и сколько это может стоить.
3. Задай мне вопрос на понимание и жди ответа. Не подсказывай, пока я не отвечу.
4. Оцени ответ: что верно, что упущено. Если я ошибся — объясни иначе и спроси ещё раз.
5. После всех терминов — 3 вопроса «клиент спрашивает…»: я отвечаю так, как ответил бы клиенту.
6. В конце — список терминов, которые я знаю плохо, чтобы повторить через 2–3 дня.
Правила: по-русски, коротко, по одному вопросу за раз; не выдумывай — если не уверен, так и скажи.`;
  function prompt(si, list) {
    const topic = si != null ? `${DATA[si].title}: ${DATA[si].terms.map(t => t.t).join('; ')}` : `Слабые термины: ${list.map(t => t.t).join('; ')}`;
    openM(`<h2 style="font-size:26px">Промпт для разговора с Claude</h2><p class="mut sm">Откройте новый чат, вставьте целиком.</p><pre>${esc(PR.replace('TOPIC', topic))}</pre><div class="acts"><button class="pri" data-copy>Скопировать</button><button data-x>Закрыть</button></div>`);
  }

  // ---- сохранить / загрузить прогресс ----
  async function exportProgress() {
    const data = JSON.stringify(SRS.exportData(st, sec), null, 1);
    const dt = new Date(), p2 = n => String(n).padStart(2, '0'); // местная дата, а не UTC
    const name = `argus-progress-${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}.json`;
    const blob = new Blob([data], { type: 'application/json' });
    // На телефоне — меню «Поделиться» (сохранить в Файлы, отправить себе в Telegram).
    const touch = matchMedia('(pointer:coarse)').matches;
    if (touch && navigator.canShare) {
      try {
        const file = new File([blob], name, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Прогресс Argus' }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Файл ' + name + ' сохранён в «Загрузки»');
  }
  fimp.addEventListener('change', () => {
    const f = fimp.files && fimp.files[0]; if (!f) return;
    if (f.size > 1e6) { toast('Файл слишком большой — это не файл прогресса'); return; }
    const r = new FileReader();
    r.onload = () => {
      let res;
      try { res = SRS.importData(JSON.parse(r.result), new Set(T.map(t => t.id)), DATA.length); }
      catch (e) { toast('Не получилось загрузить: ' + (e instanceof SyntaxError ? 'файл повреждён' : e.message)); return; }
      const inc = Object.keys(res.srs).length, incS = Object.values(res.sec).filter(v => v >= PASS).length;
      if (!confirm(`Заменить текущий прогресс (${Object.keys(st).length} терм., сдано разделов: ${passedN()}) на прогресс из файла (${inc} терм., сдано разделов: ${incS})? Текущий прогресс будет потерян.`)) return;
      st = res.srs; sec = res.sec; save(); home();
      toast(`Прогресс загружен: ${inc} терминов, сдано разделов: ${incS}${res.skipped ? `, пропущено записей: ${res.skipped}` : ''}`);
    };
    r.onerror = () => toast('Не получилось прочитать файл');
    r.readAsText(f);
  });

  // ---- клавиатура (для компьютера) ----
  document.addEventListener('keydown', e => {
    if (modal.classList.contains('on')) { if (e.key == 'Escape') closeM(); return; }
    if (!S) return;
    if (S.m == 'c') {
      const f = isFlipped();
      if (e.key == ' ' || (e.key == 'Enter' && e.target.id == 'cd')) { e.preventDefault(); flip(); }
      else if (f && e.key == '1') rate(0); else if (f && e.key == '2') rate(1);
    } else if (S.m == 's') {
      if (e.key == 'ArrowRight') stepStudy(1); else if (e.key == 'ArrowLeft') stepStudy(-1);
    } else if (S.m == 'q') {
      if (!S.ans && /^[1-4]$/.test(e.key)) { const b = app.querySelectorAll('[data-o]')[+e.key - 1]; b && pick(b.dataset.o); }
      else if (S.ans && e.key == 'Enter') { e.preventDefault(); nextQ(); }
    }
  });

  // ---- запуск ----
  async function start() {
    try {
      const r = await fetch('data/terms.json'); if (!r.ok) throw new Error(r.status);
      DATA = await r.json();
    } catch (e) {
      app.innerHTML = '<h2>Не удалось загрузить термины</h2><p class="mut">Откройте приложение ещё раз при включённом интернете.</p>'; return;
    }
    try { const r = await fetch('art/art.json'); if (r.ok) ART = await r.json(); } catch (e) { ART = {}; }
    T = []; DATA.forEach((s, si) => s.terms.forEach((t, ti) => T.push({ ...t, si, ti, id: si + '-' + ti })));
    home();
  }
  start();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    // Пришла новая версия приложения — один раз перезагружаемся, чтобы сразу её показать.
    // (При самой первой установке не перезагружаем: старой версии ещё не было.)
    if (navigator.serviceWorker.controller) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return; reloaded = true;
        if (!S || S.m === 'r') location.reload(); // не прерываем изучение, карточки и тест на середине
      });
    }
  }
})();
