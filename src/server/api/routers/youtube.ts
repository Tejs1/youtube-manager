import { extractVideoId } from "@/lib/youtube";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { getMyChannelId, youtubeFetch } from "@/server/google";
import { logEvent } from "@/server/logging";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// Helper function to handle YouTube API errors
function handleYouTubeError(error: unknown): never {
	if (error instanceof Error) {
		const errorMessage = error.message;

		// Check for specific YouTube API errors
		if (
			errorMessage.includes("403") &&
			errorMessage.includes("commentsDisabled")
		) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Comments are disabled for this video",
				cause: error,
			});
		}

		if (errorMessage.includes("403")) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Access denied. Please check your permissions or try signing in again.",
				cause: error,
			});
		}

		if (errorMessage.includes("404")) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Video not found or is private",
				cause: error,
			});
		}

		if (errorMessage.includes("quotaExceeded")) {
			throw new TRPCError({
				code: "TOO_MANY_REQUESTS",
				message: "YouTube API quota exceeded. Please try again later.",
				cause: error,
			});
		}
	}

	// Generic error fallback
	throw new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "An error occurred while communicating with YouTube API",
		cause: error,
	});
}

export const youtubeRouter = createTRPCRouter({
	fetchVideo: protectedProcedure
		.input(z.object({ videoId: z.string().min(3) }))
		.query(async ({ ctx, input }) => {
			try {
				const resolvedId = (() => {
					const extracted = extractVideoId(input.videoId);
					if (extracted) return extracted;
					if (/^https?:\/\//i.test(input.videoId)) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Invalid YouTube URL",
						});
					}
					return input.videoId;
				})();
				const data = await youtubeFetch<{ items: unknown[] }>(
					ctx.session.user.id,
					"/videos",
					{
						query: {
							part: "snippet,statistics,contentDetails,status",
							id: resolvedId,
						},
					},
				);
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "video.fetch",
					videoId: resolvedId,
					status: "success",
				});
				return data.items?.[0] ?? null;
			} catch (error: unknown) {
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "video.fetch",
					videoId: input.videoId,
					status: "error",
					message: String(error instanceof Error ? error.message : error),
				});
				handleYouTubeError(error);
			}
		}),

	listComments: protectedProcedure
		.input(
			z.object({
				videoId: z.string().min(3),
				pageToken: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			try {
				const resolvedId = (() => {
					const extracted = extractVideoId(input.videoId);
					if (extracted) return extracted;
					if (/^https?:\/\//i.test(input.videoId)) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Invalid YouTube URL",
						});
					}
					return input.videoId;
				})();
				const data = await youtubeFetch(
					ctx.session.user.id,
					"/commentThreads",
					{
						query: {
							part: "snippet,replies",
							videoId: resolvedId,
							maxResults: 50,
							textFormat: "plainText",
							order: "time",
							pageToken: input.pageToken,
						},
					},
				);
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "comments.list",
					videoId: resolvedId,
					status: "success",
				});
				return data as unknown;
			} catch (error: unknown) {
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "comments.list",
					videoId: input.videoId,
					status: "error",
					message: String(error instanceof Error ? error.message : error),
				});
				handleYouTubeError(error);
			}
		}),

	addComment: protectedProcedure
		.input(z.object({ videoId: z.string().min(3), text: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			try {
				const resolvedId = (() => {
					const extracted = extractVideoId(input.videoId);
					if (extracted) return extracted;
					if (/^https?:\/\//i.test(input.videoId)) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Invalid YouTube URL",
						});
					}
					return input.videoId;
				})();
				const data = await youtubeFetch(
					ctx.session.user.id,
					"/commentThreads",
					{
						method: "POST",
						query: { part: "snippet" },
						body: {
							snippet: {
								videoId: resolvedId,
								topLevelComment: { snippet: { textOriginal: input.text } },
							},
						},
					},
				);
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "comment.add",
					videoId: resolvedId,
					targetType: "comment",
					status: "success",
					metadata: { text: input.text },
				});
				return data as unknown;
			} catch (error: unknown) {
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "comment.add",
					videoId: input.videoId,
					targetType: "comment",
					status: "error",
					message: String(error instanceof Error ? error.message : error),
				});
				handleYouTubeError(error);
			}
		}),

	replyToComment: protectedProcedure
		.input(z.object({ parentId: z.string().min(3), text: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			try {
				const data = await youtubeFetch(ctx.session.user.id, "/comments", {
					method: "POST",
					query: { part: "snippet" },
					body: {
						snippet: { parentId: input.parentId, textOriginal: input.text },
					},
				});
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "comment.reply",
					targetType: "comment",
					targetId: input.parentId,
					status: "success",
					metadata: { text: input.text },
				});
				return data as unknown;
			} catch (error: unknown) {
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "comment.reply",
					targetType: "comment",
					targetId: input.parentId,
					status: "error",
					message: String(error instanceof Error ? error.message : error),
				});
				handleYouTubeError(error);
			}
		}),

	deleteComment: protectedProcedure
		.input(z.object({ commentId: z.string().min(3) }))
		.mutation(async ({ ctx, input }) => {
			try {
				await youtubeFetch(ctx.session.user.id, "/comments", {
					method: "DELETE",
					query: { id: input.commentId },
				});
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "comment.delete",
					targetType: "comment",
					targetId: input.commentId,
					status: "success",
				});
				return { ok: true };
			} catch (error: unknown) {
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "comment.delete",
					targetType: "comment",
					targetId: input.commentId,
					status: "error",
					message: String(error instanceof Error ? error.message : error),
				});
				handleYouTubeError(error);
			}
		}),

	updateComment: protectedProcedure
		.input(z.object({ commentId: z.string().min(3), text: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			try {
				const data = await youtubeFetch(ctx.session.user.id, "/comments", {
					method: "PUT",
					query: { part: "snippet" },
					body: { id: input.commentId, snippet: { textOriginal: input.text } },
				});
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "comment.update",
					targetType: "comment",
					targetId: input.commentId,
					status: "success",
					metadata: { text: input.text },
				});
				return data as unknown;
			} catch (error: unknown) {
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "comment.update",
					targetType: "comment",
					targetId: input.commentId,
					status: "error",
					message: String(error instanceof Error ? error.message : error),
				});
				handleYouTubeError(error);
			}
		}),

	getMyChannelId: protectedProcedure.query(async ({ ctx }) => {
		try {
			const id = await getMyChannelId(ctx.session.user.id);
			await logEvent(ctx.db, {
				userId: ctx.session.user.id,
				action: "me.channelId",
				status: "success",
			});
			return id;
		} catch (error: unknown) {
			await logEvent(ctx.db, {
				userId: ctx.session.user.id,
				action: "me.channelId",
				status: "error",
				message: String(error instanceof Error ? error.message : error),
			});
			handleYouTubeError(error);
		}
	}),

	updateVideo: protectedProcedure
		.input(
			z.object({
				videoId: z.string().min(3),
				title: z.string().min(1).optional(),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { videoId: rawVideoId, title, description } = input;
			try {
				const videoId = (() => {
					const extracted = extractVideoId(rawVideoId);
					if (extracted) return extracted;
					if (/^https?:\/\//i.test(rawVideoId)) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: "Invalid YouTube URL",
						});
					}
					return rawVideoId;
				})();
				// Get current snippet to preserve required fields like categoryId
				const current = await youtubeFetch<{
					items?: Array<{
						snippet: {
							title?: string;
							description?: string;
							[key: string]: unknown;
						};
					}>;
				}>(ctx.session.user.id, "/videos", {
					query: { part: "snippet", id: videoId },
				});
				const snippet = current?.items?.[0]?.snippet ?? {};
				const payload = {
					id: videoId,
					snippet: {
						...snippet,
						title: title ?? snippet.title,
						description: description ?? snippet.description,
					},
				};
				const data = await youtubeFetch(ctx.session.user.id, "/videos", {
					method: "PUT",
					query: { part: "snippet" },
					body: payload,
				});
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "video.update",
					videoId,
					status: "success",
					metadata: { title, description },
				});
				return data as unknown;
			} catch (error: unknown) {
				await logEvent(ctx.db, {
					userId: ctx.session.user.id,
					action: "video.update",
					videoId: rawVideoId,
					status: "error",
					message: String(error instanceof Error ? error.message : error),
				});
				handleYouTubeError(error);
			}
		}),
});
