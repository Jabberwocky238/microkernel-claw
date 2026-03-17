export const DEFAULT_AGENT_ALLOWED_CAPABILITIES = [
  "echo.ping",
  "cron.add",
  "cron.delete",
  "cron.list",
  "terminals.start",
  "terminals.list",
  "terminals.tail",
  "terminals.kill",
  "terminals.exec",
  "channel.status",
  "channel.send_message",
  "channel.pull_messages",
  "apply_patch.apply",
  "agent.spawn",
] as const;

export const DEFAULT_SUBAGENT_ALLOWED_CAPABILITIES = [
  "echo.ping",
  "cron.list",
  "channel.status",
  "channel.pull_messages",
] as const;
