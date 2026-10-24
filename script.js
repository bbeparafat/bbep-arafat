/* Same-tab screen navigation. The audio player stays mounted outside all views. */
(() => {
  const views = Object.fromEntries(['home', 'contact', 'music', 'cart', 'order', 'about'].map(name => [name, document.getElementById(name)]));
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
    const titles = { music: 'My Music | BBEP Arafat', home: 'BBEP Arafat | Official Website', contact: 'Contact Info | BBEP Arafat', cart: 'Cart | BBEP Arafat', order: 'Order Your Own Music | BBEP Arafat', about: 'About Me | BBEP Arafat' };
    document.title = titles[next];
    if (changed) {
      void views[next].offsetWidth;
      views[next].classList.add('view-enter');
      if (next === 'contact') views[next].classList.add('contact-enter');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (focus && changed) headings[next].focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('bbep:view-change', { detail: next }));
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


const MUSIC_TRACKS = [{"title": "🟣 MONTAGEM GRAVE | BRAZILIAN PHONK", "src": "track-03.mp3"}, {"title": "MINHA AURA Phonk", "src": "track-04.mp3"}, {"title": "Montagem Taca O Grave (BBEP Arafat)", "src": "track-05.mp3"}, {"title": "Olha na Minha Cara (Normal)", "src": "track-06.mp3"}];

(() => {
  const audio = document.getElementById('music-audio');
  const panel = document.getElementById('music-panel');
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
    else if (mode === 'playing') status.textContent = 'Playing. Explore the site without interrupting your music.';
    else if (mode === 'paused') status.textContent = 'Paused. Press Play to continue.';
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

/* EMAIL SETUP: public identifiers only. Never put a Gmail password, SMTP secret
   or private API key here. See the setup guide before enabling confirmation. */
const ORDER_EMAIL_CONFIG = {
  publicKey: '',
  serviceId: '',
  ownerTemplateId: '',
  captchaSiteKey: '',
  customerCopyLinked: false,
  // The owner template's To address must be fixed to bbep.arafat@gmail.com.
  // Link a customer-copy template in its Auto-Reply settings; enable reCAPTCHA.
  ...(window.BBEP_ORDER_EMAIL || {})
};

(() => {
  const form = document.getElementById('music-order-form');
  const genreInputs = [...form.querySelectorAll('[name="genre"]')];
  const modeInputs = [...form.querySelectorAll('[name="lyricsMode"]')];
  const typeField = document.getElementById('song-type-field');
  const typeInput = form.elements.songType;
  const lyricsFields = document.getElementById('lyrics-fields');
  const ownLyricsField = document.getElementById('own-lyrics-field');
  const lyricsInput = form.elements.lyrics;
  const formMessage = document.getElementById('form-message');
  const cartItems = document.getElementById('cart-items');
  const checkout = document.getElementById('cart-checkout');
  const confirmButton = document.getElementById('confirm-order');
  const checkoutMessage = document.getElementById('checkout-message');
  const emailNotice = document.getElementById('email-setup-notice');
  const receipt = document.getElementById('order-receipt');
  const storageKey = 'bbep_music_cart_v1';
  let cart = [], editing = null, busy = false, captchaToken = '', captchaWidget = null;
  let captchaPromise, emailPromise;
  const trim = value => String(value ?? '').trim();
  const id = () => window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  const genre = () => form.elements.genre.value;
  const lyricsMode = () => form.elements.lyricsMode.value || 'own';
  const configured = () => !!(ORDER_EMAIL_CONFIG.publicKey && ORDER_EMAIL_CONFIG.serviceId && ORDER_EMAIL_CONFIG.ownerTemplateId && ORDER_EMAIL_CONFIG.captchaSiteKey && ORDER_EMAIL_CONFIG.customerCopyLinked === true);
  const telegramValid = value => /^@?[A-Za-z0-9_]{5,32}$/.test(trim(value));
  const emailValid = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trim(value));
  function valid(item) {
    return item && typeof item.id === 'string' && trim(item.customerName) && emailValid(item.customerEmail) && telegramValid(item.telegram) && trim(item.musicStyle)
      && ['Phonk','Funk','Only Sound','Other'].includes(item.genre)
      && (item.genre !== 'Other' || ['Only Rap','Normal Song','Song + Rap'].includes(item.songType))
      && (item.genre === 'Only Sound' || ['own','creator'].includes(item.lyricsMode))
      && (item.genre !== 'Phonk' || item.lyricsMode === 'creator' || trim(item.lyrics));
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) cart = saved.filter(valid);
  } catch (_) { cart = []; }
  function persist() {
    try {
      if (cart.length) localStorage.setItem(storageKey, JSON.stringify(cart));
      else localStorage.removeItem(storageKey);
    } catch (_) {
      formMessage.textContent = 'Draft is available in this tab, but browser storage is unavailable. It may be lost on refresh.';
    }
  }
  function syncFields() {
    const selectedGenre = genre();
    const usesLyrics = !!selectedGenre && selectedGenre !== 'Only Sound';
    const own = lyricsMode() === 'own';
    typeField.hidden = selectedGenre !== 'Other';
    typeInput.disabled = selectedGenre !== 'Other';
    typeInput.required = selectedGenre === 'Other';
    lyricsFields.hidden = !usesLyrics;
    modeInputs.forEach(input => input.disabled = !usesLyrics);
    ownLyricsField.hidden = !usesLyrics || !own;
    lyricsInput.disabled = !usesLyrics || !own;
    lyricsInput.required = selectedGenre === 'Phonk' && own;
    document.getElementById('lyrics-required').hidden = !lyricsInput.required;
    document.getElementById('lyrics-hint').textContent = lyricsInput.required
      ? 'Phonk requires lyrics. Paste them here or choose Lyrics by BBEP ARAFAT.'
      : 'Lyrics are optional for this music type.';
    document.getElementById('creator-lyrics-note').hidden = !usesLyrics || own;
    lyricsInput.setCustomValidity('');
  }
  genreInputs.concat(modeInputs).forEach(input => input.addEventListener('change', syncFields));
  form.addEventListener('input', event => event.target.setCustomValidity?.(''));
  function collect() {
    const g = genre();
    const handle = trim(form.elements.telegram.value);
    return {
      id: editing || id(), customerName: trim(form.elements.customerName.value),
      customerEmail: trim(form.elements.customerEmail.value).toLowerCase(), telegram: '@' + handle.replace(/^@/, ''),
      musicStyle: trim(form.elements.musicStyle.value), duration: trim(form.elements.duration.value),
      deadline: trim(form.elements.deadline.value), reference: trim(form.elements.reference.value), brief: trim(form.elements.brief.value),
      genre: g, songType: g === 'Other' ? typeInput.value : '',
      lyricsMode: g === 'Only Sound' ? 'n/a' : lyricsMode(),
      lyrics: g !== 'Only Sound' && lyricsMode() === 'own' ? trim(lyricsInput.value) : ''
    };
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (busy) return;
    for (const field of ['customerName','customerEmail','telegram','musicStyle']) {
      const input = form.elements[field];
      input.setCustomValidity(trim(input.value) ? '' : 'Please complete this required field.');
    }
    if (lyricsInput.required) lyricsInput.setCustomValidity(trim(lyricsInput.value) ? '' : 'Add lyrics or choose Lyrics by BBEP ARAFAT.');
    if (!form.reportValidity()) return;
    const item = collect();
    if (!valid(item)) { formMessage.textContent = 'Please check your required details.'; return; }
    if (cart.some(existing => existing.id !== editing && (trim(existing.customerEmail).toLowerCase() !== item.customerEmail || trim(existing.telegram).toLowerCase() !== item.telegram.toLowerCase()))) {
      formMessage.textContent = 'Use the same email and Telegram username for requests in one cart, or submit/remove the existing drafts first.';
      return;
    }
    const index = cart.findIndex(existing => existing.id === editing);
    if (index >= 0) cart[index] = item; else cart.push(item);
    formMessage.textContent = index >= 0 ? 'Cart draft updated. Nothing has been emailed yet.' : 'Added to Cart. Nothing has been emailed yet.';
    editing = null; document.getElementById('add-to-cart').textContent = 'Add to Cart →';
    document.getElementById('cancel-edit').hidden = true;
    receipt.hidden = true;
    persist(); renderCart();
  });
  document.getElementById('cancel-edit').addEventListener('click', () => {
    editing = null; form.reset(); syncFields();
    document.getElementById('add-to-cart').textContent = 'Add to Cart →';
    document.getElementById('cancel-edit').hidden = true;
    formMessage.textContent = 'Editing cancelled; the saved draft was not changed.';
  });
  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function detailPairs(item) {
    const pairs = [['Name',item.customerName],['Email',item.customerEmail],['Telegram',item.telegram],['Music type',item.genre],['Music style',item.musicStyle]];
    if (item.songType) pairs.push(['Song format',item.songType]);
    pairs.push(['Duration',item.duration || 'Not specified'],['Deadline',item.deadline || 'To discuss'],['Reference',item.reference || 'None'],['Details',item.brief || 'None']);
    if (item.genre !== 'Only Sound') {
      pairs.push(['Lyrics',item.lyricsMode === 'creator' ? 'Lyrics by BBEP ARAFAT' : item.lyrics || 'No lyrics supplied']);
    }
    return pairs;
  }
  function editItem(item) {
    if (busy) return;
    editing = item.id;
    for (const field of ['customerName','customerEmail','telegram','musicStyle','duration','deadline','reference','brief','songType','lyrics']) form.elements[field].value = item[field] || '';
    form.elements.genre.value = item.genre;
    form.elements.lyricsMode.value = item.lyricsMode === 'creator' ? 'creator' : 'own';
    syncFields();
    document.getElementById('add-to-cart').textContent = 'Update Cart →';
    document.getElementById('cancel-edit').hidden = false;
    formMessage.textContent = 'Editing saved draft. Update Cart when finished.';
    location.hash = 'order';
  }
  function renderCart() {
    cartItems.replaceChildren();
    document.getElementById('cart-count').textContent = String(cart.length);
    checkout.hidden = cart.length === 0;
    if (!cart.length && receipt.hidden) {
      const empty = node('div',undefined,'request-card cart-empty');
      empty.append(node('h3','Your cart is empty'),node('p','Add your music details to create an order draft.'));
      const link = node('a','Create a music request →','text-link'); link.href = '#order'; empty.append(link); cartItems.append(empty);
    }
    cart.forEach((item,i) => {
      const card = node('article',undefined,'request-card cart-item');
      const header = node('div',undefined,'cart-item-header');
      const title = node('div');
      title.append(node('h3',`${String(i+1).padStart(2,'0')} / ${item.genre}${item.songType ? ' · ' + item.songType : ''}`),node('p',`Draft ${item.id.slice(0,8).toUpperCase()} — not submitted`));
      const buttons = node('div',undefined,'cart-buttons');
      const edit = node('button','Edit'); edit.type='button';edit.disabled=busy;edit.addEventListener('click',()=>editItem(item));
      const remove = node('button','Remove');remove.type='button';remove.disabled=busy;remove.addEventListener('click',()=>{cart=cart.filter(existing=>existing.id!==item.id);persist();renderCart();});
      buttons.append(edit,remove);header.append(title,buttons);card.append(header);
      const details = node('details');details.append(node('summary','Review all details'));
      const list = node('dl'); detailPairs(item).forEach(([label,value])=>list.append(node('dt',label),node('dd',value)));details.append(list);card.append(details);cartItems.append(card);
    });
    renderControls();
    if (document.body.dataset.view === 'cart') ensureCaptcha();
  }
  function renderControls() {
    emailNotice.hidden = configured();
    confirmButton.disabled = busy || !cart.length || !configured() || !captchaToken;
    confirmButton.textContent = busy ? 'Submitting…' : 'Confirm Order';
    document.getElementById('add-to-cart').disabled = busy;
  }
  async function ensureCaptcha() {
    if (!configured() || !cart.length || captchaWidget !== null) return;
    if (captchaPromise) return captchaPromise;
    const render = () => {
      if (captchaWidget !== null) return;
      captchaWidget = window.grecaptcha.render('order-captcha',{
        sitekey: ORDER_EMAIL_CONFIG.captchaSiteKey, size:'compact', theme:'dark',
        callback: token=>{captchaToken=token;renderControls();},
        'expired-callback':()=>{captchaToken='';renderControls();},
        'error-callback':()=>{captchaToken='';checkoutMessage.textContent='Verification could not load. Check your connection and try again.';renderControls();}
      });
      checkoutMessage.textContent = 'Complete verification, then confirm your order request.';
    };
    if (window.grecaptcha?.render) { render(); return; }
    captchaPromise = new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Verification timed out. Refresh and try again.')),20000);
      window.__bbepCaptchaLoaded=()=>{clearTimeout(timer);try{render();resolve();}catch(error){reject(error);}};
      const script=document.createElement('script');script.src='https://www.google.com/recaptcha/api.js?onload=__bbepCaptchaLoaded&render=explicit';script.async=true;script.defer=true;
      script.onerror=()=>{clearTimeout(timer);reject(new Error('Verification could not load.'));};document.head.append(script);
    }).catch(error=>{checkoutMessage.textContent=error.message;captchaPromise=null;});
    return captchaPromise;
  }
  function loadEmailSDK() {
    if (window.emailjs?.send) return Promise.resolve();
    if (emailPromise) return emailPromise;
    emailPromise = new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Mail service timed out. Your drafts are still saved.')),20000);
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@emailjs/browser@5/dist/email.min.js';
      script.onload=()=>{clearTimeout(timer);window.emailjs?.send ? resolve() : reject(new Error('Mail service did not load.'));};
      script.onerror=()=>{clearTimeout(timer);reject(new Error('Mail service could not load. Your drafts are still saved.'));};document.head.append(script);
    }).catch(error=>{emailPromise=null;throw error;});
    return emailPromise;
  }
  confirmButton.addEventListener('click',async()=>{
    if (busy || !configured() || !cart.length || !captchaToken) return;
    if (!cart.every(valid)) { checkoutMessage.textContent='Some drafts need correction. Edit them before submitting.';return; }
    const first=cart[0];
    if (cart.some(item=>trim(item.customerEmail).toLowerCase()!==trim(first.customerEmail).toLowerCase() || trim(item.telegram).toLowerCase()!==trim(first.telegram).toLowerCase())) {
      checkoutMessage.textContent='Use one email and Telegram username for all requests in this cart.';return;
    }
    busy=true;renderCart();
    checkoutMessage.textContent='Submitting your order request…';
    const ref='BBEP-'+id().slice(0,8).toUpperCase();
    const details=cart.map((item,i)=>`REQUEST ${i+1} / ${item.id.slice(0,8).toUpperCase()}\n`+detailPairs(item).map(([label,value])=>`${label}: ${value}`).join('\n')).join('\n\n--------------------\n\n');
    const params={order_ref:ref,customer_name:first.customerName,customer_email:first.customerEmail,telegram:first.telegram,order_details:details,'g-recaptcha-response':captchaToken};
    try {
      await loadEmailSDK();
      await window.emailjs.send(ORDER_EMAIL_CONFIG.serviceId,ORDER_EMAIL_CONFIG.ownerTemplateId,params,{publicKey:ORDER_EMAIL_CONFIG.publicKey});
      cart=[];persist();receipt.hidden=false;
      document.getElementById('receipt-message').textContent=`The mail service accepted request ${ref}. The configured templates send the full details to ${first.customerEmail} and bbep.arafat@gmail.com. Inbox delivery still depends on the email provider.`;
      editing=null;form.reset();syncFields();document.getElementById('add-to-cart').textContent='Add to Cart →';document.getElementById('cancel-edit').hidden=true;
      formMessage.textContent='Previous request submitted. You can create a new draft.';
      checkoutMessage.textContent='';
    } catch(error) {
      checkoutMessage.textContent='Could not confirm the request. Your drafts are retained. Check the mail-service setup/connection before retrying.';
    } finally {
      busy=false;captchaToken='';
      if(captchaWidget!==null)window.grecaptcha?.reset?.(captchaWidget);
      renderCart();
    }
  });
  document.addEventListener('bbep:view-change',event=>{if(event.detail==='cart'){renderCart();ensureCaptcha();}});
  syncFields();renderCart();
})();
