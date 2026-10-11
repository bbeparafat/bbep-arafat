
(() => {
  const section = document.querySelector("#about");
  const card = section?.querySelector(".about-card");

  if (!section || !card) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let previousY = window.scrollY;
  let direction = "down";

  window.addEventListener("scroll", () => {
    const currentY = window.scrollY;
    if (currentY !== previousY) {
      direction = currentY > previousY ? "down" : "up";
    }
    previousY = currentY;
  }, { passive: true });

  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      card.classList.remove("is-away");
      return;
    }

    const goingDown = direction === "down";
    card.style.setProperty("--fly-x", goingDown ? "120px" : "-120px");
    card.style.setProperty("--fly-y", goingDown ? "-100px" : "100px");
    card.style.setProperty("--fly-turn", goingDown ? "10deg" : "-10deg");
    card.classList.add("is-away");
  }, { threshold: 0.18 });

  observer.observe(section);
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


const MUSIC_TRACKS = [{"id": "Fvt9hEAP6oQ", "title": "Golden Brown X Love Story (slowed) Remix"}, {"id": "lB_xwdRpbks", "title": "Golden Brown (Piano)"}, {"id": "ce0hPik4VDs", "title": "🟣 MONTAGEM GRAVE | BRAZILIAN PHONK"}, {"id": "U2uTS1LEEns", "title": "MINHA AURA Phonk"}, {"id": "FcvEnXHLUo4", "title": "Montagem Taca O Grave (BBEP Arafat)"}, {"id": "AmObdJ8cWkk", "title": "Olha na Minha Cara (Normal)"}];

(() => {
  const panel = document.getElementById('music-panel');
  const toggle = document.getElementById('music-toggle');
  const close = document.getElementById('close-music');
  const status = document.getElementById('music-status');
  const playPause = document.getElementById('play-pause');
  const stop = document.getElementById('stop-music');
  const volume = document.getElementById('volume');
  const link = document.getElementById('youtube-link');
  const rows = [...document.querySelectorAll('.track')];
  let player, selected = -1, active = false, playing = false, pending = false, apiPromise;

  function showPanel() {
    panel.hidden = false;
    panel.classList.remove('compact');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Minimize music player');
  }
  function minimize() {
    if (active || pending) {
      // Never hide a playing YouTube video. Keep the official player visible.
      panel.classList.add('compact');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Expand music player');
    } else {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open music player');
    }
    toggle.focus();
  }
  toggle.addEventListener('click', () => {
    if (panel.hidden || panel.classList.contains('compact')) showPanel();
    else minimize();
  });
  close.addEventListener('click', minimize);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) minimize();
  });

  function loadAPI() {
    if (window.YT?.Player) return Promise.resolve();
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('YouTube did not load. Check your connection, then try again.')), 20000);
      window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(); };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => { clearTimeout(timeout); reject(new Error('Unable to load YouTube. Try the YouTube link.')); };
      document.head.appendChild(script);
    }).catch(e => { apiPromise = null; throw e; });
    return apiPromise;
  }
  function updateButtons() {
    playPause.disabled = !player || pending;
    stop.disabled = !player && !pending;
    playPause.textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    toggle.classList.toggle('is-playing', playing);
    rows.forEach((row, i) => {
      row.setAttribute('aria-pressed', String(i === selected));
      row.querySelector('.track-mark').textContent = i === selected && playing ? '♫' : '▷';
    });
  }
  async function selectTrack(index) {
    selected = index;
    showPanel();
    link.href = 'https://www.youtube.com/watch?v=' + MUSIC_TRACKS[index].id;
    pending = true;
    status.textContent = 'Loading: ' + MUSIC_TRACKS[index].title;
    updateButtons();
    try {
      await loadAPI();
      if (!pending) return;
      if (player?.loadVideoById) {
        active = true; pending = false;
        player.loadVideoById(MUSIC_TRACKS[selected].id);
        updateButtons();
      } else if (!player) {
        player = new YT.Player('youtube-player', {
          width: '100%', height: '200',
          videoId: MUSIC_TRACKS[selected].id,
          playerVars: { playsinline: 1, controls: 1, rel: 0, origin: location.protocol.startsWith('http') ? location.origin : undefined },
          events: {
            onReady(e) {
              e.target.getIframe().setAttribute('title', 'YouTube music video player');
              e.target.setVolume(Number(volume.value));
              if (pending) {
                active = true; pending = false;
                e.target.loadVideoById(MUSIC_TRACKS[selected].id);
                status.textContent = 'If playback does not start, press Play.';
              }
              updateButtons();
            },
            onStateChange(e) {
              const state = e.data;
              playing = state === YT.PlayerState.PLAYING;
              if (state === YT.PlayerState.PLAYING) {
                active = true;
                status.textContent = 'Playing: ' + MUSIC_TRACKS[selected].title;
              } else if (state === YT.PlayerState.PAUSED) {
                status.textContent = 'Paused: ' + MUSIC_TRACKS[selected].title;
              } else if (state === YT.PlayerState.ENDED && active) {
                player.seekTo(0, true);
                player.playVideo();
              } else if (state === YT.PlayerState.CUED || state === YT.PlayerState.UNSTARTED) {
                if (active) status.textContent = 'Ready: ' + MUSIC_TRACKS[selected].title + ' — press Play.';
              }
              updateButtons();
            },
            onError(e) {
              active = false; playing = false; pending = false;
              status.textContent = [101,150].includes(e.data)
                ? 'This video does not allow website playback. Use YouTube ↗ or choose another song.'
                : 'This video could not play here (code ' + e.data + '). Try YouTube ↗ or another song.';
              panel.classList.remove('compact');
              updateButtons();
            }
          }
        });
      }
    } catch (e) {
      pending = false; active = false; playing = false;
      status.textContent = e.message;
      updateButtons();
    }
  }
  rows.forEach((row, i) => row.addEventListener('click', () => selectTrack(i)));
  playPause.addEventListener('click', () => {
    if (!player?.playVideo) return;
    if (playing) player.pauseVideo();
    else { active = true; player.playVideo(); }
  });
  stop.addEventListener('click', () => {
    pending = false; active = false; playing = false;
    player?.stopVideo?.();
    status.textContent = 'Music is off. Press Play or choose a song to start again.';
    updateButtons();
  });
  volume.addEventListener('input', () => {
    document.getElementById('volume-value').textContent = volume.value + '%';
    player?.setVolume?.(Number(volume.value));
  });
})();
