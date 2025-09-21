"use client";

import { useEffect, useState } from "react";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";

type Video = any;

export function YouTubeDashboard({ signedIn }: { signedIn: boolean }) {
  const [videoId, setVideoId] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [noteText, setNoteText] = useState("");

  const videoQuery = api.youtube.fetchVideo.useQuery(
    { videoId },
    { enabled: !!videoId && signedIn },
  );
  const commentsQuery = api.youtube.listComments.useQuery(
    { videoId },
    { enabled: !!videoId && signedIn },
  );
  const noteQuery = api.notes.get.useQuery(
    { videoId },
    { enabled: !!videoId && signedIn },
  );

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
  const upsertNote = api.notes.upsert.useMutation();

  const video = videoQuery.data as Video | null;
  const threads = (commentsQuery.data as any)?.items as any[] | undefined;

  useEffect(() => {
    setNoteText((noteQuery.data as any)?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, (noteQuery.data as any)?.content]);

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-semibold text-2xl">YouTube Companion Dashboard</h1>
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

      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="videoId" className="mb-1 block font-medium text-sm">
              Video ID
            </label>
            <Input
              id="videoId"
              placeholder="e.g. dQw4w9WgXcQ"
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

      {video && (
        <Card className="mb-6 p-4">
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
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={() =>
                          updateVideo.mutate({
                            videoId,
                            title: title || undefined,
                            description: description || undefined,
                          })
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </Card>
      )}

      {signedIn && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-3 font-medium text-lg">Comments</h3>
            <AddComment
              onAdd={(text) => addComment.mutate({ videoId, text })}
            />
            <div className="mt-4 space-y-4">
              {threads?.map((t, idx) => (
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
                  <div className="mt-2 flex gap-2">
                    <ReplyBox
                      onReply={(text) =>
                        replyToComment.mutate({
                          parentId: t?.snippet?.topLevelComment?.id,
                          text,
                        })
                      }
                    />
                    <Button
                      variant="destructive"
                      onClick={() =>
                        deleteComment.mutate({
                          commentId: t?.snippet?.topLevelComment?.id,
                        })
                      }
                    >
                      Delete
                    </Button>
                  </div>
                  {t?.replies?.comments?.length ? (
                    <div className="mt-3 border-t pt-2">
                      {t.replies.comments.map((c: any) => (
                        <div key={c.id} className="mt-2 text-sm">
                          <span className="font-medium">
                            {c?.snippet?.authorDisplayName}
                          </span>
                          <p className="whitespace-pre-wrap">
                            {c?.snippet?.textDisplay ??
                              c?.snippet?.textOriginal}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {!threads?.length && (
                <div className="text-muted-foreground text-sm">
                  No comments found.
                </div>
              )}
            </div>
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

function AddComment({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        placeholder="Write a comment..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        onClick={() => {
          if (text.trim()) {
            onAdd(text.trim());
            setText("");
          }
        }}
      >
        Comment
      </Button>
    </div>
  );
}

function ReplyBox({ onReply }: { onReply: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        placeholder="Reply..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        variant="secondary"
        onClick={() => {
          if (text.trim()) {
            onReply(text.trim());
            setText("");
          }
        }}
      >
        Reply
      </Button>
    </div>
  );
}
