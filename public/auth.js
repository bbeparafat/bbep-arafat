(() => {
  'use strict';
  const boot = JSON.parse(document.getElementById('bbep-bootstrap')?.textContent || '{}');
  window.BBEP_USER = boot.user || null;
  const state = {user:boot.user || null, csrf:null, ready:false, orderReady:false, pending:null, google:null};
  let nextPage = sessionStorage.getItem('bbep_next_page') || 'order';
  const protectedViews = new Set(['contact','cart','order']);
  const names = ['home','about','login','signup','verify','gate','admin-login',...protectedViews];
  const views = Object.fromEntries(names.map(name => [name,document.getElementById(name)]));
  const labels = {contact:'Contact Info',cart:'Cart',order:'Order Your Own Music'};
  let current = null, expiry = 0, resendAt = 0, serverOffset = 0;
  const byId = id => document.getElementById(id);
  const now = () => Date.now() + serverOffset;
  function remember(name) { nextPage=name;sessionStorage.setItem('bbep_next_page',name); }
  function applyView(focus=true) {
    const requested = location.hash.slice(1) || 'home';
    let next = names.includes(requested) ? requested : 'home';
    if (protectedViews.has(next) && (!state.user || !views[next])) {
      remember(next);byId('gate-destination').textContent=labels[next]; next='gate';
    }
    Object.entries(views).forEach(([name,view]) => {if(view){view.hidden=name!==next;view.classList.remove('view-enter','contact-enter');}});
    const changed=next!==current;current=next;document.body.dataset.view=next;
    document.querySelectorAll('nav [data-view]').forEach(link => {if(link.dataset.view===requested)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    document.title=(next==='home'?'BBEP Arafat | Official Website':`${labels[next] || ({login:'Login',signup:'Sign up',verify:'Verify email',gate:'Login required','admin-login':'Admin Login',about:'About Me'}[next])} | BBEP Arafat`);
    if(changed){if(views[next]){void views[next].offsetWidth;views[next].classList.add('view-enter');if(next==='contact')views[next].classList.add('contact-enter');}window.scrollTo({top:0,behavior:'instant'});if(focus)byId(next+'-title')?.focus({preventScroll:true});}
    document.dispatchEvent(new CustomEvent('bbep:view-change',{detail:next}));
  }
  function go(name) {history.pushState(null,'','#'+name);applyView();}
  document.addEventListener('click',e => {
    const link=e.target.closest('a[data-view],button[data-view]');
    if(!link || e.button!==0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)return;
    e.preventDefault();go(link.dataset.view);
  });
  addEventListener('hashchange',()=>applyView());addEventListener('popstate',()=>applyView());
  async function request(url,data) {
    if(!state.csrf)await refresh();
    const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':state.csrf || ''},body:JSON.stringify(data || {})});
    let body;try{body=await response.json();}catch{throw new Error('The authentication server is unavailable. Please try again later.');}
    if(!response.ok){if(response.status===401 && state.user){state.user=null;window.BBEP_USER=null;location.replace('/#login');}throw new Error(body.error || 'Request failed. Please try again.');}
    return body;
  }
  window.BBEP_AUTH={request,get orderReady(){return state.orderReady;}};
  function updateUserUI() {
    byId('logout').hidden=!state.user;
    byId('account-link').hidden=!!state.user;
    const entry=byId('admin-entry');
    entry.textContent=state.user?.admin?'Admin Panel':'Admin Login';
    if(state.user?.admin){entry.href='/admin';entry.removeAttribute('data-view');}else{entry.href='#admin-login';entry.dataset.view='admin-login';}
  }
  async function refresh() {
    const response=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw new Error('Authentication service is not available.');
    const data=await response.json();
    state.csrf=data.csrf;state.ready=data.ready;state.orderReady=data.orderReady;state.user=data.user;state.pending=data.pending;state.google=data.google;
    serverOffset=data.serverTime-Date.now();window.BBEP_USER=data.user;updateUserUI();
    if(data.pending){expiry=data.pending.expiresAt;resendAt=data.pending.resendAt;byId('otp-email').textContent=data.pending.email;}
    const form=byId('signup-form');
    if(data.google){form.elements.email.value=data.google.email;form.elements.email.readOnly=true;byId('google-choice').hidden=true;byId('signup-intro').textContent='Google email received. Choose a username and website password, then verify your code.';}
    byId('google-signup').disabled=!data.googleReady;
    if(!data.ready){byId('signup-status').textContent='Account service is not connected yet. Setup is required before sign-up or OTP can work.';byId('login-status').textContent='Account service is not connected yet. No login has been simulated.';}
    if(!data.ready)byId('admin-login-status').textContent='Admin access is not connected yet. No default admin password is available.';
    document.dispatchEvent(new CustomEvent('bbep:auth-ready'));
    return data;
  }
  async function run(form,status,action) {
    const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);status.textContent='Please wait…';
    try{await action();}catch(error){status.textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);tick();}
  }
  document.querySelectorAll('.show-password').forEach(button=>button.addEventListener('click',()=>{
    const input=button.previousElementSibling;const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Hide':'Show';button.setAttribute('aria-label',(show?'Hide':'Show')+' password');
  }));
  const signup=byId('signup-form');
  signup.addEventListener('input',()=>signup.elements.confirmPassword.setCustomValidity(''));
  signup.addEventListener('submit',e=>{
    e.preventDefault();
    if(signup.elements.password.value!==signup.elements.confirmPassword.value){signup.elements.confirmPassword.setCustomValidity('Passwords do not match.');signup.reportValidity();return;}
    run(signup,byId('signup-status'),async()=>{
      const data=await request('/api/signup',{email:signup.elements.email.value,password:signup.elements.password.value,username:signup.elements.username.value});
      signup.elements.password.value='';signup.elements.confirmPassword.value='';
      expiry=data.expiresAt;resendAt=data.resendAt;serverOffset=data.serverTime-Date.now();byId('otp-email').textContent=data.email;byId('signup-status').textContent='';byId('verify-status').textContent='';go('verify');tick();
    });
  });
  byId('google-signup').addEventListener('click',()=>{location.href='/auth/google';});
  byId('restart-signup').addEventListener('click',async e=>{
    e.preventDefault();try{await request('/api/google/reset');state.google=null;signup.elements.email.readOnly=false;signup.elements.email.value='';byId('google-choice').hidden=false;byId('signup-intro').textContent='Your email. Your sound. One verified account.';go('signup');}catch(error){byId('verify-status').textContent=error.message;}
  });
  byId('login-form').addEventListener('submit',e=>{
    e.preventDefault();const form=e.currentTarget;
    run(form,byId('login-status'),async()=>{await request('/api/login',{email:form.elements.email.value,password:form.elements.password.value});form.elements.password.value='';location.replace('/#'+(protectedViews.has(nextPage)?nextPage:'order'));location.reload();});
  });
  byId('admin-login-form').addEventListener('submit',e=>{
    e.preventDefault();const form=e.currentTarget;
    run(form,byId('admin-login-status'),async()=>{await request('/api/admin/login',{email:form.elements.email.value,password:form.elements.password.value});form.elements.password.value='';location.assign('/admin');});
  });
  byId('verify-form').addEventListener('submit',e=>{
    e.preventDefault();const form=e.currentTarget;
    run(form,byId('verify-status'),async()=>{await request('/api/verify',{code:form.elements.code.value});form.elements.code.value='';location.replace('/#'+(protectedViews.has(nextPage)?nextPage:'order'));location.reload();});
  });
  byId('resend-otp').addEventListener('click',async()=>{
    const button=byId('resend-otp');button.disabled=true;
    try{const data=await request('/api/resend');expiry=data.expiresAt;resendAt=data.resendAt;serverOffset=data.serverTime-Date.now();byId('verify-form').elements.code.value='';byId('verify-status').textContent='A new code was sent. The previous code no longer works.';}catch(error){byId('verify-status').textContent=error.message;}finally{tick();}
  });
  byId('logout').addEventListener('click',async()=>{try{await request('/api/logout');location.replace('/#home');location.reload();}catch(error){go('login');byId('login-status').textContent=error.message;}});
  function tick(){
    const left=Math.max(0,Math.ceil((expiry-now())/1000));
    byId('otp-timer').textContent=expiry?(left?`Code expires in ${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`:'Code expired. Request a new code.'):'No active code. Complete sign-up first.';
    byId('verify-form').querySelector('[type=submit]').disabled=!left;
    const wait=Math.max(0,Math.ceil((resendAt-now())/1000));byId('resend-otp').disabled=!expiry || !!wait;byId('resend-otp').textContent=wait?`Resend code in ${wait}s`:'Resend code';
  }
  updateUserUI();applyView(false);tick();setInterval(tick,1000);
  refresh().then(data=>{
    if(new URLSearchParams(location.search).has('auth_error')){byId('signup-status').textContent='Google sign-up could not complete. Please try again.';history.replaceState(null,'','/#signup');applyView();}
    if(data.user && protectedViews.has(location.hash.slice(1)) && !views[location.hash.slice(1)])location.reload();
    else applyView(false);
  }).catch(()=>{byId('admin-login-status').textContent=byId('login-status').textContent=byId('signup-status').textContent='Open this website through the included server. Real authentication is not available in a static file preview.';});
  setInterval(async()=>{if(!state.user)return;try{const data=await refresh();if(!data.user){location.replace('/#login');location.reload();}}catch{/* A temporary connection failure does not grant access; APIs still check the session. */}},60000);
})();
