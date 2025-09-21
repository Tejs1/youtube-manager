import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { notes } from "@/server/db/schema";
import { logEvent } from "@/server/logging";

export const notesRouter = createTRPCRouter({
	get: protectedProcedure
		.input(z.object({ videoId: z.string().min(3) }))
		.query(async ({ ctx, input }) => {
			const row = await ctx.db
				.select()
				.from(notes)
				.where(
					and(
						eq(notes.userId, ctx.session.user.id),
						eq(notes.videoId, input.videoId),
					),
				)
				.limit(1);
			return row[0] ?? null;
		}),

	upsert: protectedProcedure
		.input(z.object({ videoId: z.string().min(3), content: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db
				.select()
				.from(notes)
				.where(
					and(
						eq(notes.userId, ctx.session.user.id),
						eq(notes.videoId, input.videoId),
					),
				)
				.limit(1);
			if (existing[0]) {
				await ctx.db
					.update(notes)
					.set({ content: input.content })
					.where(
						and(
							eq(notes.userId, ctx.session.user.id),
							eq(notes.videoId, input.videoId),
						),
					);
			} else {
				await ctx.db.insert(notes).values({
					userId: ctx.session.user.id,
					videoId: input.videoId,
					content: input.content,
				});
			}
			await logEvent(ctx.db, {
				userId: ctx.session.user.id,
				action: "note.upsert",
				videoId: input.videoId,
				status: "success",
			});
			return { ok: true };
		}),

	delete: protectedProcedure
		.input(z.object({ videoId: z.string().min(3) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(notes)
				.where(
					and(
						eq(notes.userId, ctx.session.user.id),
						eq(notes.videoId, input.videoId),
					),
				);
			await logEvent(ctx.db, {
				userId: ctx.session.user.id,
				action: "note.delete",
				videoId: input.videoId,
				status: "success",
			});
			return { ok: true };
		}),
});
