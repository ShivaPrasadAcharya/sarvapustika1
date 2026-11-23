/* A browser-side access screen. No SMS is sent; public files remain public. */
(() => {
  'use strict';
  const MOBILE = '9849667879', CODE = '1234';
  const KEY = 'raya.' + (location.pathname.split('/')[1] || 'local') + '.access.v1'; // unique per repo site
  const SIX_HOURS = 6 * 60 * 60 * 1000, ONE_HOUR = 60 * 60 * 1000;
  const $ = id => document.getElementById(id);
  let unlocked = false, numberAccepted = false, present = true;
  let memorySession = null, storageUnavailable = false, expiryTimer;

  function readSession() {
    if (storageUnavailable) return memorySession;
    let raw;
    try { raw = localStorage.getItem(KEY); }
    catch { storageUnavailable = true; return memorySession; }
    try { return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  }
  function writeSession(session) {
    memorySession = session;
    if (storageUnavailable) return;
    try { session ? localStorage.setItem(KEY, JSON.stringify(session)) : localStorage.removeItem(KEY); }
    catch { storageUnavailable = true; }
  }
  function validSession(session, now = Date.now()) {
    return !!session && Number.isFinite(session.startedAt) && Number.isFinite(session.expiresAt)
      && Number.isFinite(session.lastSeenAt) && session.expiresAt === session.startedAt + SIX_HOURS
      && now >= session.startedAt && now < session.expiresAt && session.lastSeenAt >= session.startedAt
      && session.lastSeenAt <= now;
  }
  function reusableSession(session, now = Date.now()) {
    if (!validSession(session, now)) return false;
    const lastOpen = session.closedAt === null ? session.lastSeenAt : session.closedAt;
    return Number.isFinite(lastOpen) && lastOpen >= session.startedAt && lastOpen <= now
      && now - lastOpen < ONE_HOUR;
  }
  function message(text = '') {
    $('access-message').textContent = text;
    $('access-message').hidden = !text;
    $('access-mobile').removeAttribute('aria-invalid');
    $('access-code').removeAttribute('aria-invalid');
  }
  function mobileStep() {
    numberAccepted = false;
    $('access-mobile-step').hidden = false;
    $('access-code-step').hidden = true;
    $('access-code').value = '';
    message();
  }
  function lock(text = '') {
    clearTimeout(expiryTimer);
    unlocked = false;
    if ($('preview').open) $('preview').close();
    $('catalogue-app').hidden = true;
    $('catalogue-app').setAttribute('inert', '');
    $('access-screen').hidden = false;
    mobileStep();
    $('access-mobile').value = '';
    message(text);
    $('access-mobile').focus();
  }
  function scheduleExpiry(session) {
    clearTimeout(expiryTimer);
    expiryTimer = setTimeout(checkOpenSession, Math.max(0, session.expiresAt - Date.now()));
  }
  function touch(session) {
    const next = {...session, lastSeenAt:Date.now(), closedAt:null};
    writeSession(next);
    scheduleExpiry(next);
  }
  function unlock(session) {
    unlocked = true;
    numberAccepted = false;
    message();
    $('access-code').value = '';
    $('access-mobile').value = '';
    $('access-screen').hidden = true;
    $('catalogue-app').hidden = false;
    $('catalogue-app').removeAttribute('inert');
    touch(session);
  }
  function checkOpenSession() {
    if (!unlocked || !present) return;
    const session = readSession();
    if (!validSession(session)) {
      writeSession(null);
      lock('Your session has expired. Please verify again.');
    } else touch(session);
  }
  function resume() {
    present = true;
    const session = readSession();
    if (reusableSession(session)) unlock(session);
    else {
      writeSession(null);
      lock(session ? 'Your session has expired. Please verify again.' : '');
    }
  }

  $('access-mobile-step').addEventListener('submit', event => {
    event.preventDefault();
    if ($('access-mobile').value.trim() !== MOBILE) {
      message('Please enter the correct mobile number.');
      $('access-mobile').setAttribute('aria-invalid', 'true');
      $('access-mobile').focus();
      return;
    }
    numberAccepted = true;
    message();
    $('access-mobile-step').hidden = true;
    $('access-code-step').hidden = false;
    $('access-code').value = '';
    $('access-code').focus();
  });
  $('access-code-step').addEventListener('submit', event => {
    event.preventDefault();
    if (!numberAccepted) { mobileStep(); $('access-mobile').focus(); return; }
    if (!/^[0-9]{4}$/.test($('access-code').value) || $('access-code').value !== CODE) {
      message('Please enter the correct 4-digit verification code.');
      $('access-code').setAttribute('aria-invalid', 'true');
      $('access-code').focus();
      return;
    }
    const now = Date.now();
    unlock({startedAt:now, expiresAt:now + SIX_HOURS, lastSeenAt:now, closedAt:null});
    $('search').focus();
  });
  $('access-change-number').addEventListener('click', () => { mobileStep(); $('access-mobile').focus(); });
  for (const id of ['access-mobile', 'access-code']) {
    $(id).addEventListener('input', () => {
      $(id).value = $(id).value.replace(/[^0-9]/g, '').slice(0, id === 'access-mobile' ? 10 : 4);
      message();
    });
  }
  // Clicking anywhere inside the clock's circle opens the catalogue: no mobile number, no code.
  (() => {
    const NS = 'http://www.w3.org/2000/svg', ticks = $('clock-ticks');
    for (let i = 0; i < 60; i++) {
      const long = i % 5 === 0, line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', 100); line.setAttribute('x2', 100);
      line.setAttribute('y1', long ? 10 : 14); line.setAttribute('y2', long ? 24 : 19);
      line.setAttribute('class', long ? 'clock-tick major' : 'clock-tick');
      line.setAttribute('transform', `rotate(${i * 6} 100 100)`);
      ticks.append(line);
    }
    const turn = (id, deg) => $(id).setAttribute('transform', `rotate(${deg} 100 100)`);
    function tick() {
      if ($('access-screen').hidden) return;
      const t = new Date(), s = t.getSeconds(), m = t.getMinutes() + s / 60, h = (t.getHours() % 12) + m / 60;
      turn('clock-second', s * 6); turn('clock-minute', m * 6); turn('clock-hour', h * 30);
    }
       setInterval(tick, 1000);

    const pin = $('clock-face').querySelector('.clock-pin');
    $('access-clock').addEventListener('click', event => {
      if (event.detail !== 0 || event.pointerType) {
        const matrix = pin.getScreenCTM();
        if (!matrix) return;

        const point = new DOMPoint(event.clientX, event.clientY)
          .matrixTransform(matrix.inverse());
        if (!pin.isPointInFill(point)) return;
      }

      const now = Date.now();
      unlock({startedAt:now, expiresAt:now + SIX_HOURS, lastSeenAt:now, closedAt:null});
      $('search').focus();
    });
  })();
  window.addEventListener('pagehide', () => {
    present = false;
    clearTimeout(expiryTimer);
    const session = readSession(), now = Date.now();
    if (unlocked && validSession(session, now)) writeSession({...session, lastSeenAt:now, closedAt:now});
  });
  window.addEventListener('pageshow', resume);
  document.addEventListener('visibilitychange', checkOpenSession);
  window.addEventListener('focus', checkOpenSession);
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    const session = readSession();
    if (!validSession(session)) lock('Your session has expired. Please verify again.');
    else if (!unlocked && reusableSession(session)) unlock(session);
    else if (unlocked) scheduleExpiry(session);
  });
  // While open, backgrounding the tab does not count as closing it. Heartbeats
  // also cover browser exits where pagehide was not delivered by the browser.
  setInterval(checkOpenSession, 15000);
  resume();
})();
