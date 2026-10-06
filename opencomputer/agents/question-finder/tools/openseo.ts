import { defineTool } from "@opencomputer/agent";
import { rememberEvidence } from "./evidence.js";
import { compactSeoResult } from "./normalize-seo.js";
import { openseoConnection } from "../openseo.js";

const allowed=["list_projects","get_project_context","get_ranked_keywords","find_serp_competitors","get_serp_results","create_project","list_reports","get_report"];

function parseRpc(body: string): Record<string,unknown> {
  try {return JSON.parse(body);} catch {
    for(const line of body.split(/\r?\n/)) {
      if(line.startsWith("data:")) {
        try {const value=JSON.parse(line.slice(5).trim());if(value.result!==undefined||value.error!==undefined)return value;} catch { /* other event */ }
      }
    }
    throw new Error("OpenSEO returned an unreadable MCP response.");
  }
}

export const openseoCall=defineTool({
  name:"openseo_call",
  description:"Call a supported OpenSEO MCP operation through managed authorization. Allowed operations are listed in the schema. Use list_projects first to resolve the requested site's project. Arguments follow OpenSEO's documented tool schemas; never send secrets. Authentication and credit errors stop further research.",
  input:{type:"object",properties:{operation:{type:"string",enum:allowed},arguments:{type:"object",additionalProperties:true}},required:["operation","arguments"],additionalProperties:false},
  async run({input,signal,toolCallId,sessionId}) {
    const operation=String(input.operation);
    if(!allowed.includes(operation))throw new Error("Unsupported OpenSEO operation.");
    const args=input.arguments as Record<string,unknown>;
    if(!args || typeof args!=="object" || Array.isArray(args)) throw new Error("Provide an arguments object.");
    if(operation==="get_ranked_keywords") {
      args.limit=Math.min(Number(args.limit??100),100);args.offset=0;args.maxRank=20;args.resultTypes=["organic"];
    }
    if(operation==="find_serp_competitors") {
      if(!Array.isArray(args.keywords)||args.keywords.length>5)throw new Error("Use at most five discovery keywords.");
      args.limit=10;args.offset=0;args.resultTypes=["organic"];
    }
    if(operation==="get_serp_results") {
      if(!Array.isArray(args.queries)||args.queries.length>5)throw new Error("Use at most five finalist queries.");
      args.depth=20;
    }
    const result=compactSeoResult(operation,await callOpenSeo(operation,args,toolCallId,signal));
    if(!result.isError && result.structuredContent && ["get_ranked_keywords","get_serp_results"].includes(operation))await rememberEvidence(sessionId,toolCallId,{operation,arguments:args,data:result.structuredContent,fetchedAt:new Date().toISOString()});
    return result;
  },
});

export async function callOpenSeo(operation: string,args: Record<string,unknown>,toolCallId: string,signal?: AbortSignal): Promise<Record<string,any>> {
    const response=await openseoConnection.fetch("/mcp",{
      method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream","MCP-Protocol-Version":"2025-03-26"},
      body:JSON.stringify({jsonrpc:"2.0",id:toolCallId,method:"tools/call",params:{name:operation,arguments:args}}),
      signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000),
    });
    if(!response.ok)throw new Error(`OpenSEO MCP HTTP ${response.status}. ${response.status===401?"Check the managed OPENSEO_API_KEY secret.":"Research unavailable."}`);
    const envelope=parseRpc(await response.text());
    if(envelope.error)throw new Error("OpenSEO MCP error: "+JSON.stringify(envelope.error));
    const result=envelope.result as Record<string,unknown>;
    if(!result)throw new Error("OpenSEO MCP result missing.");
    return JSON.parse(JSON.stringify(result));
}
