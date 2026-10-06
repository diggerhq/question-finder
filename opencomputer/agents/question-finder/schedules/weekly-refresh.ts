import { defineSchedule } from "@opencomputer/agent";

export default defineSchedule({
  id: "weekly-refresh",
  cron: "0 9 * * 1",
  timezone: "America/Los_Angeles",
  enabled: ["production"],
  overlap: "skip",
  dispatch: {
    text: "Refresh opted-in sites. Reuse competitors and avoid previous suggestions.",
    payload: { mode: "weekly-refresh", maxSites: 3 },
  },
});
