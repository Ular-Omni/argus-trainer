// Логика без интерфейса: интервальное повторение, замки разделов, вопросы тестов, экзамен,
// сохранение/загрузка прогресса. Проверяется автотестами (tests/srs.test.html).
(function (root) {
  'use strict';
  const IV = [0, 1, 3, 7, 14, 30]; // интервалы в днях для уровней 0..5
  const DAY = 864e5, HOUR = 36e5;
  const LEV = ['новый', 'учу', '1–3 дня', 'неделя', '2 недели', 'выучен'];
  const PASS = 80;        // порог сдачи теста раздела, %
  const EXAM_N = 40;      // вопросов в итоговом экзамене

  // ---------- интервальное повторение ----------
  // st = { "<раздел>-<термин>": { b: уровень 0..5, d: когда повторить (мс), w: сколько раз ошибся } }
  const lv = (st, id) => (st[id] ? st[id].b : 0);
  const due = (st, id, now = Date.now()) => !!st[id] && st[id].d <= now;

  // «Вспомнил» поднимает уровень, только если термин новый или срок уже подошёл
  // (зубрёжка в тот же день уровень не поднимает). «Не вспомнил» — уровень 1, повтор сразу.
  // Минус час — чтобы повтор «через 1 день» не уезжал из-за пары минут.
  function grade(st, id, ok, now = Date.now()) {
    const isNew = !st[id];
    const s = st[id] || { b: 0, d: 0, w: 0 };
    if (ok) {
      if (isNew || s.d <= now) s.b = Math.min(5, s.b + 1);
      s.d = now + IV[s.b] * DAY - HOUR;
    } else {
      s.b = 1;
      s.d = now;
      s.w = (s.w || 0) + 1;
    }
    st[id] = s;
    return s;
  }
  // Карточку «не вспомнил» показали ещё раз в том же заходе, и теперь вспомнил:
  // уровень остаётся 1, следующий повтор — завтра (а не «сегодня ещё раз»).
  function relearned(st, id, now = Date.now()) {
    const s = st[id] || { b: 1, d: 0, w: 0 };
    s.b = 1;
    s.d = now + IV[1] * DAY - HOUR;
    st[id] = s;
    return s;
  }

  function shuf(a, rnd = Math.random) {
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- разделы ----------
  // sec = { "<номер раздела 0..8>": лучший результат теста, % }
  const passed = (sec, si) => (sec[si] || 0) >= PASS;
  const isOpen = (sec, si) => si === 0 || passed(sec, si - 1);
  const allPassed = (sec, n) => Array.from({ length: n }, (_, i) => i).every(i => passed(sec, i));

  // ---------- вопросы ----------
  // d — определение → термин; e — ситуация → термин; r — «клиент спрашивает: что такое X?» → ответ;
  // p — картинка → термин (ответы текстом).
  function typesFor(t, hasPic) {
    const ty = ['d', 'r'];
    if (t.e) ty.push('e');
    if (hasPic) ty.push('p');
    return ty;
  }
  function mkQ(t, pool, rnd = Math.random, ty) {
    if (!ty) { const ts = typesFor(t, false); ty = ts[(rnd() * ts.length) | 0]; }
    let others = shuf(pool.filter(x => x.id !== t.id && (ty !== 'e' || x.e)), rnd).slice(0, 3);
    if (others.length < 3) { ty = 'd'; others = shuf(pool.filter(x => x.id !== t.id), rnd).slice(0, 3); }
    const opts = shuf([t, ...others], rnd);
    if (ty === 'r') return { t, ty, ask: `Клиент спрашивает: «Что такое ${t.t}?» Что ответите?`, opts: opts.map(x => ({ id: x.id, txt: x.d })) };
    const ask = ty === 'd' ? `Какой термин: «${t.d}»?`
      : ty === 'e' ? `Ситуация: «${t.e}». О каком термине речь?`
      : 'Что показано на картинке? Выберите термин';
    return { t, ty, ask, pic: ty === 'p', opts: opts.map(x => ({ id: x.id, txt: x.t })) };
  }
  // Тест: каждый термин один раз, типы вопросов вперемешку и поровну.
  // prev — какие типы были у терминов в прошлой попытке: при пересдаче стараемся дать другие.
  function buildTest(list, pool, hasPic = () => false, prev = {}, rnd = Math.random) {
    const used = {};
    return shuf(list, rnd).map(t => {
      let ts = typesFor(t, hasPic(t));
      if (ts.length > 1 && prev[t.id]) ts = ts.filter(x => x !== prev[t.id]);
      const min = Math.min(...ts.map(x => used[x] || 0));
      const cand = ts.filter(x => (used[x] || 0) === min);
      const ty = cand[(rnd() * cand.length) | 0];
      used[ty] = (used[ty] || 0) + 1;
      return mkQ(t, pool, rnd, ty);
    });
  }
  // Повтор ошибки в конце теста: тот же термин, но другой тип вопроса.
  function reAsk(q, pool, hasPic = () => false, rnd = Math.random) {
    const ts = typesFor(q.t, hasPic(q.t)).filter(x => x !== q.ty);
    const n = mkQ(q.t, pool, rnd, ts[(rnd() * ts.length) | 0]);
    n.re = true;
    return n;
  }
  // Экзамен: 40 терминов, из каждого раздела пропорционально его размеру.
  function examPick(T, nSec, n = EXAM_N, rnd = Math.random) {
    const by = Array.from({ length: nSec }, (_, si) => T.filter(t => t.si === si));
    const raw = by.map(a => (a.length / T.length) * n);
    const q = raw.map(Math.floor);
    let left = n - q.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { q[i]++; left--; } });
    return shuf(by.flatMap((a, i) => shuf(a, rnd).slice(0, q[i])), rnd);
  }

  const score = (ok, n) => (n ? Math.round((ok / n) * 100) : 0);

  // ---------- сохранение / загрузка прогресса ----------
  const FILE_KIND = 'argus-trainer-progress';

  function exportData(st, sec = {}, now = Date.now()) {
    return { kind: FILE_KIND, version: 2, saved: new Date(now).toISOString(), srs: st, sec };
  }

  // Файл приходит снаружи — проверяем всё и берём только понятные поля.
  // validIds — набор существующих id терминов; nSec — сколько разделов.
  function importData(obj, validIds, nSec = 9) {
    if (!obj || typeof obj !== 'object') throw new Error('Это не файл прогресса');
    const ours = obj.kind === FILE_KIND;
    const srs = ours ? obj.srs : obj;   // «голый» объект — прогресс из прототипа
    if (!srs || typeof srs !== 'object' || Array.isArray(srs)) throw new Error('В файле нет прогресса');
    const out = {};
    let skipped = 0;
    for (const id of Object.keys(srs)) {
      const v = srs[id];
      const okId = validIds.has(id);
      const okV = v && typeof v === 'object' &&
        Number.isInteger(v.b) && v.b >= 0 && v.b <= 5 &&
        Number.isFinite(v.d) && v.d >= 0 &&
        (v.w === undefined || (Number.isInteger(v.w) && v.w >= 0));
      if (okId && okV) out[id] = { b: v.b, d: v.d, w: v.w || 0 };
      else skipped++;
    }
    const sec = {};
    if (ours && obj.sec && typeof obj.sec === 'object' && !Array.isArray(obj.sec)) {
      for (const k of Object.keys(obj.sec)) {
        const i = Number(k), v = obj.sec[k];
        if (Number.isInteger(i) && i >= 0 && i < nSec && String(i) === k && Number.isFinite(v) && v >= 0 && v <= 100) sec[i] = Math.round(v);
        else skipped++;
      }
    }
    if (!Object.keys(out).length && !Object.keys(sec).length) throw new Error('В файле нет ни одного подходящего термина');
    return { srs: out, sec, skipped };
  }

  root.SRS = { IV, DAY, HOUR, LEV, PASS, EXAM_N, lv, due, grade, relearned, shuf, passed, isOpen, allPassed,
    typesFor, mkQ, buildTest, reAsk, examPick, score, exportData, importData };
})(typeof window !== 'undefined' ? window : globalThis);
