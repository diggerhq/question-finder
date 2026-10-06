/** Remove bulky provider histories while retaining the evidence used by this workflow. */
export function compactSeoResult(operation: string,result: Record<string,any>): Record<string,any> {
  if(result.isError||!result.structuredContent)return result;
  const data=result.structuredContent;
  if(operation!=="get_ranked_keywords")return {structuredContent:data,isError:false};
  if(!Array.isArray(data.keywords))throw new Error("Ranked-keyword response has no rows array.");
  const keywords=data.keywords.slice(0,100).map((row:Record<string,any>)=>{
    const keyword=row.keyword_data??{};
    const ranked=row.ranked_serp_element??{};
    const item=ranked.serp_item??{};
    return {keyword:keyword.keyword??row.keyword??null,
      search_volume:keyword.keyword_info?.search_volume??row.search_volume??null,
      url:item.url??row.url??null,
      rank_group:item.rank_group??row.rank_group??null,
      rank_absolute:item.rank_absolute??row.rank_absolute??null,
      type:item.type??row.type??null,
      is_lost:ranked.is_lost??row.is_lost??null,
      last_updated_time:ranked.last_updated_time??row.last_updated_time??null,
      volume_updated_time:keyword.keyword_info?.last_updated_time??null};
  });
  return {structuredContent:{target:data.target,scope:data.scope,totalCount:data.totalCount,meta:data.meta,keywords},isError:false};
}
