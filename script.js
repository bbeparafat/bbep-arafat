/* Same-tab screen navigation. The audio player stays mounted outside all views. */
(() => {
  const views = Object.fromEntries(['home', 'contact', 'order', 'about'].map(name => [name, document.getElementById(name)]));
  const headings = Object.fromEntries(Object.keys(views).map(name => [name, document.getElementById(name + '-title')]));
  let current = null;

  function applyView(focus = true) {
    const requested = location.hash.slice(1);
    const next = Object.hasOwn(views, requested) ? requested : 'home';
    const changed = next !== current;
    Object.entries(views).forEach(([name, view]) => {
      view.hidden = name !== next;
      if (changed || name !== next) view.classList.remove('view-enter', 'contact-enter');
    });
    current = next;
    document.body.dataset.view = next;
    document.querySelectorAll('nav [data-view]').forEach(link => {
      if (link.dataset.view === next) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const titles = { home: 'BBEP Arafat | Official Website', contact: 'Contact Info | BBEP Arafat', order: 'Order Your Own Music | BBEP Arafat', about: 'About Me | BBEP Arafat' };
    document.title = titles[next];
    if (changed) {
      void views[next].offsetWidth;
      views[next].classList.add('view-enter');
      if (next === 'contact') views[next].classList.add('contact-enter');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (focus && changed) headings[next].focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-view]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const hash = '#' + link.dataset.view;
      if (location.hash !== hash) history.pushState(null, '', hash);
      applyView();
    });
  });
  window.addEventListener('popstate', () => applyView());
  window.addEventListener('hashchange', () => applyView());
  applyView(false);
})();

(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches) return;

  function initCosmicOrb() {
    if (document.getElementById("cosmic-orb")) return;

    const orb = document.createElement("div");
    orb.id = "cosmic-orb";
    orb.innerHTML = `
      <span class="arc"></span>
      <span class="arc arc-two"></span>
      <span class="core"></span>
    `;
    document.body.appendChild(orb);
    document.documentElement.classList.add("orb-ready");

    let targetX = -100, targetY = -100;
    let currentX = targetX, currentY = targetY;
    let lastParticle = 0;

    document.addEventListener("mousemove", (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      orb.classList.add("visible");

      const now = performance.now();
      if (now - lastParticle < 35) return;
      lastParticle = now;

      const particle = document.createElement("span");
      particle.className = "cosmic-particle";
      particle.style.left = targetX + "px";
      particle.style.top = targetY + "px";
      particle.style.setProperty(
        "--drift-x",
        (Math.random() * 36 - 18) + "px"
      );
      particle.style.setProperty(
        "--drift-y",
        (Math.random() * 36 - 18) + "px"
      );

      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 750);
    });

    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget) orb.classList.remove("visible");
    });

    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(
        "a, button, input, textarea, select, [role='button']"
      )) {
        orb.classList.add("hovering");
      } else {
        orb.classList.remove("hovering");
      }
    });

    function animate() {
      currentX += (targetX - currentX) * 0.22;
      currentY += (targetY - currentY) * 0.22;
      orb.style.left = currentX + "px";
      orb.style.top = currentY + "px";
      requestAnimationFrame(animate);
    }

    animate();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded", initCosmicOrb, { once: true }
    );
  } else {
    initCosmicOrb();
  }
})();


const MUSIC_TRACKS = [{"title": "Golden Brown X Love Story (slowed) Remix", "src": "track-01.mp3"}, {"title": "Golden Brown (Piano)", "src": "track-02.mp3"}, {"title": "🟣 MONTAGEM GRAVE | BRAZILIAN PHONK", "src": "track-03.mp3"}, {"title": "MINHA AURA Phonk", "src": "track-04.mp3"}, {"title": "Montagem Taca O Grave (BBEP Arafat)", "src": "track-05.mp3"}, {"title": "Olha na Minha Cara (Normal)", "src": "track-06.mp3"}];

(() => {
  const audio = document.getElementById('music-audio');
  const panel = document.getElementById('music-panel');
  const toggle = document.getElementById('music-toggle');
  const close = document.getElementById('close-music');
  const status = document.getElementById('music-status');
  const playPause = document.getElementById('play-pause');
  const stop = document.getElementById('stop-music');
  const volume = document.getElementById('volume');
  const seek = document.getElementById('seek');
  const elapsed = document.getElementById('elapsed');
  const duration = document.getElementById('duration');
  const currentTrack = document.getElementById('current-track');
  const badge = document.getElementById('playback-badge');
  const rows = [...document.querySelectorAll('.track')];
  let selected = -1, mode = 'off', request = 0;
  audio.volume = Number(volume.value) / 100;
  audio.loop = true;

  function showPanel() {
    panel.hidden = false;
    panel.scrollTop = 0;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close music panel; music keeps playing');
  }
  function hidePanel() {
    // Only the panel is hidden. Do not pause, unload or destroy the audio.
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', audio.paused ? 'Open music player' : 'Open music player; music is playing');
    toggle.focus();
  }
  toggle.addEventListener('click', () => panel.hidden ? showPanel() : hidePanel());
  close.addEventListener('click', hidePanel);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) hidePanel();
  });

  function timeLabel(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
  }
  function updateTime() {
    const valid = Number.isFinite(audio.duration) && audio.duration > 0;
    seek.disabled = !valid;
    elapsed.textContent = timeLabel(audio.currentTime);
    duration.textContent = timeLabel(audio.duration);
    if (valid) seek.value = String(Math.round(audio.currentTime / audio.duration * 1000));
    else seek.value = '0';
  }
  function render(message) {
    const playing = mode === 'playing' && !audio.paused;
    playPause.disabled = selected < 0;
    stop.disabled = mode === 'off' && audio.paused;
    playPause.textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    toggle.classList.toggle('is-playing', playing);
    panel.classList.toggle('is-audio-playing', playing);
    document.body.classList.toggle('music-on', playing);
    badge.textContent = { off:'SOUND OFF', loading:'LOADING', playing:'PLAYING · REPEAT ONE', paused:'PAUSED', error:'UNAVAILABLE' }[mode];
    if (selected >= 0) currentTrack.textContent = MUSIC_TRACKS[selected].title;
    rows.forEach((row, i) => {
      row.setAttribute('aria-pressed', String(i === selected));
      row.querySelector('.track-mark').textContent = i === selected && playing ? '♫' : '▷';
    });
    if (message) status.textContent = message;
    else if (mode === 'off') status.textContent = 'Music is off. Choose a track or press Play.';
    else if (mode === 'loading') status.textContent = 'Loading your soundtrack…';
    else if (mode === 'playing') status.textContent = 'Music keeps playing when you close this panel.';
    else if (mode === 'paused') status.textContent = 'Paused. Press Play to continue.';
    if (panel.hidden) toggle.setAttribute('aria-label', playing ? 'Open music player; music is playing' : 'Open music player');
  }
  async function startPlayback() {
    const token = ++request;
    mode = 'loading'; render();
    try {
      await audio.play();
      if (token !== request) return;
      mode = 'playing'; render();
    } catch (error) {
      if (token !== request || error.name === 'AbortError') return;
      mode = 'error';
      render(error.name === 'NotAllowedError'
        ? 'Your browser blocked playback. Press Play to start.'
        : 'This audio could not load. Check that the MP3 files were uploaded next to index.html.');
    }
  }
  rows.forEach((row, i) => row.addEventListener('click', () => {
    if (selected !== i || !audio.getAttribute('src')) {
      ++request; mode = 'loading'; audio.pause();
      selected = i;
      audio.src = MUSIC_TRACKS[i].src;
      audio.load(); updateTime();
    }
    startPlayback();
    panel.scrollTop = 0;
  }));
  playPause.addEventListener('click', () => {
    if (selected < 0) return;
    if (!audio.paused && mode !== 'loading') {
      ++request; mode = 'paused'; audio.pause(); render();
    } else startPlayback();
  });
  stop.addEventListener('click', () => {
    ++request; mode = 'off'; audio.pause();
    try { audio.currentTime = 0; } catch (_) { /* Metadata may not be ready. */ }
    render('Music is off. Press Play or choose a track to start again.');
    updateTime();
  });
  audio.addEventListener('playing', () => {
    if (mode === 'off') { audio.pause(); return; }
    mode = 'playing'; render();
  });
  audio.addEventListener('pause', () => {
    if (mode === 'playing') { mode = 'paused'; render(); }
  });
  audio.addEventListener('error', () => {
    if (mode === 'off') return;
    mode = 'error'; render('This audio could not load. Check that all six MP3 files were uploaded next to index.html.');
  });
  audio.addEventListener('timeupdate', updateTime);
  audio.addEventListener('loadedmetadata', updateTime);
  audio.addEventListener('durationchange', updateTime);
  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value) / 100;
    document.getElementById('volume-value').textContent = volume.value + '%';
  });
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Number(seek.value) / 1000 * audio.duration;
      updateTime();
    }
  });
  render();
})();
