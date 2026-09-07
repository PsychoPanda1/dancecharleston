import assert from "node:assert/strict";
import test from "node:test";
import { DANCE_STYLES, matchesStyle, renderStyleEvents } from "../scripts/dance-styles.mjs";
const style = name => DANCE_STYLES.find(s => s.path === name);
test("dance styles follow the event rather than a venue name", () => {
  const swing = {title:"Sunday Night Swing with Stephen — Ballroom Dance Charleston"};
  assert.equal(matchesStyle(swing, style("Swing")), true);
  assert.equal(matchesStyle(swing, style("Ballroom")), false);
  assert.equal(matchesStyle({title:"Beginner Argentine Tango — Ballroom Dance Charleston"}, style("Ballroom")), false);
  assert.equal(matchesStyle({title:"Beginner Rumba with Debbie — Ballroom Dance Charleston"}, style("Ballroom")), true);
  assert.equal(matchesStyle({title:"Charleston Dance Classic",description:"Two-day ballroom dance competition."}, style("Ballroom")), true);
  assert.equal(matchesStyle({title:"Salsa dance party",description:"At our ballroom venue"}, style("Ballroom")), false);
});
test("Latin nights and country socials appear in their relevant styles", () => {
  for (const title of ["Neon Latin with Uai", "Salsa & Bachata social", "Sunday Latin Social"]) assert.equal(matchesStyle({title}, style("Salsa-Bachata")), true);
  for (const title of ["Line Dancing at the Bull!", "2Steppin' 2sDay", "Country two-step lesson"]) assert.equal(matchesStyle({title}, style("Line-Dancing")), true);
  assert.equal(matchesStyle({title:"Argentine Tango with Tango Rojo"}, style("Salsa-Bachata")), false);
});
test("style pages show matching events and a useful empty result without a launch promise", () => {
  const events = [{title:"Sunday Night Swing",slug:"swing"}, {title:"Salsa social",slug:"salsa"}];
  const html = renderStyleEvents(events, style("Swing"), e => '<a href="/events/'+e.slug+'/">'+e.title+'</a>');
  assert.match(html, /\/events\/swing\//);
  assert.doesNotMatch(html, /\/events\/salsa\//);
  const empty = renderStyleEvents([], style("Swing"), () => "");
  assert.match(empty, /No upcoming dates/);
  assert.doesNotMatch(empty, /coming soon/i);
});
