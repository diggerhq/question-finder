---
name: question-to-content
description: Discover search competitors, turn relevant ranking queries into question briefs, and maintain a weekly content queue for a supplied website. Use for research, refreshes, and backlog actions.
---

# Question to content

## Resolve the site and request

1. Accept a public HTTPS URL from text or payload.url. Optional payload: audience, competitors (at most 3 bare domains), locationCode (default 2840), languageCode (default en). For plain text infer the URL; never infer metrics.
2. On a backlog/status/monitoring request, use the supplied domain or list saved sites and ask if ambiguous. Do not buy research for these actions. Shared project access is the trust boundary; this is not a public multi-tenant service.
3. inspect_website reads the homepage and bounded sitemap pages. Use actual content to identify product, customer, and 3–5 nonbranded seed queries. An optional audience refines relevance; do not require a long interview.
4. List OpenSEO projects and match the canonical domain, including www variants. If none matches, create one only for the requested site. Record its actual project ID. Read get_project_context before paid work and reuse research from this agent's own recent run when its parameters match. Never use another site's project just to get a project ID.
5. Call queue_state(action=load, projectId, siteUrl) to read saved configuration and all previous cards, including dismissed, approved and published. New sites default to monitoring off. Persist user-provided audience, market and URL in save_run; label inferred audience separately.

## Discovery and research

6. Use provided competitors if present. Otherwise reuse saved competitors. For first discovery call find_serp_competitors with 3–5 relevant seeds, organic results only, the target domain excluded, limit 10. Read homepages of at most 5 contenders; retain up to 3 sites with real business/content overlap. Generic platforms, dictionaries, irrelevant firms and the site's own subdomains should not become competitors. Label search competitors separately from direct business rivals. Store the chosen domains and explain why briefly. Rediscover only on explicit request or after 30 days.
7. Fetch get_ranked_keywords once per retained competitor and once for the user's site: scope subdomains, US/en or saved market, organic only, maxRank 20, limit 100, sortBy search_volume. Exclude each competitor's own brand tokens. No paid pagination or keyword expansion in the MVP. Never retry paid lookups to fix output truncation; report the integration failure.
8. Normalize returned data. The gateway returns compact rows: keyword, search_volume, url, rank_group, rank_absolute, type, is_lost, last_updated_time and volume_updated_time. Raw provider rows may have keyword_data.keyword, keyword_data.keyword_info.search_volume, ranked_serp_element.serp_item.url, rank_group (organic position), and ranked_serp_element.last_updated_time. rank_absolute includes other SERP elements: do not substitute it for organic position silently. Check for is_lost and discard lost observations. Preserve query, URL, metric date, market, parameters and whether ranks are indexed or live in the stored brief.
9. Extract literal questions AND relevant informational noun phrases. Propose natural question titles from seed queries but keep the exact measured seed separate. Merge close variants into one brief; do not sum shared volume. Exclude branded navigation, unrelated high-volume queries, general terminology without a credible product path, and existing approved/dismissed/published ideas. Missing from top-100 data is only not_in_sample. Insufficient credits: stop paid work immediately and mark partial/blocked; do not keep retrying or claim a verified gap.
10. Check sitemap URLs and returned content for overlap. Fetch at most 5 additional existing/source pages to resolve finalists. A missing sitemap title does not prove no content exists. Use improve when a relevant existing page answers the intent; new create candidates require a bounded coverage check recorded in coverage.
11. Validate up to 5 finalists in ONE get_serp_results call at depth 20, matching market. Record actual URLs and positions. get_serp_results rank is an absolute row position (AI overview/PAA rows count), not rank_group. Never borrow an indexed rank or a different query's SERP position and label it live. Absence means not_in_live_top20, not 'does not rank anywhere'. Inspect competitor sources when worthwhile; do not treat indexed observations as today's live ranks. If validation fails, keep indexed evidence clearly labeled and lower confidence.

## Save and deliver

12. Return at most 5 cards; fewer or zero are valid. Each card: exact query, question title, create/improve, estimated query volume or null, competitor domain and URL, organic position or null, indexed_rank/live_serp, existing own URL or null, own-ranking observation, confidence, relevance reason, bounded coverage statement, and 2–5 outline bullets. Do not assert win probability or predicted traffic without evidence.
13. Call queue_state(action=save_run, projectId, siteUrl, result, audience when supplied, competitors, locationCode, languageCode) with the same input as publish_briefs. The tool validates cards, computes deterministic IDs, and preserves previous review statuses and first-seen session IDs. Only this agent's private qf-* custom sections are touched. State is shared across Development and Production because it lives in the same OpenSEO account. Read before changes and do not run simultaneous research/review sessions for the same site; provider context patches are not a database transaction.
14. queue_state(save_run) automatically creates/replaces a private report from the validated cards. It returns reportUrl or reportError. Do not generate HTML or call save_report directly. Include the returned URL in your final message. If reportError occurs, the cards are still saved: disclose the report error and finish with a partial result.
15. The state tool records latest attempt, success, summary and limitations. Save the run before publish_briefs; if saving fails, report partial and the failure explicitly. Finish with publish_briefs and a short queue with IDs, sources and exact limitations. Suggest approve/dismiss and enable weekly.

## Queue actions

- show backlog: queue_state(action=load) for the matching project/site. No new research.
- approve/dismiss: queue_state(action=review, ideaId, status) scoped to the matching project/site. Verify returned saved status.
- published: verify the supplied URL is accessible, then queue_state(action=review, status=published, publishedUrl). Publication itself happens outside this agent.
- enable/pause weekly: queue_state(action=monitor, enabled=true/false) for a saved site. Explain Monday 09:00 America/Los_Angeles, maximum three monitored sites per run. Never enable automatically.
- draft: write from an approved brief with cited facts. Unknown implementation details must be verified from product docs; output a draft in the session, never publish it.

## Scheduled runs

Call queue_state(action=due) for at most three monitored sites ordered by oldest attempt. Discovery scans at most 20 OpenSEO projects; report a limited scan if flagged. Process sequentially and read prior cards first. Record each site separately. Stop all paid work if credits are exhausted; mark remaining due sites blocked so users see the limitation. Leave competitor choices and monitoring preferences intact. There is nobody to answer questions during a schedule: use saved configuration, report missing requirements, and finish. No email/Slack delivery is configured; outcomes live in Sessions and private OpenSEO project context/reports.

## OpenSEO argument reference

All calls use openseo_call(operation, arguments). The tool returns MCP content and structuredContent; inspect isError before using evidence.

- list_projects: {}. structuredContent.projects contains id, domain, default locationCode/languageCode.
- get_project_context and list_reports: {projectId}. get_report: {projectId, reportId}.
- create_project: {name, domain, locationCode, languageCode}; if multiple organizations require a choice, ask in an interactive run, stop in a scheduled run.
- get_ranked_keywords: {projectId,target: bare domain,scope:"subdomains",locationCode:2840,languageCode:"en",limit:100,maxRank:20,resultTypes:["organic"],sortBy:"search_volume",excludeBrandTerms:[brand]}. structuredContent.keywords contains raw rows.
- find_serp_competitors: {projectId,keywords:[seed strings],excludeDomains:[own domain],includeSubdomains:true,locationCode:2840,languageCode:"en",limit:10,resultTypes:["organic"],sortBy:"visibility"}.
- get_serp_results: {projectId,depth:20,queries:[{keyword:exact query,locationCode:2840,languageCode:"en"}]}. structuredContent.results entries have keyword, ok, items or error; per-query failure does not fail the whole batch.


Use saved/project market instead of 2840/en when supplied. Do not treat historical context summaries as newly fetched provider evidence. Historical candidate seeds may be reused only with their original date, limitations and lower confidence.
