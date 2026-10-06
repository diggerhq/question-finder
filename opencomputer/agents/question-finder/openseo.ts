import { bearer, defineConnection, useSecret } from "@opencomputer/agent";

export const openseoConnection = defineConnection({
  id: "openseo-auth",
  origin: "https://app.openseo.so",
  pathPrefix: "/mcp",
  headers: { Authorization: bearer(useSecret("OPENSEO_API_KEY")) },
});
