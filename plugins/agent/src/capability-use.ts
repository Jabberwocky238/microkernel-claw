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
  "web_search.search",
  "channel.status",
  "channel.send_message",
  "channel.pull_messages",
  "agent.spawn",
] as const;

export const DEFAULT_SUBAGENT_ALLOWED_CAPABILITIES = [
  "echo.ping",
  "cron.list",
  "filesystem.read_file",
  "filesystem.list_dir",
  "filesystem.inspect_file",
  "web_search.search",
  "channel.status",
  "channel.pull_messages",
] as const;
