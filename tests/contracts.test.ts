import test from "node:test";
import assert from "node:assert/strict";
import { mergeCard } from "../opencomputer/agents/question-finder/tools/queue.js";
import { isPublicAddress, publicUrl, sitemapLocations, summarizeHtml } from "../opencomputer/agents/question-finder/tools/public-web.js";
import { opportunityId, validateBriefs } from "../opencomputer/agents/question-finder/tools/briefs.js";

const card={query:"opencode sandbox",question:"How do I run OpenCode in a cloud sandbox?",action:"create",volume:170,
  competitorDomain:"daytona.io",competitorUrl:"https://www.daytona.io/docs/en/guides/opencode/opencode-web-agent/",
  competitorRank:9,evidenceType:"indexed_rank",existingUrl:null,confidence:"medium",ownRanking:"not_checked",
  reason:"A relevant coding-agent deployment tutorial.",coverage:"No dedicated title found in the bounded sitemap sample.",
  outline:["Create a sandbox","Run and inspect a task"]};
const input={siteUrl:"https://opencomputer.dev",status:"partial",summary:"Candidate topic, rankings not validated live.",
  limitations:["Own ranking lookup unavailable."],opportunities:[card]};

test("arbitrary URLs cannot target local addresses or carry credentials",()=>{
  for(const value of ["http://example.com","https://localhost","https://127.0.0.1","https://10.1.2.3","https://169.254.169.254/latest/meta-data/","https://[::1]","https://user:secret@example.com","https://example.com:8443"])
    assert.throws(()=>publicUrl(value));
  for(const ip of ["10.1.2.3","127.0.0.1","192.168.2.1","172.31.1.1","100.64.1.1","::1","::ffff:127.0.0.1","2001:db8::1","fe80::1","fc00::1"])
    assert.equal(isPublicAddress(ip),false,ip);
  assert.equal(isPublicAddress("1.1.1.1"),true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"),true);
});

test("crawl extracts only same-origin sitemap entries and removes executable text",()=>{
  const urls=sitemapLocations('<loc>https://example.com/guides/a</loc><loc>https://evil.example/a</loc><loc>https://example.com/guides/a</loc>',new URL("https://example.com"));
  assert.deepEqual(urls,["https://example.com/guides/a"]);
  const page=summarizeHtml('<title>A &amp; B</title><script>steal()</script><h1>Hello</h1><p>World</p>');
  assert.equal(page.title,"A & B");assert.deepEqual(page.headings,["Hello"]);assert.ok(!page.text.includes("steal"));
});

test("brief result retains unknown metrics and rejects misleading evidence",()=>{
  const result=validateBriefs({...input,opportunities:[{...card,volume:null,competitorRank:null}]},"session-test");
  assert.equal(result.opportunities[0].volume,null);
  assert.equal(result.opportunities[0].ownRanking,"not_checked");
  assert.throws(()=>validateBriefs({...input,opportunities:[{...card,action:"improve"}]},"session-test"));
  assert.throws(()=>validateBriefs({...input,opportunities:[{...card,competitorUrl:"https://unrelated.com"}]},"session-test"));
  assert.throws(()=>validateBriefs({...input,opportunities:[{...card,action:"improve",existingUrl:"https://unrelated.com/page"}]},"session-test"));
  assert.throws(()=>validateBriefs({...input,opportunities:[card,{...card,query:"  OPENCODE   SANDBOX "}]},"session-test"));
  assert.throws(()=>validateBriefs({...input,limitations:[]},"session-test"));
  assert.equal(opportunityId("opencomputer.dev","OPENCODE  sandbox"),opportunityId("opencomputer.dev","opencode sandbox"));
});

test("queue refresh retains reviewed status and original session",()=>{
  const previous={...card,status:"dismissed",firstSessionId:"first-session"};
  const refreshed=mergeCard(previous,{...card,volume:200},"new-session");
  assert.equal(refreshed.status,"dismissed");
  assert.equal(refreshed.firstSessionId,"first-session");
  assert.equal(refreshed.volume,200);
  assert.equal(mergeCard(undefined,card,"first-session").status,"new");
});

import { compactSeoResult } from "../opencomputer/agents/question-finder/tools/normalize-seo.js";
test("ranking compaction preserves organic versus absolute rank and unknown metrics",()=>{
  const row={keyword_data:{keyword:"query",keyword_info:{search_volume:null,monthly_searches:Array(100).fill({volume:100})}},ranked_serp_element:{serp_item:{url:"https://example.com",rank_group:9,rank_absolute:12,type:"organic"},is_lost:false,last_updated_time:"2026-08-02"}};
  const compact=compactSeoResult("get_ranked_keywords",{content:[{text:"duplicated huge provider text"}],structuredContent:{keywords:Array(100).fill(row),totalCount:123}});
  assert.equal(compact.structuredContent.keywords[0].rank_group,9);
  assert.equal(compact.structuredContent.keywords[0].rank_absolute,12);
  assert.equal(compact.structuredContent.keywords[0].search_volume,null);
  assert.equal(compact.structuredContent.keywords[0].last_updated_time,"2026-08-02");
  assert.ok(JSON.stringify(compact).length<40000);
  assert.equal(compact.structuredContent.totalCount,123);
});

import { proveBriefs, type Evidence } from "../opencomputer/agents/question-finder/tools/evidence.js";
test("briefs cannot label indexed positions as live or invent volumes",()=>{
  const result=validateBriefs(input,"session-test");
  const evidence:Evidence[]=[{operation:"get_ranked_keywords",arguments:{target:"daytona.io"},fetchedAt:"2026-10-06",data:{keywords:[{keyword:card.query,search_volume:170,url:card.competitorUrl,rank_group:9,rank_absolute:11,is_lost:false,last_updated_time:"2026-07-30",volume_updated_time:"2026-09-12"}]}}];
  const proven=proveBriefs(result,evidence);
  assert.equal(proven.opportunities[0].rankBasis,"organic");
  assert.equal(proven.opportunities[0].observedAt,"2026-07-30");
  assert.throws(()=>proveBriefs({...result,opportunities:[{...result.opportunities[0],evidenceType:"live_serp"}]},evidence),/not in that query/);
  assert.throws(()=>proveBriefs({...result,opportunities:[{...result.opportunities[0],volume:999}]},evidence),/Unsupported volume/);
  const live:Evidence={operation:"get_serp_results",arguments:{depth:20},fetchedAt:"2026-10-06",data:{results:[{keyword:card.query,ok:true,items:[{url:card.competitorUrl,rank:11,type:"organic"}]}]}};
  const liveCard={...result.opportunities[0],competitorRank:11,evidenceType:"live_serp",ownRanking:"not_in_live_top20"};
  const liveResult=proveBriefs({...result,opportunities:[liveCard]},[...evidence,live]);
  assert.equal(liveResult.opportunities[0].rankBasis,"serp_absolute");
  assert.throws(()=>proveBriefs({...result,opportunities:[{...liveCard,competitorRank:9}]},[...evidence,live]),/not in that query/);
  live.data.results[0].items.push({url:"https://opencomputer.dev/page",rank:15,type:"organic"});
  assert.throws(()=>proveBriefs({...result,opportunities:[liveCard]},[...evidence,live]),/Own live absence/);
});

import { renderRunReport } from "../opencomputer/agents/question-finder/tools/report.js";
test("private report renders only supplied validated cards and escapes page text",()=>{
  const result=validateBriefs(input,"session-test");
  const html=renderRunReport({...result,opportunities:[{...result.opportunities[0],question:'<script>bad()</script>',rankBasis:"organic",observedAt:"2026-08-13",volumeObservedAt:"2026-09-13"}]},"Trial report");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("1 source-checked briefs"));
  assert.ok(html.endsWith("</html>"));
});
