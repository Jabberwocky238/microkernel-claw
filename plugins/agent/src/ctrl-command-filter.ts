import type { AgentSessionStore } from "./session-store.js";

export interface CtrlCommandContext {
  sessionId: string;
  sessionStore: AgentSessionStore;
}

export interface CtrlCommandResult {
  handled: boolean;
  message?: string;
}

export class CtrlCommandFilter {
  public async handle(
    input: string,
    context: CtrlCommandContext,
  ): Promise<CtrlCommandResult> {
    const command = input.trim();

    if (command === "/clear") {
      await context.sessionStore.clear(context.sessionId);
      return {
        handled: true,
        message: "Session cleared.",
      };
    }

    if (command === "/status") {
      const session = await context.sessionStore.getOrCreate(context.sessionId);
      return {
        handled: true,
        message: [
          `sessionId: ${session.key}`,
          `messages: ${session.messages.length}`,
          `contextSize: ${session.messages.reduce((acc, msg) => acc + JSON.stringify(msg).length, 0) / 1024} KB`,
          `createdAt: ${session.createdAt.toISOString()}`,
          `updatedAt: ${session.updatedAt.toISOString()}`,
          `lastConsolidated: ${session.lastConsolidated}`,
        ].join("\n"),
      };
    }

    return {
      handled: false,
    };
  }
}
