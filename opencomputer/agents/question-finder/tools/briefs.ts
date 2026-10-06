import { createHash } from "node:crypto";
import { publicUrl } from "./public-web.js";

export function queryKey(query: string): string { return query.toLowerCase().normalize("NFKC").replace(/\s+/g," ").trim(); }
export function opportunityId(domain: string, query: string): string {
  return "idea_"+createHash("sha256").update(domain+":"+queryKey(query)).digest("hex").slice(0,12);
}
function text(value: unknown, name: string, max: number): string {
  if(typeof value!=="string" || !value.trim() || value.length>max) throw new Error(`Invalid ${name}; provide nonempty text of at most ${max} characters.`);
  return value.trim();
}
function metric(value: unknown,name: string,max: number): number|null {
  if(value===null) return null;
  if(typeof value!=="number" || !Number.isInteger(value) || value<0 || value>max) throw new Error(`Invalid ${name}; use null for unknown.`);
  return value;
}
export function validateBriefs(input: Record<string,unknown>, sessionId: string) {
  const siteUrl=publicUrl(text(input.siteUrl,"siteUrl",2048)).href;
  const domain=new URL(siteUrl).hostname.replace(/^www\./,"");
  const status=text(input.status,"status",20);
  if(!["complete","partial","blocked"].includes(status)) throw new Error("Invalid result status.");
  if(!Array.isArray(input.limitations) || input.limitations.length>8) throw new Error("Provide at most 8 limitations.");
  const limitations=input.limitations.map((s:unknown)=>text(s,"limitation",350));
  if(status!=="complete" && !limitations.length) throw new Error("Partial and blocked results require limitations.");
  if(!Array.isArray(input.opportunities)||input.opportunities.length>5) throw new Error("Return at most five opportunities.");
  const seen=new Set<string>();
  const opportunities=input.opportunities.map((value:unknown)=>{
    if(!value || typeof value!=="object" || Array.isArray(value)) throw new Error("Invalid opportunity.");
    const c=value as Record<string,unknown>;
    const query=text(c.query,"query",150);const key=queryKey(query);
    if(seen.has(key)) throw new Error("Group duplicate search queries into one brief.");seen.add(key);
    const action=text(c.action,"action",10); if(!["create","improve"].includes(action)) throw new Error("Invalid action.");
    const existingUrl=c.existingUrl===null?null:publicUrl(text(c.existingUrl,"existingUrl",2048)).href;
    if(action==="improve"&&!existingUrl) throw new Error("Improve requires an existing URL.");
    if(existingUrl) {
      const existingDomain=new URL(existingUrl).hostname.replace(/^www\./,"");
      if(existingDomain!==domain&&!existingDomain.endsWith("."+domain)) throw new Error("Existing page must belong to the requested site.");
    }
    const competitorDomain=text(c.competitorDomain,"competitorDomain",200).toLowerCase().replace(/^www\./,"");
    if(competitorDomain===domain) throw new Error("Competitor evidence cannot be the user's own domain.");
    const competitorUrl=publicUrl(text(c.competitorUrl,"competitorUrl",2048)).href;
    const sourceDomain=new URL(competitorUrl).hostname.replace(/^www\./,"");
    if(sourceDomain!==competitorDomain&&!sourceDomain.endsWith("."+competitorDomain)) throw new Error("Evidence URL must belong to the competitor.");
    const evidenceType=text(c.evidenceType,"evidenceType",30);
    if(!["indexed_rank","live_serp"].includes(evidenceType)) throw new Error("Invalid rank evidence type.");
    const confidence=text(c.confidence,"confidence",10);if(!["low","medium","high"].includes(confidence)) throw new Error("Invalid confidence.");
    const ownRanking=text(c.ownRanking,"ownRanking",30);
    if(!["not_checked","not_in_sample","present","not_in_live_top20"].includes(ownRanking)) throw new Error("Invalid own ranking observation.");
    if(!Array.isArray(c.outline)||c.outline.length<2||c.outline.length>5) throw new Error("Provide 2–5 outline bullets.");
    return {id:opportunityId(domain,query),query,question:text(c.question,"question",180),action,
      volume:metric(c.volume,"volume",1000000000),competitorDomain,competitorUrl,
      competitorRank:metric(c.competitorRank,"competitorRank",1000),evidenceType,
      existingUrl,confidence,ownRanking,reason:text(c.reason,"reason",350),
      coverage:text(c.coverage,"coverage",250),outline:c.outline.map((s:unknown)=>text(s,"outline",150))};
  });
  const result={siteUrl,domain,status,summary:text(input.summary,"summary",600),limitations,
    opportunities,sessionId,generatedAt:new Date().toISOString()};
  if(Buffer.byteLength(JSON.stringify(result),"utf8")>7900) throw new Error("Briefs exceed result size; shorten text or return fewer cards.");
  return result;
}
