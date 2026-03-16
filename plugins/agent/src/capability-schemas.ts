import { z } from "zod";

export const emptyObjectSchema = z.object({}).strict();

export const channelStartOutputSchema = z.object({
  started: z.boolean(),
}).strict();

export const channelStopOutputSchema = z.object({
  stopped: z.boolean(),
}).strict();

export const channelStatusOutputSchema = z.object({
  channel: z.string(),
  enabled: z.boolean(),
  started: z.boolean(),
  queueSize: z.int(),
}).passthrough();

export const channelSendMessageInputSchema = z.object({
  to: z.string().min(1),
  text: z.string(),
}).strict();

export const channelSendMessageOutputSchema = z.object({
  channel: z.string(),
  to: z.string(),
  sent: z.boolean(),
}).strict();

export const channelPullMessagesInputSchema = z.object({
  limit: z.int().optional(),
}).strict();

export const channelMessageSchema = z.object({
  channel: z.string(),
  id: z.string(),
  senderId: z.string(),
  chatId: z.string(),
  content: z.string(),
  timestamp: z.string(),
  media: z.array(z.string()),
  metadata: z.object({}).catchall(z.unknown()),
}).strict();

export const channelPullMessagesOutputSchema = z.array(channelMessageSchema);
