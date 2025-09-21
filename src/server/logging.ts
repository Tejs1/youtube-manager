import type { InferInsertModel } from "drizzle-orm";
import { eventLogs } from "@/server/db/schema";

export async function logEvent(
  db: any,
  e: Partial<InferInsertModel<typeof eventLogs>> & { action: string }
) {
  try {
    await db.insert(eventLogs).values({
      action: e.action,
      userId: e.userId ?? null,
      videoId: e.videoId ?? null,
      targetType: e.targetType ?? null,
      targetId: e.targetId ?? null,
      status: e.status ?? "success",
      message: e.message ?? null,
      metadata: e.metadata ?? null,
    });
  } catch (err) {
    // Swallow logging errors to avoid affecting main flow
    console.error("Failed to log event", err);
  }
}
