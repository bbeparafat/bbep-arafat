import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {token,equal,error} from './security.js';
const publicDir=fileURLToPath(new URL('../public/',import.meta.url));
const templatePath=new URL('../public/index.html',import.meta.url);
const protectedPath=new URL('./protected.html',import.meta.url);
const adminPath=new URL('./admin.html',import.meta.url);
export function createApp(services,env=process.env){
 const app=express(),production=env.NODE_ENV==='production',origin=env.APP_ORIGIN||'http://localhost:3000';
 if(production&&(!origin.startsWith('https://')||!env.COOKIE_SECRET || env.COOKIE_SECRET.length<32))throw new Error('Production requires HTTPS APP_ORIGIN and COOKIE_SECRET of at least 32 characters.');
 if(env.TRUST_PROXY==='1')app.set('trust proxy',1);
 app.disable('x-powered-by');
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:",'https:'],mediaSrc:["'self'"],connectSrc:["'self'"],fontSrc:["'self'","data:"],upgradeInsecureRequests:production?[]:null}}}));
 app.use(cookieParser(env.COOKIE_SECRET||token()));app.use(express.json({limit:'300kb'}));
 const base={httpOnly:true,secure:production,sameSite:'lax',path:'/'};
 const set=(res,name,value,maxAge)=>res.cookie(name,value,{...base,signed:true,maxAge});
 const clear=(res,name)=>res.clearCookie(name,base);
 app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.get('/api/me',async(req,res)=>{
  if(services.ready)await services.limit('me:'+req.ip,120,60000);
  let csrf=req.signedCookies.bbep_csrf;if(!csrf){csrf=token();set(res,'bbep_csrf',csrf,86400000);}
  res.json({csrf,ready:services.ready,googleReady:services.googleReady,orderReady:services.orderReady,serverTime:Date.now(),user:await services.userFromSession(req.signedCookies.bbep_session),pending:await services.pending(req.signedCookies.bbep_pending),google:await services.googleProfile(req.signedCookies.bbep_google)});
 });
 app.use('/api',async(req,res,next)=>{
  if(req.method==='POST'){
   if(req.get('origin')!==origin||!equal(req.signedCookies.bbep_csrf,req.get('x-csrf-token')))throw error('Security check failed. Refresh the page and try again.',403);
   await services.limit('ip:'+req.ip,30,60000);
  }next();
 });
 const result=v=>({...v,serverTime:Date.now()});
 app.post('/api/signup',async(req,res)=>{try{const v=await services.signup(req.body,req.signedCookies.bbep_pending,req.signedCookies.bbep_google);set(res,'bbep_pending',v.id,86400000);res.json(result({email:v.email,expiresAt:v.expiresAt,resendAt:v.resendAt}));}catch(e){if(e.pendingId)set(res,'bbep_pending',e.pendingId,86400000);throw e;}});
 app.post('/api/resend',async(req,res)=>res.json(result(await services.resend(req.signedCookies.bbep_pending))));
 app.post('/api/verify',async(req,res)=>{const session=await services.verify(req.signedCookies.bbep_pending,req.body.code);set(res,'bbep_session',session,5*86400000);clear(res,'bbep_pending');clear(res,'bbep_google');res.json({ok:true});});
 app.post('/api/login',async(req,res)=>{if(String(req.body.password||'').length>128)throw error('Invalid login details.');const session=await services.login(req.body);set(res,'bbep_session',session,5*86400000);clear(res,'bbep_pending');clear(res,'bbep_google');res.json({ok:true});});
 app.post('/api/logout',async(req,res)=>{await services.logout(req.signedCookies.bbep_session);clear(res,'bbep_session');clear(res,'bbep_pending');clear(res,'bbep_google');clear(res,'bbep_csrf');res.json({ok:true});});
 app.post('/api/google/reset',async(req,res)=>{clear(res,'bbep_google');res.json({ok:true});});
 app.post('/api/orders',async(req,res)=>{const user=await services.userFromSession(req.signedCookies.bbep_session);if(!user)throw error('Log in with a verified account before ordering.',401);res.json(await services.orders(user,req.body));});
 app.post('/api/admin/login',async(req,res)=>{
  if(typeof req.body.password!=='string'||req.body.password.length>128)throw error('Invalid admin login.');
  const session=await services.login(req.body),user=await services.userFromSession(session);
  await services.requireAdmin(user);set(res,'bbep_session',session,5*86400000);clear(res,'bbep_pending');clear(res,'bbep_google');res.json({ok:true});
 });
 app.use('/api/admin',async(req,res,next)=>{
  const user=await services.userFromSession(req.signedCookies.bbep_session);if(!user)throw error('Admin login required.',401);
  await services.requireAdmin(user);await services.limit('admin:'+user.uid,60,60000);req.adminUser=user;next();
 });
 app.get('/api/admin/accounts',async(req,res)=>res.json(await services.accounts(req.adminUser,{query:req.query.query,pageToken:req.query.pageToken})));
 app.get('/api/admin/accounts/detail',async(req,res)=>res.json(await services.accountDetails(req.adminUser,req.query.uid)));
 app.post('/api/admin/accounts/moderate',async(req,res)=>res.json(await services.setBan(req.adminUser,req.body)));
 app.get(['/admin','/admin/accounts'],async(req,res)=>{
  const user=await services.userFromSession(req.signedCookies.bbep_session);
  if(!user||!services.isAdmin(user))return res.redirect('/#admin-login');
  const page=req.path==='/admin/accounts'?'accounts':'dashboard';
  const bootstrap=JSON.stringify({user}).replace(/</g,'\\u003c');
  let html=(await readFile(adminPath,'utf8')).replace('<!--ADMIN_PAGE-->',page).replace('</head>',`<script type="application/json" id="bbep-admin-bootstrap">${bootstrap}</script></head>`);
  res.set('Cache-Control','no-store').type('html').send(html);
 });
 app.get('/auth/google',async(req,res)=>{await services.limit('google:'+req.ip,10,60000);const v=await services.googleStart();set(res,'bbep_oauth',v.state,600000);res.redirect(v.url);});
 app.get('/auth/google/callback',async(req,res)=>{
  const state=req.query.state,code=req.query.code;clear(res,'bbep_oauth');
  if(typeof state!=='string'||typeof code!=='string'||!equal(state,req.signedCookies.bbep_oauth))return res.redirect('/?auth_error=1#signup');
  try{const id=await services.googleCallback(state,code);set(res,'bbep_google',id,1800000);res.redirect('/#signup');}catch{res.redirect('/?auth_error=1#signup');}
 });
 // The protected HTML is never exposed as a public static asset.
 app.get(['/','/index.html'],async(req,res)=>{
  const user=await services.userFromSession(req.signedCookies.bbep_session);
  let html=await readFile(templatePath,'utf8');html=html.replace('<!--PROTECTED_VIEWS-->',user?await readFile(protectedPath,'utf8'):'');
  const bootstrap=JSON.stringify({user}).replace(/</g,'\\u003c');html=html.replace('</head>',`<script type="application/json" id="bbep-bootstrap">${bootstrap}</script></head>`);
  res.set('Cache-Control','no-store').type('html').send(html);
 });
 app.get(['/home','/about','/login','/signup','/verify','/contact','/cart','/order'],async(req,res)=>{
  const name=req.path.slice(1);res.redirect('/#'+name);
 });
 for(const filename of ['style.css','script.js','auth.css','auth.js','admin.css','admin.js'])app.get('/'+filename,(req,res)=>res.sendFile(publicDir+filename));
 // Existing tracks stay available on the public Home page. Supply your original files.
 app.get(/^\/track-0[1-6]\.mp3$/,(req,res)=>res.sendFile(publicDir+req.path.slice(1)));
 app.use((req,res)=>res.status(404).type('text').send('Not found'));
 app.use((err,req,res,next)=>{if(res.headersSent)return next(err);const status=err.status||500;res.status(status).json({error:status>=500?(err.status?err.message:'Service unavailable. Please try again later.'):err.message});});
 return app;
}
