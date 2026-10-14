import {randomBytes, randomInt, createHmac, timingSafeEqual} from 'node:crypto';
export const OTP_TTL = 120_000;
export const RESEND_WAIT = 30_000;
export const MAX_ATTEMPTS = 5;
export const token = () => randomBytes(32).toString('hex');
export const otp = () => String(randomInt(0,1_000_000)).padStart(6,'0');
export function hash(secret,value){return createHmac('sha256',secret).update(value).digest('hex');}
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function error(message,status=400){return Object.assign(new Error(message),{status});}
export function email(value){const v=String(value||'').trim().toLowerCase();if(v.length>150||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw error('Enter a valid email address.');return v;}
export function signupInput(data){const e=email(data.email),password=String(data.password||''),username=String(data.username||'').trim();if(password.length<12||password.length>128)throw error('Use a website password of 12–128 characters.');if(!/^[A-Za-z0-9_]{3,24}$/.test(username))throw error('Username must be 3–24 letters, numbers or underscores.');return {email:e,password,username};}
export function checkOtp(challenge,code,secret,time=Date.now()){
 if(!challenge||challenge.status!=='pending')throw error('No active verification. Start sign-up again.');
 if(time>=challenge.expiresAt)throw error('Code expired. Request a new code.');
 if(challenge.attempts>=MAX_ATTEMPTS)throw error('Too many incorrect codes. Request a new code.',429);
 return /^\d{6}$/.test(String(code))&&equal(challenge.codeHash,hash(secret,challenge.id+':'+code));
}
export function validOrder(items,accountEmail){
 if(!Array.isArray(items)||!items.length||items.length>20)throw error('Cart must contain 1–20 requests.');
 return items.map(item=>{
  if(!item||typeof item!=='object')throw error('Invalid music request.');
  const limits={id:100,customerName:100,customerEmail:150,telegram:33,musicStyle:500,duration:120,deadline:120,reference:2000,brief:10000,genre:30,songType:30,lyricsMode:30,lyrics:20000};
  const v={};for(const [key,max]of Object.entries(limits)){v[key]=String(item[key]||'').trim();if(v[key].length>max)throw error('An order field is too long.');}
  if(email(v.customerEmail)!==accountEmail)throw error('Order email must match your verified account email.');
  if(!v.customerName||!v.musicStyle||!/^@?[A-Za-z0-9_]{5,32}$/.test(v.telegram)||!['Phonk','Funk','Only Sound','Other'].includes(v.genre))throw error('Check required order details.');
  if(v.genre==='Other'&&!['Only Rap','Normal Song','Song + Rap'].includes(v.songType))throw error('Choose a valid song format.');
  if(v.genre!=='Only Sound'&&!['own','creator'].includes(v.lyricsMode))throw error('Choose a lyrics option.');
  if(v.genre==='Phonk'&&v.lyricsMode==='own'&&!v.lyrics)throw error('Phonk requires lyrics or Lyrics by BBEP ARAFAT.');
  return v;
 });
}
