import { defineTool } from "@opencomputer/agent";
import { proveBriefs, readEvidence } from "./evidence.js";
import { validateBriefs } from "./briefs.js";

const inputSchema = {
  type:"object",
  properties:{
    siteUrl:{type:"string"},status:{type:"string",enum:["complete","partial","blocked"]},
    summary:{type:"string"},limitations:{type:"array",items:{type:"string"},maxItems:8},
    opportunities:{type:"array",maxItems:5,items:{type:"object",additionalProperties:false,properties:{
      query:{type:"string"},question:{type:"string"},action:{type:"string",enum:["create","improve"]},
      volume:{type:["integer","null"]},competitorDomain:{type:"string"},competitorUrl:{type:"string"},
      competitorRank:{type:["integer","null"]},evidenceType:{type:"string",enum:["indexed_rank","live_serp"]},
      existingUrl:{type:["string","null"]},confidence:{type:"string",enum:["low","medium","high"]},
      ownRanking:{type:"string",enum:["not_checked","not_in_sample","present","not_in_live_top20"]},
      reason:{type:"string"},coverage:{type:"string"},outline:{type:"array",items:{type:"string"},minItems:2,maxItems:5},
    },required:["query","question","action","volume","competitorDomain","competitorUrl","competitorRank","evidenceType","existingUrl","confidence","ownRanking","reason","coverage","outline"]}},
  },required:["siteUrl","status","summary","limitations","opportunities"],additionalProperties:false,
} as const;

// Kept as a literal so the deployment compiler can extract the result contract.
const outputSchema = {
  type:"object",additionalProperties:false,
  properties:{
    siteUrl:{type:"string"},domain:{type:"string"},status:{type:"string",enum:["complete","partial","blocked"]},
    summary:{type:"string"},limitations:{type:"array",items:{type:"string"}},
    sessionId:{type:"string"},generatedAt:{type:"string"},
    opportunities:{type:"array",maxItems:5,items:{type:"object",additionalProperties:false,properties:{
      rankBasis:{type:"string",enum:["organic","serp_absolute"]},observedAt:{type:["string","null"]},volumeObservedAt:{type:["string","null"]},
      id:{type:"string"},query:{type:"string"},question:{type:"string"},action:{type:"string",enum:["create","improve"]},
      volume:{type:["integer","null"]},competitorDomain:{type:"string"},competitorUrl:{type:"string"},
      competitorRank:{type:["integer","null"]},evidenceType:{type:"string",enum:["indexed_rank","live_serp"]},
      existingUrl:{type:["string","null"]},confidence:{type:"string",enum:["low","medium","high"]},
      ownRanking:{type:"string",enum:["not_checked","not_in_sample","present","not_in_live_top20"]},
      reason:{type:"string"},coverage:{type:"string"},outline:{type:"array",items:{type:"string"}},
    },required:["rankBasis","observedAt","volumeObservedAt","id","query","question","action","volume","competitorDomain","competitorUrl","competitorRank","evidenceType","existingUrl","confidence","ownRanking","reason","coverage","outline"]}},
  },required:["siteUrl","domain","status","summary","limitations","opportunities","sessionId","generatedAt"],
} as const;

export const publishBriefs=defineTool({
  name:"publish_briefs",
  description:"Validate and commit the final structured content queue to this private session. Does not publish publicly or save database rows; save state before calling. Unknown metrics must be null.",
  input:inputSchema,output:outputSchema,result:true,
  async run({input,sessionId}) {return proveBriefs(validateBriefs(input,sessionId),await readEvidence(sessionId));},
});
