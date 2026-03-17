function includesStackedSeparator(command: string): boolean {
  return /(\&\&|\|\||;|\n|\r)/.test(command);
}

function startsNestedShell(command: string): boolean {
  const normalized = command.trim().toLowerCase();

  return /^(bash|sh|zsh|pwsh|powershell|powershell\.exe)\b/.test(normalized);
}

export function assertSingleCommand(command: string): void {
  if (typeof command !== "string" || command.trim().length === 0) {
    throw new TypeError("command must be a non-empty string.");
  }

  if (includesStackedSeparator(command)) {
    throw new Error("Only a single command is allowed. Command chaining with &&, ||, ; or newlines is not permitted.");
  }

  if (startsNestedShell(command)) {
    throw new Error("Do not wrap commands with bash/sh/zsh/pwsh/powershell. Provide a single direct command only.");
  }
}
