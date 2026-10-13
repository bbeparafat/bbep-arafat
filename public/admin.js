(() => {
 'use strict';
 const boot=JSON.parse(document.getElementById('bbep-admin-bootstrap')?.textContent||'{}');
 const user=boot.user||{},byId=id=>document.getElementById(id),mode=document.body.dataset.adminPage;
 let csrf=null,selected=null,nextToken=null,currentToken=null,previousTokens=[],currentQuery='',busy=false,detailsRequest=0,moderationTarget=null;
 const list=byId('account-list'),status=byId('admin-status'),dialog=byId('moderation-dialog');
 byId(mode==='accounts'?'accounts-view':'dashboard-view').hidden=false;
 document.querySelector(`[data-admin-nav="${mode}"]`)?.setAttribute('aria-current','page');
 byId('admin-name').textContent=user.username||'studio owner';byId('admin-email').textContent=user.email||'—';
 async function session(){const r=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('Session check unavailable. Refresh and try again.');const v=await r.json();if(!v.user?.admin){location.replace('/#admin-login');throw new Error('Admin session ended.');}csrf=v.csrf;return v;}
 async function api(path,data){if(!csrf)await session();const r=await fetch(path,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{},...(data?{body:JSON.stringify(data)}:{})});let v;try{v=await r.json();}catch{throw new Error('Server unavailable. Try again later.');}if(!r.ok){if(r.status===401||r.status===403)location.replace('/#admin-login');throw new Error(v.error||'Request failed.');}return v;}
 function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
 function date(value){if(!value)return 'Not available';const d=new Date(value);return isNaN(d)?'Not available':d.toLocaleString();}
 async function load(pageToken=null){
  status.textContent='';byId('accounts-summary').textContent='Loading accounts…';
  const url=new URL('/api/admin/accounts',location.origin);if(currentQuery)url.searchParams.set('query',currentQuery);if(pageToken)url.searchParams.set('pageToken',pageToken);
  try{const v=await api(url.pathname+url.search);currentToken=pageToken;nextToken=v.nextPageToken;list.replaceChildren();
   if(!v.accounts.length)list.append(element('div',currentQuery?'No matching account. Enter the exact username or email.':'No registered accounts yet.','empty-state'));
   v.accounts.forEach(account=>{const row=element('article',undefined,'account-row'),identity=element('div',undefined,'account-identity');identity.append(element('strong',account.username||'Username not set'),element('small',account.admin?'Administrator':'Customer account'));const email=element('div',account.email,'account-email'),chip=element('span',account.status,'status-chip'+(account.banned?' banned':account.status==='Active'?'':' pending')),details=element('button','Details','secondary');details.type='button';details.addEventListener('click',()=>showDetails(account.uid));row.append(identity,email,chip,details);list.append(row);});
   byId('accounts-summary').textContent=currentQuery?`${v.accounts.length} matching account${v.accounts.length===1?'':'s'}`:`${v.accounts.length} accounts on this page`;
   byId('page-label').textContent='Page '+(previousTokens.length+1);byId('previous-page').disabled=!previousTokens.length;byId('next-page').disabled=!nextToken||!!currentQuery;
  }catch(e){status.textContent=e.message;byId('accounts-summary').textContent='Accounts could not load.';list.replaceChildren(element('div','No account data is displayed. Refresh to try again.','empty-state'));}
 }
 async function showDetails(uid){
  const sequence=++detailsRequest;
  try{const a=await api('/api/admin/accounts/detail?uid='+encodeURIComponent(uid));if(sequence!==detailsRequest)return;selected=a;const dl=byId('details-fields');dl.replaceChildren();
   const fields=[['Username',a.username||'Not set'],['Email',a.email],['Account ID',a.uid],['Status',a.status],['Email verified',a.verified?'Yes':'No'],['Access level',a.admin?'Administrator':'Customer'],['Sign-up method',a.signupMethod],['Created',date(a.createdAt)],['Last sign-in',date(a.lastLogin)]];
   if(a.banned){fields.push(['Ban date',date(a.bannedAt)],['Ban reason',a.banReason||'Not specified']);}
   fields.forEach(([k,v])=>dl.append(element('dt',k),element('dd',v)));byId('account-details').hidden=false;
   byId('moderate-account').hidden=a.admin;byId('protected-admin-note').hidden=!a.admin;byId('moderate-account').textContent=a.banned?'Unban account':'Ban account';byId('moderate-account').className=a.banned?'secondary':'danger';
   byId('account-details').scrollIntoView({behavior:'auto',block:'start'});byId('details-title').focus({preventScroll:true});status.textContent='';
  }catch(e){status.textContent=e.message;}
 }
 byId('account-search').addEventListener('submit',e=>{e.preventDefault();detailsRequest++;selected=null;currentQuery=byId('account-query').value.trim();previousTokens=[];byId('account-details').hidden=true;load();});
 byId('clear-search').addEventListener('click',()=>{detailsRequest++;selected=null;byId('account-query').value='';currentQuery='';previousTokens=[];byId('account-details').hidden=true;load();});
 byId('refresh-accounts').addEventListener('click',()=>load(currentToken));
 byId('next-page').addEventListener('click',()=>{if(nextToken){previousTokens.push(currentToken);load(nextToken);}});
 byId('previous-page').addEventListener('click',()=>{if(previousTokens.length)load(previousTokens.pop());});
 byId('close-details').addEventListener('click',()=>{detailsRequest++;byId('account-details').hidden=true;selected=null;document.querySelector('.account-row button')?.focus();});
 byId('moderate-account').addEventListener('click',()=>{
  if(!selected||selected.admin||busy)return;moderationTarget={...selected};const unban=moderationTarget.banned;
  byId('moderation-title').textContent=unban?'Unban this account?':'Ban this account?';
  byId('moderation-description').textContent=unban?`${selected.username||selected.email} will be allowed to log in again after completing any required verification. Old sessions stay invalid.`:`${selected.username||selected.email} will lose access to protected pages and order submission. Public Home and About remain public.`;
  byId('confirm-moderation').textContent=unban?'Confirm unban':'Confirm ban';byId('confirm-moderation').className=unban?'primary':'danger';byId('ban-reason-label').hidden=unban;byId('ban-reason').hidden=unban;byId('ban-reason').value='';byId('moderation-status').textContent='';dialog.showModal();
 });
 byId('cancel-moderation').addEventListener('click',()=>{if(!busy)dialog.close();});dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 byId('moderation-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!moderationTarget||busy)return;busy=true;byId('account-query').disabled=true;byId('account-search').querySelectorAll('button').forEach(b=>b.disabled=true);const uid=moderationTarget.uid;byId('confirm-moderation').disabled=byId('cancel-moderation').disabled=true;
  try{await api('/api/admin/accounts/moderate',{uid,banned:!moderationTarget.banned,reason:byId('ban-reason').value});dialog.close();await load(currentToken);await showDetails(uid);}
  catch(error){byId('moderation-status').textContent=error.message;}finally{busy=false;byId('account-query').disabled=false;byId('account-search').querySelectorAll('button').forEach(b=>b.disabled=false);byId('confirm-moderation').disabled=byId('cancel-moderation').disabled=false;}
 });
 byId('admin-logout').addEventListener('click',async()=>{try{await api('/api/logout',{});location.replace('/#home');}catch(e){status.textContent=e.message;}});
 session().then(()=>{if(mode==='accounts')load();}).catch(e=>status.textContent=e.message);
 setInterval(()=>session().catch(e=>status.textContent=e.message),60000);
})();
