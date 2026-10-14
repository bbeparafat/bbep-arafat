import {error,email} from './security.js';
export function approvedAdmins(env){return new Set(String(env.ADMIN_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean));}
export function createAdminServices({auth,db,env,requireReady}){
 const allowed=approvedAdmins(env);
 const isAdmin=user=>!!user?.email&&allowed.has(user.email.toLowerCase());
 async function moderation(uid){if(!db)return null;const s=await db.collection('accountModeration').doc(uid).get();return s.data()||null;}
 async function isBanned(uid){return (await moderation(uid))?.banned===true;}
 async function requireAdmin(user){requireReady();if(!isAdmin(user))throw error('Admin access is not permitted for this account.',403);}
 async function detail(uid){
  let u;try{u=await auth.getUser(uid);}catch(e){if(e.code==='auth/user-not-found')throw error('Account not found.',404);throw e;}const m=await moderation(uid);
  // Deliberate allowlist: never expose password hashes/salts, raw claims, tokens or OTPs.
  return {uid:u.uid,email:u.email||'',username:u.displayName||'',verified:u.emailVerified===true,status:m?.banned?'Banned':u.disabled?'Pending / disabled':'Active',banned:m?.banned===true,admin:isAdmin(u),createdAt:u.metadata?.creationTime||null,lastLogin:u.metadata?.lastSignInTime||null,signupMethod:u.customClaims?.googleSub?'Google + website password + email OTP':'Email + website password',banReason:m?.reason||'',bannedAt:m?.bannedAt||null};
 }
 async function accounts(user,{query='',pageToken}={}){
  await requireAdmin(user);query=String(query).trim();if(query.length>150||String(pageToken||'').length>2048)throw error('Search is too long.');
  let users=[],nextPageToken=null;
  if(query){try{
   if(query.includes('@'))users=[await auth.getUserByEmail(email(query))];
   else if(/^[A-Za-z0-9_]{3,24}$/.test(query)){const found=await db.collection('usernames').doc(query.toLowerCase()).get();if(found.exists)users=[await auth.getUser(found.data().uid)];}
  }catch(e){if(e.code!=='auth/user-not-found')throw e;}}
  else{const page=await auth.listUsers(50,pageToken||undefined);users=page.users;nextPageToken=page.pageToken||null;}
  const rows=await Promise.all(users.map(u=>detail(u.uid)));return {accounts:rows,nextPageToken};
 }
 async function accountDetails(user,uid){await requireAdmin(user);if(typeof uid!=='string'||!uid||uid.length>128)throw error('Invalid account.');return detail(uid);}
 async function setBan(user,{uid,banned,reason=''}){
  await requireAdmin(user);if(typeof uid!=='string'||!uid||uid.length>128||typeof banned!=='boolean')throw error('Invalid moderation request.');
  const u=await auth.getUser(uid);if(isAdmin(u)||uid===user.uid)throw error('Admin accounts cannot be banned from this panel.',403);
  reason=String(reason).trim();if(reason.length>500)throw error('Ban reason must be at most 500 characters.');
  const r=db.collection('accountModeration').doc(uid);
  if(banned){
   // Server authorization reads this first, so a provider-update failure fails closed.
   await r.set({banned:true,reason,bannedAt:Date.now(),actorUid:user.uid},{merge:true});
   await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);
  }else{
   await auth.revokeRefreshTokens(uid);
   await auth.updateUser(uid,{disabled:!u.emailVerified||!u.customClaims?.setupComplete});
   await r.set({banned:false,reason:'',unbannedAt:Date.now(),actorUid:user.uid},{merge:true});
  }
  return detail(uid);
 }
 return {isAdmin,isBanned,requireAdmin,accounts,accountDetails,setBan};
}
