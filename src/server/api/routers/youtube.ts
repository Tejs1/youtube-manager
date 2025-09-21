import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { youtubeFetch } from "@/server/google";
import { logEvent } from "@/server/logging";

export const youtubeRouter = createTRPCRouter({
  fetchVideo: protectedProcedure
    .input(z.object({ videoId: z.string().min(3) }))
    .query(async ({ ctx, input }) => {
      try {
        const data = await youtubeFetch<{ items: unknown[] }>(ctx.session.user.id, "/videos", {
          query: {
            part: "snippet,statistics,contentDetails,status",
            id: input.videoId,
          },
        });
        await logEvent(ctx.db, {
          userId: ctx.session.user.id,
          action: "video.fetch",
          videoId: input.videoId,
          status: "success",
        });
        return data.items?.[0] ?? null;
      } catch (err: any) {
        await logEvent(ctx.db, {
          userId: ctx.session.user.id,
          action: "video.fetch",
          videoId: input.videoId,
          status: "error",
          message: String(err?.message ?? err),
        });
        throw err;
      }
    }),

  listComments: protectedProcedure
    .input(z.object({ videoId: z.string().min(3) }))
    .query(async ({ ctx, input }) => {
      try {
        const data = await youtubeFetch(ctx.session.user.id, "/commentThreads", {
          query: {
            part: "snippet,replies",
            videoId: input.videoId,
            maxResults: 50,
            textFormat: "plainText",
            order: "time",
          },
        });
        await logEvent(ctx.db, {
          userId: ctx.session.user.id,
          action: "comments.list",
          videoId: input.videoId,
          status: "success",
        });
        return data as unknown;
      } catch (err: any) {
        await logEvent(ctx.db, {
          userId: ctx.session.user.id,
          action: "comments.list",
          videoId: input.videoId,
          status: "error",
          message: String(err?.message ?? err),
        });
        throw err;
      }
    }),

  addComment: protectedProcedure
    .input(z.object({ videoId: z.string().min(3), text: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await youtubeFetch(ctx.session.user.id, "/commentThreads", {
          method: "POST",
          query: { part: "snippet" },
          body: {
            snippet: {
              videoId: input.videoId,
              topLevelComment: { snippet: { textOriginal: input.text } },
            },
          },
        });
        await logEvent(ctx.db, {
          userId: ctx.session.user.id,
          action: "comment.add",
          videoId: input.videoId,
          targetType: "comment",
          status: "success",
          metadata: { text: input.text },
        });
        return data as unknown;
      } catch (err: any) {
        await logEvent(ctx.db, {
          userId: ctx.session.user.id,
          action: "comment.add",
          videoId: input.videoId,
          targetType: "comment",
          status: "error",
          message: String(err?.message ?? err),
        });
        throw err;
      }
    }),

  replyToComment: protectedProcedure
    .input(z.object({ parentId: z.string().min(3), text: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const data = await youtubeFetch(ctx.session.user.id, "/comments", {
          method: "POST",
          query: { part: "snippet" },
          body: { snippet: { parentId: input.parentId, textOriginal: input.text } },
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
      } catch (err: any) {
        await logEvent(ctx.db, {
          userId: ctx.session.user.id,
          action: "comment.reply",
          targetType: "comment",
          targetId: input.parentId,
          status: "error",
          message: String(err?.message ?? err),
        });
        throw err;
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
      } catch (err: any) {
        await logEvent(ctx.db, {
          userId: ctx.session.user.id,
          action: "comment.delete",
          targetType: "comment",
          targetId: input.commentId,
          status: "error",
          message: String(err?.message ?? err),
        });
        throw err;
      }
    }),

  updateVideo: protectedProcedure
    .input(
      z.object({
        videoId: z.string().min(3),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { videoId, title, description } = input;
      try {
        // Get current snippet to preserve required fields like categoryId
        const current = await youtubeFetch<any>(ctx.session.user.id, "/videos", {
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
      } catch (err: any) {
        await logEvent(ctx.db, {
          userId: ctx.session.user.id,
          action: "video.update",
          videoId,
          status: "error",
          message: String(err?.message ?? err),
        });
        throw err;
      }
    }),
});

