import React, { useEffect, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { FeedComment } from '../../types';
import { Avatar } from '../common/Avatar';
import { timeAgo } from '../../utils/activity';
import { CoachBadge } from './CoachBadge';

interface CommentThreadProps {
  itemType: string;
  itemId: number;
  viewerName: string;
  viewerId: number;
  isAdmin: boolean;
  onCountChange: (delta: number) => void;
}

/** Combines comment lists without duplicates (the initial load can race with a new comment). */
const mergeById = (a: FeedComment[], b: FeedComment[]): FeedComment[] => {
  const byId = new Map<number, FeedComment>();
  [...a, ...b].forEach((c) => byId.set(c.id, c));
  return [...byId.values()].sort((x, y) => x.id - y.id);
};

export const CommentThread: React.FC<CommentThreadProps> = ({
  itemType,
  itemId,
  viewerName,
  viewerId,
  isAdmin,
  onCountChange,
}) => {
  const [comments, setComments] = useState<FeedComment[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getComments(itemType, itemId)
      .then((res) => !cancelled && setComments((prev) => mergeById(res.data, prev ?? [])))
      .catch((err) => !cancelled && setError(err.message || 'Couldn’t load comments.'));
    inputRef.current?.focus();
    return () => {
      cancelled = true;
    };
  }, [itemType, itemId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await api.addComment(itemType, itemId, body);
      setComments((prev) => mergeById(prev ?? [], [created]));
      setText('');
      onCountChange(1);
    } catch (err: any) {
      setError(err.message || 'Couldn’t post your comment.');
    } finally {
      setSending(false);
    }
  };

  const remove = async (c: FeedComment) => {
    try {
      await api.deleteComment(c.id);
      setComments((prev) => (prev ?? []).filter((x) => x.id !== c.id));
      onCountChange(-1);
    } catch (err: any) {
      setError(err.message || 'Couldn’t delete that comment.');
    }
  };

  return (
    <div className="space-y-3 pt-3 border-t border-line">
      {comments === null && !error && <div className="h-10 rounded-xl bg-well animate-pulse" />}

      {comments?.length === 0 && <p className="text-sm text-muted">No comments yet. Start the conversation!</p>}

      <ul className="space-y-3">
        {comments?.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Avatar name={c.author.name} id={c.author.id} size={32} />
            <div className="min-w-0 flex-1">
              <div
                className={`inline-block max-w-full px-3 py-2 rounded-2xl bg-well border ${
                  c.author.is_coach ? 'border-info/50' : 'border-line'
                }`}
              >
                <p className="text-sm font-semibold text-ink flex flex-wrap items-center gap-1.5">
                  {c.author.name}
                  {c.author.is_coach && <CoachBadge />}
                </p>
                <p className="text-sm text-ink whitespace-pre-wrap break-words">{c.body}</p>
              </div>
              <p className="px-1 mt-0.5 text-xs text-muted flex items-center gap-3">
                <span>{timeAgo(c.created_at)}</span>
                {(c.mine || isAdmin) && (
                  <button
                    onClick={() => remove(c)}
                    className="hover:text-danger flex items-center gap-1"
                    aria-label={`Delete comment by ${c.author.name}`}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={send} className="flex items-center gap-2.5">
        <Avatar name={viewerName} id={viewerId} size={32} />
        <label htmlFor={`comment-${itemType}-${itemId}`} className="sr-only">
          Write a comment
        </label>
        <input
          id={`comment-${itemType}-${itemId}`}
          ref={inputRef}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          className="flex-1 min-w-0 h-11 rounded-full bg-well border border-line px-4 text-sm text-ink placeholder-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send comment"
          className="h-11 w-11 rounded-full bg-accent text-on-accent flex items-center justify-center disabled:opacity-40 shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};
