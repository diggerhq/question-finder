import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { queryKey } from "./briefs.js";

export interface Evidence { operation: string; arguments: Record<string,any>; data: Record<string,any>; fetchedAt: string; }
function directory(sessionId:string) { return "/workspace/.question-finder/evidence/"+createHash("sha256").update(sessionId).digest("hex"); }
export async function rememberEvidence(sessionId:string,toolCallId:string,evidence:Evidence) {
  const dir=directory(sessionId);await mkdir(dir,{recursive:true});
  await writeFile(dir+"/"+createHash("sha256").update(toolCallId).digest("hex")+".json",JSON.stringify(evidence),{mode:0o600});
}
export async function readEvidence(sessionId:string):Promise<Evidence[]> {
  const dir=directory(sessionId);
  let files:string[];
  try {files=await readdir(dir);} catch(error) {if((error as NodeJS.ErrnoException).code==="ENOENT")return [];throw error;}
  return Promise.all(files.filter(f=>f.endsWith(".json")).map(async file=>JSON.parse(await readFile(dir+"/"+file,"utf8"))));
}
function sameUrl(a:unknown,b:unknown) {try {const x=new URL(String(a));const y=new URL(String(b));return x.hostname.replace(/^www\./,"")===y.hostname.replace(/^www\./,"")&&x.pathname.replace(/\/$/,"")===y.pathname.replace(/\/$/,"")&&x.search===y.search;} catch{return false;} }
function host(value:unknown) {try{return new URL(String(value).includes("://")?String(value):"https://"+value).hostname.replace(/^www\./,"");}catch{return "";} }
export function proveBriefs<T extends {domain:string;opportunities:Array<Record<string,any>>}>(result:T,evidence:Evidence[]) {
  const ranked=evidence.filter(e=>e.operation==="get_ranked_keywords");
  const opportunities=result.opportunities.map(card=>{
    const keyword=queryKey(card.query);
    const rankedRows=ranked.flatMap(e=>(e.data.keywords??[]).filter((r:Record<string,any>)=>queryKey(String(r.keyword))===keyword&&!r.is_lost).map((row:Record<string,any>)=>({row,e})));
    const measured=rankedRows.find(({row})=>row.search_volume===card.volume);
    if(card.volume!==null&&!measured)throw new Error(`Unsupported volume for '${card.query}'; use the exact measured query volume or null.`);
    let rankBasis:string;let observedAt:string|null;
    if(card.evidenceType==="indexed_rank") {
      const source=rankedRows.find(({row})=>sameUrl(row.url,card.competitorUrl)&&(card.competitorRank===null||row.rank_group===card.competitorRank));
      if(!source)throw new Error(`Indexed evidence for '${card.query}' does not match the provider's URL and organic rank. Omit this card if no matching competitor source exists; do not guess or retry paid lookups.`);
      rankBasis="organic";observedAt=source.row.last_updated_time??null;
    } else {
      const source=evidence.filter(e=>e.operation==="get_serp_results").flatMap(e=>(e.data.results??[]).filter((q:Record<string,any>)=>q.ok&&queryKey(q.keyword)===keyword).map((q:Record<string,any>)=>({q,e}))).find(({q})=>q.items.some((item:Record<string,any>)=>item.type==="organic"&&sameUrl(item.url,card.competitorUrl)&&(card.competitorRank===null||item.rank===card.competitorRank)));
      if(!source)throw new Error(`Live evidence for '${card.query}' is not in that query's returned SERP. Use actual live evidence or label matching indexed evidence as indexed_rank. If no matching competitor source exists, omit this card; do not guess or retry paid lookups.`);
      rankBasis="serp_absolute";observedAt=source.e.fetchedAt;
    }
    if(card.ownRanking==="not_in_live_top20") {
      const ownSerp=evidence.filter(e=>e.operation==="get_serp_results"&&e.arguments.depth===20).flatMap(e=>e.data.results??[]).find(q=>q.ok&&queryKey(q.keyword)===keyword);
      if(!ownSerp||ownSerp.items.some((item:Record<string,any>)=>host(item.url)===result.domain||host(item.url).endsWith("."+result.domain)))throw new Error(`Own live absence for '${card.query}' is not supported by the returned depth-20 SERP.`);
    }
    if(card.ownRanking==="not_in_sample") {
      const own=ranked.filter(e=>host(e.arguments.target)===result.domain);
      if(!own.length||own.some(e=>(e.data.keywords??[]).some((r:Record<string,any>)=>queryKey(String(r.keyword))===keyword&&!r.is_lost)))throw new Error(`Own sample absence for '${card.query}' is unsupported; use not_checked or present.`);
    }
    return {...card,rankBasis,observedAt,volumeObservedAt:measured?.row.volume_updated_time??null};
  });
  const proven={...result,opportunities};
  if(Buffer.byteLength(JSON.stringify(proven),"utf8")>7900)throw new Error("Result including source dates exceeds size limit; return fewer, shorter briefs.");
  return proven;
}
