export function getCurrentTimeInfo(timezone = "Asia/Shanghai") {
  const now = new Date();

  return {
    source: "system_clock",
    timezone,
    iso: now.toISOString(),
    local: new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "full",
      timeStyle: "medium",
      timeZone: timezone,
    }).format(now),
    timestamp: now.getTime(),
  };
}
