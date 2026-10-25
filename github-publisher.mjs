export const OWNER='bbeparafat', REPO='bbep-arafat', BRANCH='main';
export const MAX_BYTES=100*1024*1024;
export function normalizeTracks(value){
 if(!Array.isArray(value)||value.length>1000)throw Error('Invalid music list.');
 return value.map(t=>{
  if(!t||typeof t.title!=='string'||!t.title.trim()||t.title.length>180||typeof t.src!=='string'||!/^\/?(?:[\w-]+\/)*[\w.-]+\.mp3$/i.test(t.src)||t.src.includes('..')||t.src.startsWith('/'))throw Error('Invalid song information.');
  return {id:typeof t.id==='string'?t.id:t.src,title:t.title.trim(),src:t.src,genre:['Phonk','Funk'].includes(t.genre)?t.genre:''};
 });
}
export function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);}
export function createPublisher(token,fetcher=fetch){
 if(!token||/\s/.test(token))throw Error('Enter a valid GitHub access token.');
 let authorized=false;
 async function api(path,method='GET',body){
  let r;try{r=await fetcher('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000),cache:'no-store',redirect:'error'});}catch{throw Error('GitHub could not be reached. Check the connection and try again.');}
  if(!r.ok){if(r.status===401)throw Error('GitHub rejected the token. Check that it is valid and has not expired.');if(r.status===403)throw Error('GitHub denied access. Check token permissions, account approval, or API limits.');if(r.status===409||r.status===422)throw Error('The repository changed or a branch rule blocked publishing. Refresh and retry; no overwrite was forced.');if(r.status===404)throw Error('Repository or music.json not found. Check repository access and upload the setup files first.');throw Error('GitHub request failed ('+r.status+').');}
  return r.status===204?null:r.json();
 }
 const root='/repos/'+OWNER+'/'+REPO;
 return {
  async connect(){const user=await api('/user');if(user.login?.toLowerCase()!==OWNER)throw Error('Connect using the GitHub account that owns this website.');await api(root);authorized=true;return user.login;},
  async publish({title,genre,file,onProgress=()=>{}}){
   if(!authorized)throw Error('Connect the administrator GitHub account first.');
   title=String(title||'').trim();if(!title||title.length>180)throw Error('Enter a song title of 1–180 characters.');
   if(!['Phonk','Funk'].includes(genre))throw Error('Choose Phonk or Funk.');
   if(!file||!file.name.toLowerCase().endsWith('.mp3')||file.size===0||file.size>MAX_BYTES)throw Error('Choose an MP3 file up to 100 MB.');
   const bytes=new Uint8Array(await file.arrayBuffer());
   if(!(bytes[0]===73&&bytes[1]===68&&bytes[2]===51)&&!(bytes[0]===255&&(bytes[1]&224)===224))throw Error('The file does not appear to be an MP3.');
   onProgress('Reading the current music collection…');
   const ref=await api(root+'/git/ref/heads/'+BRANCH),head=ref.object.sha;
   const commit=await api(root+'/git/commits/'+head);
   const manifest=await api(root+'/contents/music.json?ref='+encodeURIComponent(head));
   let tracks;try{const raw=Uint8Array.from(atob(manifest.content.replace(/\s/g,'')),c=>c.charCodeAt(0));tracks=normalizeTracks(JSON.parse(new TextDecoder().decode(raw)));}catch{throw Error('The existing music.json is invalid. Nothing was published.');}
   const id=crypto.randomUUID(),src='audio/'+id+'.mp3';
   onProgress('Uploading the MP3 securely to GitHub…');
   const audioBlob=await api(root+'/git/blobs','POST',{content:base64(bytes),encoding:'base64'});
   tracks.push({id,title,src,genre});
   const listBlob=await api(root+'/git/blobs','POST',{content:base64(new TextEncoder().encode(JSON.stringify(tracks,null,2)+'\n')),encoding:'base64'});
   const tree=await api(root+'/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:src,mode:'100644',type:'blob',sha:audioBlob.sha},{path:'music.json',mode:'100644',type:'blob',sha:listBlob.sha}]});
   const next=await api(root+'/git/commits','POST',{message:'Add music: '+title,tree:tree.sha,parents:[head]});
   onProgress('Publishing the song and music list together…');
   await api(root+'/git/refs/heads/'+BRANCH,'PATCH',{sha:next.sha,force:false});
   return {sha:next.sha,title};
  },
  disconnect(){token='';authorized=false;}
 };
}
