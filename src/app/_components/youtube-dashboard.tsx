"use client";

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SimpleThemeToggle } from "@/components/simple-theme-toggle";
import { extractVideoId, buildEmbedUrl, buildThumbnailUrl } from "@/lib/youtube";
import Link from "next/link";
import { Trash2, AlertCircle, MessageSquareOff } from "lucide-react";

type Video = {
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
  };
  statistics?: {
    viewCount?: string;
    commentCount?: string;
    likeCount?: string;
  };
};

type Comment = {
  id?: string;
  snippet?: {
    authorDisplayName?: string;
    authorChannelId?: { value?: string };
    textDisplay?: string;
    textOriginal?: string;
    publishedAt?: string;
  };
};

type CommentThread = {
  id?: string;
  snippet?: {
    topLevelComment?: Comment;
  };
  replies?: {
    comments?: Comment[];
  };
};

export function YouTubeDashboard({ signedIn }: { signedIn: boolean }) {
  const [videoId, setVideoId] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [noteText, setNoteText] = useState("");
  const [commentsPageToken, setCommentsPageToken] = useState<string | undefined>(
    undefined,
  );
  const [prevCommentTokens, setPrevCommentTokens] = useState<string[]>([]);
  const [playerLoaded, setPlayerLoaded] = useState(false);

  const videoQuery = api.youtube.fetchVideo.useQuery(
    { videoId },
    { enabled: !!videoId && signedIn },
  );
  const commentsQuery = api.youtube.listComments.useQuery(
    { videoId, pageToken: commentsPageToken },
    { enabled: !!videoId && signedIn },
  );
  const noteQuery = api.notes.get.useQuery(
    { videoId },
    { enabled: !!videoId && signedIn },
  );
  const myChannelQuery = api.youtube.getMyChannelId.useQuery(undefined, {
    enabled: signedIn,
  });

  const updateVideo = api.youtube.updateVideo.useMutation({
    onSuccess: () => {
      void videoQuery.refetch();
      setEditOpen(false);
    },
  });
  const addComment = api.youtube.addComment.useMutation({
    onSuccess: () => void commentsQuery.refetch(),
  });
  const replyToComment = api.youtube.replyToComment.useMutation({
    onSuccess: () => void commentsQuery.refetch(),
  });
  const deleteComment = api.youtube.deleteComment.useMutation({
    onSuccess: () => void commentsQuery.refetch(),
  });
  const updateComment = api.youtube.updateComment.useMutation({
    onSuccess: () => void commentsQuery.refetch(),
  });
  const upsertNote = api.notes.upsert.useMutation();

  const video = videoQuery.data as Video | null;
  const threads = (commentsQuery.data as { items?: CommentThread[] })?.items ?? [];
  const myChannelId = (myChannelQuery.data as string | null) ?? null;
  const isOwner = !!(video?.snippet?.channelId && myChannelId && video?.snippet?.channelId === myChannelId);

  useEffect(() => {
    setNoteText((noteQuery.data as { content?: string })?.content ?? "");
  }, [noteQuery.data]);

  // Reset UI state when video changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Effect intentionally runs when videoId changes to reset state
  useEffect(() => {
    setCommentsPageToken(undefined);
    setPrevCommentTokens(() => []);
    setPlayerLoaded(false);
  }, [videoId]);

  // Helper function to get user-friendly error message
  const getErrorMessage = (error: unknown): string => {
    if (!error) return "An unexpected error occurred";

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message: string }).message;

      if (message.includes("Comments are disabled")) {
        return "Comments are disabled for this video";
      }
      if (message.includes("Access denied")) {
        return "Access denied. Please check your permissions or try signing in again.";
      }
      if (message.includes("Video not found")) {
        return "Video not found or is private";
      }
      if (message.includes("quota")) {
        return "YouTube API quota exceeded. Please try again later.";
      }

      return message;
    }

    return String(error);
  };

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-semibold text-2xl">YouTube Companion Dashboard</h1>
        <div className="flex items-center gap-2">
          <SimpleThemeToggle />
          {!signedIn ? (
            <Link href="/api/auth/signin">
              <Button variant="default">Sign in with Google</Button>
            </Link>
          ) : (
            <Link href="/api/auth/signout">
              <Button variant="secondary">Sign out</Button>
            </Link>
          )}
        </div>
      </div>

      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="videoId" className="mb-1 block font-medium text-sm">
              Video ID or URL
            </label>
            <Input
              id="videoId"
              placeholder="e.g. dQw4w9WgXcQ or https://youtu.be/dQw4w9WgXcQ"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value.trim())}
            />
          </div>
          <Button
            className="mt-3 sm:mt-6"
            onClick={() => {
              if (videoId) {
                void videoQuery.refetch();
                void commentsQuery.refetch();
                void noteQuery.refetch();
              }
            }}
          >
            Load
          </Button>
        </div>
      </Card>

      {videoQuery.error && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {getErrorMessage(videoQuery.error)}
          </AlertDescription>
        </Alert>
      )}

      {videoQuery.isLoading && (
        <Card className="mb-6 p-4">
          <div className="text-muted-foreground text-sm">Loading video...</div>
        </Card>
      )}

      {video && (
        <Card className="mb-6 p-4">
          <div className="flex flex-col gap-4">
            {(() => {
              const vid = ((video as unknown as { id?: string })?.id) || extractVideoId(videoId) || videoId;
              return vid ? (
                <div className="w-full">
                  <div className="w-full overflow-hidden rounded-md border">
                    <iframe
                      key={vid}
                      className="aspect-video w-full"
                      src={buildEmbedUrl(vid)}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      onLoad={() => setPlayerLoaded(true)}
                    />
                  </div>
                  {!playerLoaded && (
                    <div className="mt-3">
                      <img
                        src={buildThumbnailUrl(vid, "hq")}
                        alt="Video thumbnail"
                        className="h-auto w-full max-w-md rounded-md border"
                      />
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-xl">
                  {video?.snippet?.title ?? "Untitled"}
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground text-sm">
                  {video?.snippet?.description ?? ""}
                </p>
                <div className="mt-3 text-muted-foreground text-sm">
                  <span>Views: {video?.statistics?.viewCount ?? "-"}</span>
                  <span className="ml-4">
                    Comments: {video?.statistics?.commentCount ?? "-"}
                  </span>
                  <span className="ml-4">
                    Likes: {video?.statistics?.likeCount ?? "-"}
                  </span>
                </div>
              </div>
              {signedIn && (
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button>Edit</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Video</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Input
                        placeholder="Title"
                        defaultValue={video?.snippet?.title ?? ""}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                      <Textarea
                        placeholder="Description"
                        defaultValue={video?.snippet?.description ?? ""}
                        onChange={(e) => setDescription(e.target.value)}
                        className="min-h-40"
                      />
                      {updateVideo.error && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {getErrorMessage(updateVideo.error)}
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() =>
                            updateVideo.mutate({
                              videoId,
                              title: title || undefined,
                              description: description || undefined,
                            })
                          }
                          disabled={updateVideo.isPending}
                        >
                          {updateVideo.isPending ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </Card>
      )}

      {signedIn && !!videoId && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-3 font-medium text-lg">Comments</h3>

            {commentsQuery.error && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center gap-2">
                  {commentsQuery.error.message.includes("Comments are disabled") && (
                    <MessageSquareOff className="h-4 w-4" />
                  )}
                  {getErrorMessage(commentsQuery.error)}
                </AlertDescription>
              </Alert>
            )}

            {!commentsQuery.error && (
              <>
                <AddComment
                  onAdd={(text) => addComment.mutate({ videoId, text })}
                  disabled={addComment.isPending}
                />

                {addComment.error && (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {getErrorMessage(addComment.error)}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="mt-4 space-y-4">
                  {threads.map((t, idx) => (
                    <div key={t?.id ?? idx} className="rounded-md border p-3">
                      <div className="text-sm">
                        <span className="font-medium">
                          {t?.snippet?.topLevelComment?.snippet?.authorDisplayName}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          {t?.snippet?.topLevelComment?.snippet?.publishedAt?.slice(
                            0,
                            10,
                          )}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">
                        {t?.snippet?.topLevelComment?.snippet?.textDisplay ??
                          t?.snippet?.topLevelComment?.snippet?.textOriginal}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(() => {
                          const authorId = t?.snippet?.topLevelComment?.snippet?.authorChannelId?.value;
                          const canEdit = !!(authorId && myChannelId && authorId === myChannelId);
                          const canDelete = !!(isOwner || canEdit);
                          return (
                            <>
                              {canEdit && (
                                <EditBox
                                  initialText={
                                    t?.snippet?.topLevelComment?.snippet?.textOriginal ?? ""
                                  }
                                  onSave={(text) =>
                                    updateComment.mutate({
                                      commentId: t?.snippet?.topLevelComment?.id ?? "",
                                      text,
                                    })
                                  }
                                  disabled={updateComment.isPending}
                                />
                              )}
                              <ReplyBox
                                onReply={(text) =>
                                  replyToComment.mutate({
                                    parentId: t?.snippet?.topLevelComment?.id ?? "",
                                    text,
                                  })
                                }
                                disabled={replyToComment.isPending}
                              />
                              {canDelete && (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() =>
                                    deleteComment.mutate({
                                      commentId: t?.snippet?.topLevelComment?.id ?? "",
                                    })
                                  }
                                  disabled={deleteComment.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {replyToComment.error && (
                        <Alert className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {getErrorMessage(replyToComment.error)}
                          </AlertDescription>
                        </Alert>
                      )}

                      {updateComment.error && (
                        <Alert className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {getErrorMessage(updateComment.error)}
                          </AlertDescription>
                        </Alert>
                      )}

                      {deleteComment.error && (
                        <Alert className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {getErrorMessage(deleteComment.error)}
                          </AlertDescription>
                        </Alert>
                      )}

                      {t?.replies?.comments?.length ? (
                        <div className="mt-3 border-t pt-2">
                          {t.replies.comments.map((c) => {
                            const authorId = c?.snippet?.authorChannelId?.value;
                            const canEdit = !!(authorId && myChannelId && authorId === myChannelId);
                            const canDelete = !!(isOwner || canEdit);
                            return (
                              <div key={c.id} className="mt-2 text-sm">
                                <span className="font-medium">
                                  {c?.snippet?.authorDisplayName}
                                </span>
                                <p className="whitespace-pre-wrap">
                                  {c?.snippet?.textDisplay ?? c?.snippet?.textOriginal}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {canEdit && (
                                    <EditBox
                                      initialText={c?.snippet?.textOriginal ?? ""}
                                      onSave={(text) =>
                                        updateComment.mutate({
                                          commentId: c?.id ?? "",
                                          text,
                                        })
                                      }
                                      disabled={updateComment.isPending}
                                    />
                                  )}
                                  {canDelete && (
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      onClick={() =>
                                        deleteComment.mutate({ commentId: c?.id ?? "" })
                                      }
                                      disabled={deleteComment.isPending}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!threads.length && !commentsQuery.isLoading && (
                    <div className="text-muted-foreground text-sm">
                      No comments found.
                    </div>
                  )}
                  {commentsQuery.isLoading && (
                    <div className="text-muted-foreground text-sm">
                      Loading comments...
                    </div>
                  )}
                  {(() => {
                    const nextToken = (commentsQuery.data as { nextPageToken?: string })?.nextPageToken;
                    return (
                      <div className="mt-4 flex items-center justify-between">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (prevCommentTokens.length) {
                              const copy = [...prevCommentTokens];
                              const prev = copy.pop();
                              setPrevCommentTokens(copy);
                              setCommentsPageToken(prev?.length ? prev : undefined);
                            }
                          }}
                          disabled={!prevCommentTokens.length || commentsQuery.isLoading}
                        >
                          Previous
                        </Button>
                        <Button
                          onClick={() => {
                            if (nextToken) {
                              setPrevCommentTokens([
                                ...prevCommentTokens,
                                commentsPageToken ?? "",
                              ]);
                              setCommentsPageToken(nextToken);
                            }
                          }}
                          disabled={!nextToken || commentsQuery.isLoading}
                        >
                          Next
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-medium text-lg">Notes</h3>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ideas for improving the video..."
              className="min-h-60"
            />
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() =>
                  upsertNote.mutate({ videoId, content: noteText })
                }
              >
                Save Notes
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setNoteText("");
                  upsertNote.mutate({ videoId, content: "" });
                }}
              >
                Clear
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function AddComment({ onAdd, disabled }: { onAdd: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        placeholder="Write a comment..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />
      <Button
        onClick={() => {
          if (text.trim()) {
            onAdd(text.trim());
            setText("");
          }
        }}
        disabled={disabled || !text.trim()}
      >
        Comment
      </Button>
    </div>
  );
}

function ReplyBox({ onReply, disabled }: { onReply: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        placeholder="Reply..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />
      <Button
        variant="secondary"
        onClick={() => {
          if (text.trim()) {
            onReply(text.trim());
            setText("");
          }
        }}
        disabled={disabled || !text.trim()}
      >
        Reply
      </Button>
    </div>
  );
}

function EditBox({ initialText, onSave, disabled }: { initialText: string; onSave: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState(initialText);
  useEffect(() => setText(initialText), [initialText]);
  return (
    <div className="flex gap-2">
      <Input
        placeholder="Edit comment..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />
      <Button
        onClick={() => {
          if (text.trim()) onSave(text.trim());
        }}
        disabled={disabled || !text.trim()}
      >
        Save
      </Button>
    </div>
  );
}
