// Cloudflare Worker API for petition signatures. No public export of personal data.
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const hex=bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
async function sha(text){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));}
function allowedOrigin(req,env){const origin=req.headers.get('Origin');if(!origin)return false;try{const requested=new URL(origin),configured=new URL(env.FRONTEND_ORIGIN);return requested.protocol==='https:'&&configured.protocol==='https:'&&(requested.hostname===configured.hostname||requested.hostname==='www.'+configured.hostname||configured.hostname==='www.'+requested.hostname);}catch{return false;}}
function cors(req,env){const origin=req.headers.get('Origin');return allowedOrigin(req,env)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}:{};}
function validEmail(s){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)&&s.length<=254;}
export default {async fetch(req,env){
 const url=new URL(req.url),path=url.pathname,headers=cors(req,env);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
 if(path==='/api/count'&&req.method==='GET'){
  const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM signatures WHERE verified_at IS NOT NULL').first();
  return json({count:row?.n||0},200,headers);
 }
 if(path==='/api/sign'&&req.method==='POST'){
  if(!allowedOrigin(req,env))return json({error:'Origin not allowed'},403,headers);
  if(Number(req.headers.get('content-length')||0)>10000)return json({error:'Request too large'},413,headers);
  const b=await req.json();
  const first=String(b.first_name||'').trim(),last=String(b.last_name||'').trim(),email=String(b.email||'').trim().toLowerCase(),state=String(b.state||'').trim().toUpperCase(),zip=String(b.zip||'').trim(),phone=String(b.phone||'').trim(),address=String(b.address||'').trim();
  if(!first||first.length>80||!last||last.length>80||! /^[+0-9(). -]{7,25}$/.test(phone)||!address||address.length>200||typeof b.sms_opt_in!=='boolean'||!validEmail(email)||! /^[A-Z ]{2,40}$/.test(state)||! /^[A-Za-z0-9 -]{3,12}$/.test(zip)||b.petition_agreement!==true||typeof b.updates!=='boolean'||typeof b.marketing!=='boolean')return json({error:'Invalid fields or missing petition agreement'},400,headers);
  if(!env.TURNSTILE_SECRET||!env.RESEND_API_KEY||!env.HASH_SECRET||!env.FROM_EMAIL||!env.API_ORIGIN||!env.ORGANIZER_NAME||!env.MARKETING_CONSENT_TEXT)return json({error:'Signing is not configured'},503,headers);
  const challenge=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:String(b.turnstile||''),remoteip:req.headers.get('CF-Connecting-IP')})}).then(r=>r.json());
  if(!challenge.success)return json({error:'Bot verification failed'},400,headers);
  const emailHash=await sha(env.HASH_SECRET+':'+email);
  const suppressed=await env.DB.prepare('SELECT email_hash FROM email_suppressions WHERE email_hash=?').bind(emailHash).first();
  if(suppressed)return json({message:'If eligible, a verification email will be sent.'},202,headers);
  const id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID(),tokenHash=await sha(token),now=new Date().toISOString(),expires=new Date(Date.now()+86400000).toISOString();
  const consent=String(env.MARKETING_CONSENT_TEXT);
  const inserted=await env.DB.prepare('INSERT OR IGNORE INTO signatures(id,first_name,last_name,email,email_hash,state,zip,phone,address,sms_opt_in,sms_consent_text,petition_version,updates_opt_in,marketing_opt_in,marketing_consent_text,consent_timestamp,verification_token_hash,verification_expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,first,last,email,emailHash,state,zip,phone,address||null,b.sms_opt_in?1:0,b.sms_opt_in?'Optional: I would like to receive text messages from the petition organizer at the mobile number provided. Message and data rates may apply. Reply STOP to opt out. Consent is not required to sign.':null,'2026-11-07-v2',b.updates?1:0,b.marketing?1:0,b.marketing?consent:null,now,tokenHash,expires,now).run();
  if(!inserted.meta?.changes)return json({message:'If eligible, a verification email will be sent.'},202,headers);
  const link=env.API_ORIGIN.replace(/\/$/,'')+'/api/verify?token='+encodeURIComponent(token);
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.FROM_EMAIL,to:[email],subject:'Verify your Enforce the Law Now petition signature',text:'Please confirm your petition signature by opening this link within 24 hours: '+link+'\n\nIf you did not sign, ignore this email.'})});
  if(!sent.ok){await env.DB.prepare('DELETE FROM signatures WHERE id=? AND verified_at IS NULL').bind(id).run();return json({error:'Unable to send verification email. Please try later.'},502,headers);}
  return json({message:'Check your email to verify your signature.'},202,headers);
 }
 if(path==='/api/verify'&&req.method==='GET'){
  const token=url.searchParams.get('token')||'';
  if(token.length>150)return new Response('Invalid verification link',{status:400});
  const tokenHash=await sha(token);
  const row=await env.DB.prepare('SELECT id,verification_expires_at,verified_at FROM signatures WHERE verification_token_hash=?').bind(tokenHash).first();
  if(!row||row.verified_at||Date.parse(row.verification_expires_at)<Date.now())return new Response('Link invalid or expired',{status:400});
  await env.DB.prepare('UPDATE signatures SET verified_at=? WHERE id=? AND verified_at IS NULL').bind(new Date().toISOString(),row.id).run();
  return new Response('Your petition signature is verified. Thank you!',{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
 }
 return json({error:'Not found'},404,headers);
 }catch(e){return json({error:'Request could not be completed'},500,headers);}
}};
