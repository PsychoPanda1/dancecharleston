import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://dancecharleston.com';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = s => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
export function calendarFile(event, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DanceCharleston//Invites//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${icsText(event.uid)}`,`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(event.start)}`,`DTEND:${stamp(event.end)}`,`SUMMARY:${icsText(event.title)}`,`LOCATION:${icsText(event.location)}`,`URL:${ORIGIN}/events/${event.slug}/`,'END:VEVENT','END:VCALENDAR'];
  // Fold at 73 UTF-8 octets without splitting a code point.
  return lines.map(line => { let result='', col=0; for (const char of line) { const bytes=Buffer.byteLength(char); if(col+bytes>73) { result+='\r\n ';col=1; }result+=char;col+=bytes; }return result; }).join('\r\n')+'\r\n';
}
export function resolveInvite(spec, events, now) {
  const found = events.find(e => e.uid === spec.uid);
  const event = found ?? { ...spec.initial, uid: spec.uid };
  const end = event.end ?? spec.initial.end;
  const state = event.status === 'https://schema.org/EventCancelled' ? 'cancelled' : new Date(end) <= now ? 'past' : !found ? 'unavailable' : 'active';
  return { ...spec, event: { ...event, end }, state };
}
function walletLink(url, label, provider) {
  if (!url) return '';
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || (provider === 'google' && parsed.hostname !== 'pay.google.com') || (provider === 'apple' && !parsed.pathname.endsWith('.pkpass'))) throw new Error('Invalid Wallet URL');
  return `<a class="button secondary" href="${esc(url)}">${label}</a>`;
}
export function renderInvite(invite, { reusable = false, wallet = {} } = {}) {
  const { event, state } = invite;
  const pinned = `/go/${invite.id}/`;
  const url = ORIGIN + (reusable ? '/go/' : pinned);
  const date = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric'}).format(new Date(event.start));
  const active = state === 'active';
  const data = { title: invite.headline, band: invite.band, date, price: invite.price, url: ORIGIN+pinned, reusableUrl: ORIGIN+'/go/', image: invite.image, qr: `${pinned}qr.svg`, reusableQr:'/go/qr.svg', end: new Date(event.end).toISOString(), state };
  const status = { past: 'This event has ended. Explore the calendar for your next dance.', cancelled:'This event has been cancelled.', unavailable:'This event is not in the current calendar feed. Check the organizer for the latest details.' }[state];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(event.title)} | DanceCharleston</title><meta name="description" content="${esc(`${date}. ${invite.band} live. ${invite.price}. ${invite.reassurance}. ${event.location}`)}"><link rel="canonical" href="${url}"><meta property="og:title" content="${esc(invite.headline)}"><meta property="og:description" content="${esc(`${date} · ${invite.band} · ${invite.price} · ${invite.reassurance}`)}"><meta property="og:image" content="${ORIGIN}${invite.image}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#24242e"><link rel="stylesheet" href="/go/invite.css?v=1"></head><body>
  <header><a href="/">DanceCharleston</a><a href="/events/">All dances <span aria-hidden="true">↗</span></a></header>
  <main><article class="invite"><div class="art"><img src="${invite.image}" alt="She Goes He Goes — gold Art Deco band artwork" width="746" height="424"></div><div class="body"><p class="eyebrow">${esc(date)} · Holy City Swing</p><h1>${esc(invite.headline)}</h1><p class="intro">Live music. A welcoming dance floor.<br>${esc(invite.reassurance)}.</p><p class="price">${esc(invite.price)}</p><div class="facts"><p>${esc(invite.lesson)}<br>${esc(invite.dancing)}</p><p><strong>Radiant Church</strong><br>4870 Piedmont Ave, North Charleston</p></div><p id="event-status" role="status" ${status?'':'hidden'}>${esc(status)}</p><div class="actions">${active?`<a class="button" data-calendar-link href="${pinned}event.ics" download>Add to calendar</a>`:''}<button class="button ${active?'secondary':''}" id="share">Share this invite</button><a class="button secondary" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(event.location)}" target="_blank" rel="noopener">Get directions</a><a class="text-link" href="/events/${esc(event.slug)}/">Full event details →</a></div><div class="tools"><button id="show-qr">Show QR</button><button id="save-card">Save phone card</button></div><p id="feedback" role="status"></p><details><summary>Keep DanceCharleston handy</summary><p>Save this page to your Home Screen for a quick way to invite someone dancing.</p><p>On iPhone: Safari → Share → Add to Home Screen.<br>On Android: browser menu → Add to Home screen.</p><button class="button secondary" id="reusable">Show my reusable QR</button><p class="small">Your reusable QR opens the featured dance. Sharing this invitation always keeps this event’s date.</p>${walletLink(wallet.apple,'Add to Apple Wallet','apple')}${walletLink(wallet.google,'Add to Google Wallet','google')}</details></div></article></main>
  <dialog id="qr-dialog"><button id="close-qr" aria-label="Close QR code">✕</button><p class="eyebrow" id="qr-kind">This event</p><h2 id="qr-title">Scan. Meet. Dance.</h2><img id="qr-image" src="${pinned}qr.svg" alt="QR code opening this event invitation" width="280" height="280"><p id="qr-note">Open your camera and scan to see the invite.</p><button id="copy">Copy link</button></dialog><script type="application/json" id="invite-data">${JSON.stringify(data).replace(/</g,'\\u003c')}</script><script src="/go/invite.js?v=1" defer></script></body></html>`;
}
export async function buildInvites(rootDir, outputDir, events, now) {
  const config = JSON.parse(await readFile(path.join(rootDir,'go/featured.json'),'utf8'));
  const invites = config.invites.map(spec => resolveInvite(spec,events,now));
  const featured = invites.find(i => i.id === config.featured);
  if (!featured) throw new Error('Featured invitation is missing');
  for (const invite of invites) {
    if (!/^[a-z0-9-]+$/.test(invite.id)) throw new Error('Invalid invite ID');
    const dir = path.join(outputDir,'go',invite.id);await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'index.html'),renderInvite(invite,{wallet:config.wallet}));
    if(invite.state==='active') await writeFile(path.join(dir,'event.ics'),calendarFile(invite.event,now));
  }
  await writeFile(path.join(outputDir,'go/index.html'),renderInvite(featured,{reusable:true,wallet:config.wallet}));
}
