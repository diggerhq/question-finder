import { defineTool } from "@opencomputer/agent";
import { callOpenSeo } from "./openseo.js";
import { proveBriefs, readEvidence } from "./evidence.js";
import { validateBriefs } from "./briefs.js";
import { renderRunReport, reportTitle } from "./report.js";
import { publicUrl } from "./public-web.js";

const prefix="qf-";
const siteSlug="qf-site";
function data(result: Record<string,any>): Record<string,any> {
  if(result.isError)throw new Error(JSON.stringify(result.content));
  if(!result.structuredContent)throw new Error("OpenSEO structured state response missing.");
  return result.structuredContent;
}
function sections(context: Record<string,any>): Map<string,any> {
  const map=new Map<string,any>();
  for(const section of context.customSections??[]) {
    if(String(section.slug??section.customSection??"").startsWith(prefix)) {
      try {map.set(section.slug??section.customSection,JSON.parse(section.content));} catch {throw new Error("Saved Question Finder state is unreadable; do not overwrite it.");}
    }
  }
  return map;
}
function patch(slug: string,title: string,value: unknown) {
  const content=JSON.stringify(value);
  if(content.length>3900)throw new Error("Saved state exceeds OpenSEO section size; shorten the brief.");
  return {customSection:slug,title,content};
}
export function mergeCard(previous: Record<string,any>|undefined,card: Record<string,any>,sessionId: string): Record<string,any> {
  return {...previous,...card,status:previous?.status??"new",firstSessionId:previous?.firstSessionId??sessionId,updatedAt:new Date().toISOString()};
}
export const queueState=defineTool({
  name:"queue_state",
  description:"Read and persist Question Finder's private OpenSEO queue. No research credits. due lists at most three monitored sites; load reads a site's state/cards; save_run persists validated result cards preserving review status; review changes one card; monitor explicitly enables/pauses weekly refresh. Existing OpenSEO prose is untouched.",
  input:{type:"object",properties:{action:{type:"string",enum:["due","load","save_run","review","monitor","report"]},projectId:{type:"string"},siteUrl:{type:"string"},result:{type:"object",additionalProperties:true},audience:{type:"string",maxLength:500},competitors:{type:"array",maxItems:3,items:{type:"string"}},locationCode:{type:"number"},languageCode:{type:"string"},ideaId:{type:"string"},status:{type:"string",enum:["approved","dismissed","published"]},publishedUrl:{type:"string"},enabled:{type:"boolean"}},required:["action"],additionalProperties:false},
  async run({input,sessionId,toolCallId,signal}) {
    let count=0;
    const rpc=async(name:string,args:Record<string,unknown>)=>data(await callOpenSeo(name,args,`${toolCallId}-${++count}`,signal));
    const projects=(await rpc("list_projects",{})).projects as Array<Record<string,any>>;
    if(!Array.isArray(projects))throw new Error("Project list unavailable.");
    if(input.action==="due") {
      const sites: Array<Record<string,any>>=[];
      for(const p of projects.slice(0,20)) {
        const saved=sections(await rpc("get_project_context",{projectId:p.id})).get(siteSlug);
        if(saved?.monitoringEnabled===true)sites.push({...saved,projectId:p.id});
      }
      sites.sort((a,b)=>String(a.lastAttemptAt??a.createdAt).localeCompare(String(b.lastAttemptAt??b.createdAt)));
      return JSON.parse(JSON.stringify({sites:sites.slice(0,3),scannedProjects:Math.min(projects.length,20),limited:projects.length>20}));
    }
    const project=projects.find(p=>p.id===input.projectId);
    if(!project)throw new Error("Use a project ID from list_projects.");
    const siteUrl=publicUrl(String(input.siteUrl)).href;
    const domain=new URL(siteUrl).hostname.replace(/^www\./,"");
    const projectDomain=String(project.domain??"").replace(/^https?:\/\//,"").split("/")[0].replace(/^www\./,"").toLowerCase();
    if(domain!==projectDomain)throw new Error("Queue project must match the requested site domain.");
    const map=sections(await rpc("get_project_context",{projectId:project.id}));
    const saved=map.get(siteSlug);
    const cards=[...map.entries()].filter(([key])=>key.startsWith("qf-idea-")).map(([,card])=>card);
    if(input.action==="load")return JSON.parse(JSON.stringify({site:saved??null,opportunities:cards}));
    const site={domain,siteUrl,createdAt:new Date().toISOString(),monitoringEnabled:false,...saved};
    const updates:Array<Record<string,unknown>>=[];
    let validatedRun:Record<string,any>|undefined;
    if(input.action==="save_run") {
      const result=proveBriefs(validateBriefs(input.result as Record<string,unknown>,sessionId),(await readEvidence(sessionId)).filter(e=>e.arguments.projectId===project.id));
      validatedRun=result;
      if(result.domain!==domain)throw new Error("Research result domain does not match queue.");
      for(const card of result.opportunities) {
        const slug="qf-"+card.id.replace(/_/g,"-");
        if(!map.has(slug)&&cards.length+updates.length>=100)throw new Error("Queue has reached its 100-card workspace limit.");
        updates.push(patch(slug,card.question,mergeCard(map.get(slug),card,sessionId)));
      }
      site.lastAttemptAt=result.generatedAt;
      if(result.status==="complete"&&result.opportunities.length)site.lastSuccessAt=result.generatedAt;
      site.lastRun={sessionId,status:result.status,summary:result.summary,limitations:result.limitations,generatedAt:result.generatedAt};
      if(typeof input.audience==="string")site.audience=input.audience;
      if(Array.isArray(input.competitors))site.competitors=input.competitors;
      if(typeof input.locationCode==="number")site.locationCode=input.locationCode;
      if(typeof input.languageCode==="string")site.languageCode=input.languageCode;
    } else if(input.action==="report") {
      if(!saved||!cards.length)throw new Error("No saved briefs to report. Analyze the site first.");
      validatedRun={siteUrl,domain,opportunities:cards,status:site.lastRun?.status??"partial",summary:site.lastRun?.summary??"Saved content queue",limitations:site.lastRun?.limitations??[],sessionId:site.lastRun?.sessionId??sessionId,generatedAt:site.lastRun?.generatedAt??site.lastAttemptAt??new Date().toISOString()};
    } else if(input.action==="monitor") {
      if(!saved)throw new Error("Analyze and save this site before enabling monitoring.");
      if(typeof input.enabled!=="boolean")throw new Error("Specify enabled true or false.");
      site.monitoringEnabled=input.enabled;
    } else if(input.action==="review") {
      const card=cards.find(c=>c.id===input.ideaId);
      if(!card)throw new Error("Opportunity is not in this site's queue.");
      if(!["approved","dismissed","published"].includes(String(input.status)))throw new Error("Choose a valid review status.");
      if(card.status==="published"&&input.status!=="published")throw new Error("Published ideas cannot be reset through this action.");
      if(input.status==="published") {
        const publishedUrl=publicUrl(String(input.publishedUrl));
        if(publishedUrl.hostname.replace(/^www\./,"")!==domain&&!publishedUrl.hostname.endsWith("."+domain))throw new Error("Published URL must belong to this site.");
        card.publishedUrl=publishedUrl.href;
      }
      card.status=input.status;card.updatedAt=new Date().toISOString();
      updates.push(patch("qf-"+card.id.replace(/_/g,"-"),card.question,card));
    } else throw new Error("Unsupported queue action.");
    if(input.action!=="report")updates.push(patch(siteSlug,"Question Finder — saved site",site));
    const after=input.action==="report"?map:sections(await rpc("update_project_context",{projectId:project.id,updates}));
    let reportUrl:string|undefined;let reportError:string|undefined;
    if(validatedRun?.opportunities.length) {
      try {
        const title=reportTitle(domain,validatedRun.generatedAt);
        const reports=(await rpc("list_reports",{projectId:project.id})).reports??[];
        const existing=reports.find((r:Record<string,any>)=>r.title===title);
        let finalTitle=title;
        let reportId=existing?.id;
        if(reportId) {
          const detail=await rpc("get_report",{projectId:project.id,reportId});
          if(detail.report?.shareUrl) {reportId=undefined;finalTitle=title+" — "+sessionId.slice(0,8);}
        }
        const report=await rpc("save_report",{projectId:project.id,...(reportId?{reportId}:{}),title:finalTitle,skill:"competitor-analysis",summary:`${validatedRun.opportunities.length} source-checked content briefs for ${domain}. Status: ${validatedRun.status}. Ranking types, source dates and bounded coverage are recorded for every card.`,html:renderRunReport(validatedRun,finalTitle)});
        reportUrl=report.url;
      } catch(error) {reportError=error instanceof Error?error.message:"Private report could not be saved.";}
    }
    return JSON.parse(JSON.stringify({saved:true,reportUrl,reportError,site:after.get(siteSlug),opportunities:[...after.entries()].filter(([key])=>key.startsWith("qf-idea-")).map(([,card])=>card)}));
  },
});
