// Run daily on the trusted server: node --env-file=.env server/cleanup.js
// This is housekeeping, not OTP validation. OTP expiry is checked on every request.
import {initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g,'\n')})});
const db=getFirestore(),auth=getAuth(),cutoff=Date.now()-86400000;
let removed=0;
const expired=await db.collection('signupChallenges').where('createdAt','<',cutoff).limit(500).get();
for(const doc of expired.docs){
 const value=doc.data();
 const moderation=await db.collection('accountModeration').doc(value.uid).get();
 // Preserve banned identities/reservations: cleanup must not let the same email evade a ban.
 if(moderation.data()?.banned)continue;
 const related=await db.collection('signupChallenges').where('uid','==',value.uid).get();
 if(related.docs.some(d=>d.data().status==='pending'&&d.data().createdAt>=cutoff))continue;
 let user;try{user=await auth.getUser(value.uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}
 if(user?.disabled&&!user.emailVerified){await auth.deleteUser(value.uid);const names=await db.collection('usernames').where('uid','==',value.uid).get();for(const d of names.docs)await d.ref.delete();removed++;}
 for(const d of related.docs)if(d.data().createdAt<cutoff)await d.ref.delete();
}
console.log(`Cleaned ${removed} expired, unfinished accounts. Run again if the 500-record batch filled.`);
