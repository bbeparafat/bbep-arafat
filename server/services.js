import {createAdminServices} from './admin-services.js';
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {OAuth2Client} from 'google-auth-library';
import nodemailer from 'nodemailer';
import {OTP_TTL,RESEND_WAIT,MAX_ATTEMPTS,token,otp,hash,checkOtp,email,signupInput,error,validOrder} from './security.js';

export function createServices(env=process.env, dependencies={}){
 const origin=env.APP_ORIGIN || 'http://localhost:3000';
 const authReady=!!(env.FIREBASE_PROJECT_ID&&env.FIREBASE_CLIENT_EMAIL&&env.FIREBASE_PRIVATE_KEY&&env.FIREBASE_WEB_API_KEY&&env.OTP_HMAC_SECRET?.length>=32&&env.COOKIE_SECRET?.length>=32);
 const mailReady=!!(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASSWORD&&env.MAIL_FROM);
 const ready=authReady&&mailReady;
 const googleReady=ready&&!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);
 const orderReady=ready&&!!env.OWNER_EMAIL;
 const app=authReady&&!dependencies.auth?initializeApp({credential:cert({projectId:env.FIREBASE_PROJECT_ID,clientEmail:env.FIREBASE_CLIENT_EMAIL,privateKey:env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')})}):null;
 const auth=dependencies.auth || (app?getAuth(app):null),db=dependencies.db || (app?getFirestore(app):null);
 const smtp=dependencies.smtp || (mailReady?nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:Number(env.SMTP_PORT)===465,requireTLS:Number(env.SMTP_PORT)!==465,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,socketTimeout:20000}):null);
 const google=dependencies.google || (googleReady?new OAuth2Client(env.GOOGLE_CLIENT_ID,env.GOOGLE_CLIENT_SECRET,origin+'/auth/google/callback'):null);
 const fetcher=dependencies.fetch || fetch;
 const requireReady=()=>{if(!ready)throw error('Authentication and email services are not connected yet.',503);};
 const admin=createAdminServices({auth,db,env,requireReady});
 const ref=id=>db.collection('signupChallenges').doc(id);
 async function limit(key,max,windowMs){
  requireReady();const id=hash(env.OTP_HMAC_SECRET,'rate:'+key),r=db.collection('rateLimits').doc(id),time=Date.now();
  await db.runTransaction(async tx=>{const s=await tx.get(r);let v=s.data();if(!v||time>=v.until)v={count:0,until:time+windowMs};if(v.count>=max)throw error('Too many requests. Please wait and try again.',429);tx.set(r,{...v,count:v.count+1,deleteAfter:new Date(v.until+86400000)});});
 }
 async function userFromSession(cookie){
  if(!auth||!cookie)return null;
  try{const claims=await auth.verifySessionCookie(cookie,true);if(!claims.email_verified||!claims.setupComplete)return null;const u=await auth.getUser(claims.uid);if(u.disabled||!u.emailVerified||!u.customClaims?.setupComplete||await admin.isBanned(u.uid))return null;return {uid:u.uid,email:u.email,username:u.displayName,admin:admin.isAdmin(u)};}catch{return null;}
 }
 async function pending(id){if(!ready||!id)return null;const s=await ref(id).get(),v=s.data();if(!v||v.status!=='pending'||Date.now()>v.createdAt+86400000)return null;return {email:v.email,expiresAt:v.expiresAt,resendAt:v.resendAt};}
 async function googleProfile(id){if(!ready||!id)return null;const s=await db.collection('googleStages').doc(id).get(),v=s.data();return v&&Date.now()<v.expiresAt?{email:v.email,sub:v.sub}:null;}
 async function sendCode(v,code){await smtp.sendMail({from:env.MAIL_FROM,to:v.email,subject:'Your BBEP Arafat verification code',text:`Your verification code is: ${code}\n\nIt expires 2 minutes after issuance and can be used once.\nNever share this code. If you did not request it, ignore this email.`});}
 async function signup(data,previousId,googleId){
  requireReady();const input=signupInput(data);await limit('signup:'+input.email,5,3600000);
  const profile=googleId?await googleProfile(googleId):null;
  if(googleId&&!profile)throw error('Google sign-up expired. Continue with Google again.');
  if(profile&&profile.email!==input.email)throw error('Use the verified Google email for this sign-up.');
  let u,createdNew=false;try{u=await auth.getUserByEmail(input.email);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
  if(u){
   const previous=previousId?(await ref(previousId).get()).data():null;
   if(!u.disabled||u.emailVerified||!previous||previous.uid!==u.uid||previous.email!==input.email||previous.status!=='pending')throw error('Sign-up cannot be completed for these details. Try logging in or continue your existing verification.');
   // Updating the same browser's unfinished sign-up is allowed; no password is persisted here.
   // Update account details only after reserving the requested username.
  }else {u=await auth.createUser({email:input.email,password:input.password,displayName:input.username,emailVerified:false,disabled:true});createdNew=true;}
  if(await admin.isBanned(u.uid))throw error('This account is banned.',403);
  const nameRef=db.collection('usernames').doc(input.username.toLowerCase());
  try{await db.runTransaction(async tx=>{const s=await tx.get(nameRef);if(s.exists&&s.data().uid!==u.uid)throw error('That username is already in use. Choose another.');tx.set(nameRef,{uid:u.uid,createdAt:Date.now()});});}catch(e){if(createdNew)await auth.deleteUser(u.uid).catch(()=>{});throw e;}
  if(!createdNew)await auth.updateUser(u.uid,{password:input.password,displayName:input.username});
  // Old username reservations for this unfinished account are removed.
  const names=await db.collection('usernames').where('uid','==',u.uid).get();for(const doc of names.docs)if(doc.id!==input.username.toLowerCase())await doc.ref.delete();
  if(previousId)await ref(previousId).set({status:'superseded'},{merge:true});
  const id=token(),code=otp(),time=Date.now();
  const v={id,uid:u.uid,email:input.email,username:input.username,googleSub:profile?.sub||null,codeHash:hash(env.OTP_HMAC_SECRET,id+':'+code),attempts:0,status:'pending',createdAt:time,expiresAt:time+OTP_TTL,resendAt:time+RESEND_WAIT,deleteAfter:new Date(time+86400000)};
  await ref(id).set(v);
  try{await sendCode(v,code);}catch{throw Object.assign(error('The code could not be sent. Please retry sign-up in this browser.',503),{pendingId:id});}
  return {id,email:v.email,expiresAt:v.expiresAt,resendAt:v.resendAt};
 }
 async function resend(id){
  requireReady();if(!id)throw error('Complete sign-up first.');const code=otp(),time=Date.now();let value;
  const current=(await ref(id).get()).data();if(!current)throw error('Complete sign-up first.');await limit('otp:'+current.email,10,3600000);
  await db.runTransaction(async tx=>{const s=await tx.get(ref(id)),v=s.data();if(!v||v.status!=='pending'||time>v.createdAt+86400000)throw error('Verification session expired. Start sign-up again.');if(time<v.resendAt)throw error('Please wait 30 seconds between code requests.',429);value={...v,codeHash:hash(env.OTP_HMAC_SECRET,id+':'+code),attempts:0,expiresAt:time+OTP_TTL,resendAt:time+RESEND_WAIT};tx.set(ref(id),value);});
  try{await sendCode(value,code);}catch{throw error('Email could not be sent. Wait 30 seconds and retry.',503);}
  return {expiresAt:value.expiresAt,resendAt:value.resendAt};
 }
 async function createSession(uid){
  const customToken=await auth.createCustomToken(uid);
  const response=await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:customToken,returnSecureToken:true}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw error('Your email is verified. Please log in to continue.',503);
  const body=await response.json();return auth.createSessionCookie(body.idToken,{expiresIn:5*86400000});
 }
 async function verify(id,code){
  requireReady();if(!id)throw error('Complete sign-up first.');let value,wrong=false;
  await db.runTransaction(async tx=>{const s=await tx.get(ref(id)),v=s.data();const m=v?(await tx.get(db.collection('accountModeration').doc(v.uid))).data():null;if(m?.banned)throw error('This account is banned.',403);const correct=checkOtp(v,code,env.OTP_HMAC_SECRET);if(!correct){wrong=true;tx.update(ref(id),{attempts:v.attempts+1});return;}wrong=false;value=v;tx.update(ref(id),{status:'consumed',consumedAt:Date.now(),codeHash:null});});
  if(wrong)throw error('Incorrect code. After 5 incorrect attempts, request a new one.');
  await auth.setCustomUserClaims(value.uid,{setupComplete:true,googleSub:value.googleSub||null});
  await auth.updateUser(value.uid,{emailVerified:true,disabled:false});
  if(await admin.isBanned(value.uid)){await auth.updateUser(value.uid,{disabled:true});throw error('This account is banned.',403);}
  return createSession(value.uid);
 }
 async function login(data){
  requireReady();const e=email(data.email);await limit('login:'+e,10,900000);
  const response=await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,password:String(data.password||''),returnSecureToken:true}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw error('Unable to log in. Check your details and complete email verification.',401);
  const body=await response.json(),u=await auth.getUser(body.localId);if(u.disabled||!u.emailVerified||!u.customClaims?.setupComplete||await admin.isBanned(u.uid))throw error('Complete email verification before logging in.',403);
  return auth.createSessionCookie(body.idToken,{expiresIn:5*86400000});
 }
 async function logout(cookie){const u=await userFromSession(cookie);if(u)await auth.revokeRefreshTokens(u.uid);}
 async function googleStart(){
  if(!googleReady)throw error('Google sign-up is not configured yet.',503);
  const state=token(),nonce=token(),verifier=token();const challenge=(await import('node:crypto')).createHash('sha256').update(verifier).digest('base64url');
  await db.collection('oauthStates').doc(state).set({nonce,verifier,expiresAt:Date.now()+600000,deleteAfter:new Date(Date.now()+86400000)});
  return {state,url:google.generateAuthUrl({scope:['openid','email','profile'],state,nonce,prompt:'select_account',code_challenge:challenge,code_challenge_method:'S256'})};
 }
 async function googleCallback(state,code){
  if(!googleReady)throw error('Google sign-up is unavailable.',503);const r=db.collection('oauthStates').doc(state);let saved;
  await db.runTransaction(async tx=>{const s=await tx.get(r);saved=s.data();if(!saved||Date.now()>=saved.expiresAt)throw error('Google session expired.');tx.delete(r);});
  const {tokens}=await google.getToken({code,codeVerifier:saved.verifier});
  const ticket=await google.verifyIdToken({idToken:tokens.id_token,audience:env.GOOGLE_CLIENT_ID});const p=ticket.getPayload();
  if(!p?.email_verified||p.nonce!==saved.nonce||!p.sub)throw error('Google identity could not be verified.');
  const id=token();await db.collection('googleStages').doc(id).set({email:email(p.email),sub:p.sub,expiresAt:Date.now()+1800000,deleteAfter:new Date(Date.now()+86400000)});return id;
 }
 async function orders(user,data){
  if(!orderReady)throw error('Order email delivery is not connected yet.',503);
  const items=validOrder(data.items,user.email);await limit('order:'+user.uid,10,3600000);
  const reference='BBEP-'+token().slice(0,12).toUpperCase();
  const details=items.map((v,i)=>`REQUEST ${i+1}\n`+Object.entries(v).filter(([k])=>k!=='id').map(([k,v])=>`${k}: ${v||'Not specified'}`).join('\n')).join('\n\n--------------------\n\n');
  const text=`Order: ${reference}\nVerified account: ${user.email}\nUsername: ${user.username}\nAccount ID: ${user.uid}\n\n${details}`;
  await smtp.sendMail({from:env.MAIL_FROM,to:email(env.OWNER_EMAIL),replyTo:user.email,subject:`New music order ${reference}`,text});
  let copySent=true;try{await smtp.sendMail({from:env.MAIL_FROM,to:user.email,subject:`Your music request ${reference}`,text});}catch{copySent=false;}
  return {reference,copySent};
 }
 return {ready,googleReady,orderReady,limit,userFromSession,pending,googleProfile,signup,resend,verify,login,logout,googleStart,googleCallback,orders,...admin};
}
