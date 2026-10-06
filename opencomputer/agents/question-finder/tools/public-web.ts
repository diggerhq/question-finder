import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],
  ["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],
  ["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],
  ["224.0.0.0",4],["240.0.0.0",4],
] as const) blocked.addSubnet(network, prefix, "ipv4");
// Permit globally routable IPv6 unicast only, and exclude documentation/transition space.
const globalV6 = new BlockList();
globalV6.addSubnet("2000::",3,"ipv6");
for (const [network,prefix] of [["2001::",32],["2001:db8::",32],["2002::",16]] as const)
  blocked.addSubnet(network,prefix,"ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family === 6) return globalV6.check(address,"ipv6") && !blocked.check(address,"ipv6");
  return false;
}

export function publicUrl(value: string): URL {
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443"))
    throw new Error("Use a public HTTPS URL on port 443 without embedded credentials.");
  if (!host.includes(".") || host === "localhost" || /\.(localhost|local|internal|test|invalid)$/.test(host)
    || (isIP(host) && !isPublicAddress(host))) throw new Error("Private and local websites are not supported.");
  url.hash = "";
  return url;
}

export async function readPublicUrl(value: string, signal?: AbortSignal, redirects = 0): Promise<{ url: string; status: number; contentType: string; text: string }> {
  const url = publicUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address)))
    throw new Error("Website resolves to a private or reserved address.");
  const resolved = addresses[0];
  const combinedSignal = signal ? AbortSignal.any([signal,AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000);
  const response = await new Promise<{ status: number; contentType: string; location?: string; text: string }>((resolve,reject) => {
    const req = request(url, {
      signal: combinedSignal,
      headers: { "User-Agent": "QuestionFinder/0.1 (+https://opencomputer.dev)", Accept: "text/html,application/xml,text/xml,text/plain", "Accept-Encoding": "identity" },
      // Pin the validated address: the socket cannot re-resolve to a private host.
      lookup: (_name, options, callback) => {
        if (typeof options === "object" && options.all) callback(null,[resolved]);
        else callback(null,resolved.address,resolved.family);
      },
    }, res => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume(); resolve({ status,contentType:"",location:res.headers.location,text:"" }); return;
      }
      const contentType = String(res.headers["content-type"] ?? "");
      if (!/text\/|xml|json/.test(contentType)) { res.resume(); reject(new Error("Unsupported website content type.")); return; }
      const chunks: Buffer[] = []; let bytes = 0;
      res.on("data", chunk => {
        bytes += chunk.length;
        if (bytes > 750000) { req.destroy(new Error("Page exceeds 750 KB fetch limit.")); return; }
        chunks.push(Buffer.from(chunk));
      });
      res.on("error",reject);
      res.on("end",()=>resolve({status,contentType,text:Buffer.concat(chunks).toString("utf8")}));
    });
    req.on("error",reject); req.end();
  });
  if (response.location) {
    if (redirects >= 3) throw new Error("Too many website redirects.");
    return readPublicUrl(new URL(response.location,url).href,signal,redirects+1);
  }
  if (response.status >= 300 && response.status < 400) throw new Error("Redirect did not supply a destination.");
  return {url:url.href,status:response.status,contentType:response.contentType,text:response.text};
}

export function cleanText(html: string): string {
  return html.replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi," ")
    .replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&nbsp;/g," ")
    .replace(/\s+/g," ").trim();
}

export function summarizeHtml(html: string) {
  return {
    title: cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0,200),
    headings: [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)].slice(0,25).map(m=>cleanText(m[1]).slice(0,240)),
    text: cleanText(html).slice(0,6500),
  };
}

export function sitemapLocations(xml: string, base: URL): string[] {
  return [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)].map(m=>m[1].trim().replace(/&amp;/g,"&"))
    .filter(value=>{try { return publicUrl(value).origin === base.origin; } catch { return false; }})
    .filter((value,index,all)=>all.indexOf(value)===index).slice(0,100);
}
