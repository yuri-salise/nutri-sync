import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Send, Users } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FeedItem } from '../types';
import { Avatar } from '../components/common/Avatar';
import { FeedCard } from '../components/feed/FeedCard';
import { useDialogs } from '../components/common/DialogProvider';

type Filter = 'all' | 'workouts' | 'runs' | 'posts';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'runs', label: 'Activities' },
  { id: 'posts', label: 'Posts' },
];
const PAGE_SIZE = 10;
const MAX_POST = 1000;

export const CommunityFeedPage: React.FC = () => {
  const { user, role } = useAuth();
  const { confirm } = useDialogs();
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const load = useCallback(async (nextPage: number, replace: boolean, f: Filter) => {
    const id = ++requestId.current;
    try {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      const res = await api.getCommunityFeed(nextPage, PAGE_SIZE, f);
      if (id !== requestId.current) return; // a newer request replaced this one
      setItems((prev) => {
        const base = replace ? [] : prev;
        const seen = new Set(base.map((i) => i.key));
        return [...base, ...res.data.filter((i) => !seen.has(i.key))];
      });
      setPage(nextPage);
      setTotalPages(res.meta.total_pages);
    } catch (err: any) {
      if (id === requestId.current) setError(err.message || 'We couldn’t load the feed.');
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    load(1, true, filter);
  }, [filter, load]);

  const hasMore = page < totalPages;

  // Load the next page when the bottom of the feed scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadingMore || error) return;
    const obs = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && load(page + 1, false, filter),
      { rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, error, page, filter, load]);

  const patchItem = (key: string, fn: (i: FeedItem) => FeedItem) =>
    setItems((prev) => prev.map((i) => (i.key === key ? fn(i) : i)));

  const toggleKudos = async (item: FeedItem) => {
    const giving = !item.kudos_by_me;
    const step = giving ? 1 : -1;
    const coachStep = role === 'admin' ? step : 0; // a coach's kudos counts as an approval
    patchItem(item.key, (i) => ({
      ...i,
      kudos_by_me: giving,
      kudos_count: Math.max(0, i.kudos_count + step),
      coach_kudos_count: Math.max(0, (i.coach_kudos_count ?? 0) + coachStep),
    }));
    try {
      if (giving) {
        const state = await api.giveKudos(item.type, item.id);
        patchItem(item.key, (i) => ({ ...i, ...state }));
      } else {
        await api.removeKudos(item.type, item.id);
      }
    } catch {
      patchItem(item.key, (i) => ({
        ...i,
        kudos_by_me: item.kudos_by_me,
        kudos_count: item.kudos_count,
        coach_kudos_count: item.coach_kudos_count,
      }));
      setError('Couldn’t update your kudos. Please try again.');
    }
  };

  const changeCommentCount = (item: FeedItem, delta: number) =>
    patchItem(item.key, (i) => ({ ...i, comments_count: Math.max(0, i.comments_count + delta) }));

  const deletePost = async (item: FeedItem) => {
    const ok = await confirm({
      title: 'Delete this post?',
      message: 'Its comments and kudos will be removed too. This can’t be undone.',
      confirmLabel: 'Delete post',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.deletePost(item.id);
      setItems((prev) => prev.filter((i) => i.key !== item.key));
    } catch (err: any) {
      setError(err.message || 'Couldn’t delete that post.');
    }
  };

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    setError(null);
    try {
      const created = await api.createPost(body);
      setDraft('');
      setComposerOpen(false);
      if (filter === 'all' || filter === 'posts') setItems((prev) => [created, ...prev]);
      else setFilter('all');
    } catch (err: any) {
      setError(err.message || 'Couldn’t share your post.');
    } finally {
      setPosting(false);
    }
  };

  const viewerName = user?.full_name ?? 'You';
  const viewerId = user?.id ?? 0;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Users className="h-6 w-6 text-[#C8FF00]" />
          <span>Community</span>
        </h1>
        <p className="text-sm text-[#848E9C] mt-1">See what everyone is training, cheer them on, and share your own wins.</p>
      </div>

      {/* Composer */}
      <form onSubmit={submitPost} className="p-4 rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-3">
        <div className="flex items-start gap-3">
          <Avatar name={viewerName} id={viewerId} />
          <div className="flex-1 min-w-0">
            <label htmlFor="post-body" className="sr-only">
              Share an update
            </label>
            <textarea
              id="post-body"
              value={draft}
              maxLength={MAX_POST}
              rows={composerOpen ? 3 : 1}
              onFocus={() => setComposerOpen(true)}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`What's on your mind, ${viewerName.split(' ')[0]}?`}
              className="w-full bg-[#07080a] border border-[#1e232d] rounded-2xl px-4 py-3 text-base text-white placeholder-[#848E9C] focus:border-[#C8FF00] focus:outline-none resize-none"
            />
          </div>
        </div>
        {(composerOpen || draft) && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#848E9C]">
              {draft.length}/{MAX_POST}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft('');
                  setComposerOpen(false);
                }}
                className="h-10 px-4 rounded-xl text-sm text-[#848E9C] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!draft.trim() || posting}
                className="h-10 px-5 rounded-xl bg-[#C8FF00] text-black font-bold text-sm flex items-center gap-1.5 disabled:opacity-40"
              >
                <Send className="h-4 w-4" /> {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-[#848E9C]">
          Workouts and activities you share appear here automatically when you finish them.
        </p>
      </form>

      {/* Filters */}
      <div role="tablist" aria-label="Feed filter" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 h-10 px-4 rounded-full text-sm font-semibold border transition-colors ${
              filter === f.id
                ? 'bg-[#C8FF00] text-black border-[#C8FF00]'
                : 'bg-[#12151b] text-[#B7BDC6] border-[#1e232d] hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-2xl bg-[#F6465D]/10 border border-[#F6465D]/30 text-[#F6465D] text-sm flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => load(1, true, filter)} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 rounded-3xl bg-[#12151b] border border-[#1e232d] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <div className="p-10 text-center rounded-3xl bg-[#12151b] border border-[#1e232d] space-y-2">
          <p className="text-base font-bold text-white">It’s quiet in here</p>
          <p className="text-sm text-[#848E9C]">
            {filter === 'all' || filter === 'posts'
              ? 'Be the first to post something above, or finish a workout and share it.'
              : 'Nothing here yet. Finish a workout or activity and share it to get things started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <FeedCard
              key={item.key}
              item={item}
              viewerName={viewerName}
              viewerId={viewerId}
              isAdmin={role === 'admin'}
              onToggleKudos={toggleKudos}
              onCommentCount={changeCommentCount}
              onDeletePost={deletePost}
            />
          ))}

          <div ref={sentinelRef} className="h-10 flex items-center justify-center">
            {loadingMore ? (
              <Loader2 className="h-5 w-5 text-[#848E9C] animate-spin" aria-label="Loading more" />
            ) : hasMore ? (
              <button onClick={() => load(page + 1, false, filter)} className="h-10 px-5 rounded-xl bg-[#12151b] border border-[#1e232d] text-sm font-semibold text-white">
                Load more
              </button>
            ) : (
              <span className="text-sm text-[#5E6673]">You’re all caught up</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
