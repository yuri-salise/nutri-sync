import React, { useState } from 'react';
import { Award, Dumbbell, Flame, Heart, MessageCircle, Trash2, ShieldCheck } from 'lucide-react';
import { FeedItem } from '../../types';
import { Avatar } from '../common/Avatar';
import { RouteThumb } from '../activity/RouteThumb';
import { SportIcon } from '../activity/SportIcon';
import { CommentThread } from './CommentThread';
import { formatDistance, formatSpeed, parseApiDate, sportInfo, timeAgo } from '../../utils/activity';
import { formatDuration, formatPace } from '../../utils/gps';

interface FeedCardProps {
  item: FeedItem;
  viewerName: string;
  viewerId: number;
  isAdmin: boolean;
  onToggleKudos: (item: FeedItem) => void;
  onCommentCount: (item: FeedItem, delta: number) => void;
  onDeletePost: (item: FeedItem) => void;
}

const Stat: React.FC<{ label: string; value: string; unit?: string }> = ({ label, value, unit }) => (
  <div className="min-w-0">
    <p className="text-xs text-[#848E9C]">{label}</p>
    <p className="text-lg font-black font-mono text-white truncate">
      {value}
      {unit && <span className="text-xs font-semibold text-[#848E9C] ml-1">{unit}</span>}
    </p>
  </div>
);

export const FeedCard: React.FC<FeedCardProps> = ({
  item,
  viewerName,
  viewerId,
  isAdmin,
  onToggleKudos,
  onCommentCount,
  onDeletePost,
}) => {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const sport = item.type === 'run' ? sportInfo(item.sport_type) : null;
  const accent = sport?.color ?? '#C8FF00';

  const headline =
    item.type === 'workout'
      ? 'completed a workout'
      : item.type === 'run'
      ? `${sport?.verb} ${formatDistance(item.distance_km ?? 0)} km`
      : 'shared an update';

  return (
    <article className="rounded-3xl bg-[#12151b] border border-[#1e232d] overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3 flex items-start gap-3">
        <Avatar name={item.author.name} id={item.author.id} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white leading-snug">
            <span className="font-bold">{item.mine ? 'You' : item.author.name}</span>{' '}
            <span className="text-[#B7BDC6]">{headline}</span>
          </p>
          <p className="text-xs text-[#848E9C] flex items-center gap-1.5">
            <time dateTime={parseApiDate(item.timestamp).toISOString()}>{timeAgo(item.timestamp)}</time>
            {item.type === 'workout' && <Dumbbell className="h-3 w-3" aria-label="Workout" />}
            {item.type === 'run' && <SportIcon sport={item.sport_type} className="h-3 w-3" />}
          </p>
        </div>
        {item.type === 'post' && (item.mine || isAdmin) && (
          <button
            onClick={() => onDeletePost(item)}
            aria-label="Delete post"
            className="h-9 w-9 rounded-lg text-[#848E9C] hover:text-[#F6465D] flex items-center justify-center shrink-0"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-4 space-y-3">
        {item.type === 'post' && (
          <p className="text-base text-[#EAECEF] whitespace-pre-wrap break-words">{item.text}</p>
        )}

        {item.type === 'workout' && (
          <>
            <h3 className="text-base font-bold text-white break-words">{item.title}</h3>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Time" value={`${item.duration_min ?? 0}`} unit="min" />
              <Stat label="Exercises" value={`${item.exercises?.length ?? 0}`} />
              <Stat label="Calories" value={`${Math.round(item.burned_kcal ?? 0)}`} unit="kcal" />
            </div>
            {!!item.exercises?.length && (
              <ul className="space-y-1.5">
                {item.exercises.slice(0, 4).map((e) => (
                  <li key={e.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[#EAECEF] truncate flex items-center gap-1.5">
                      {e.name}
                      {e.is_pr && <Award className="h-3.5 w-3.5 text-[#FFB800] shrink-0" aria-label="Personal record" />}
                    </span>
                    <span className="text-[#848E9C] font-mono shrink-0">
                      {e.sets} × {e.reps}
                      {e.top_weight_kg > 0 ? ` @ ${e.top_weight_kg} kg` : ''}
                    </span>
                  </li>
                ))}
                {item.exercises.length > 4 && (
                  <li className="text-xs text-[#848E9C]">+{item.exercises.length - 4} more exercises</li>
                )}
              </ul>
            )}
            {!!item.prs_count && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFB800]/15 border border-[#FFB800]/30 text-[#FFB800] text-sm font-bold">
                <Award className="h-4 w-4" />
                {item.prs_count} new PR{item.prs_count > 1 ? 's' : ''}
                {item.has_verified_pr && (
                  <span className="flex items-center gap-1 text-[#00D26A] font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" /> verified
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {item.type === 'run' && (
          <>
            <h3 className="text-base font-bold text-white break-words">{item.title}</h3>
            <div className="flex gap-4 items-stretch">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 flex-1 min-w-0 content-start">
                <Stat label="Distance" value={formatDistance(item.distance_km ?? 0)} unit="km" />
                <Stat label="Time" value={formatDuration(item.duration_sec ?? 0)} />
                {sport?.showSpeed ? (
                  <Stat label="Speed" value={formatSpeed((item.distance_km ?? 0) * 1000, item.duration_sec ?? 0)} unit="km/h" />
                ) : (
                  <Stat label="Pace" value={formatPace((item.distance_km ?? 0) * 1000, item.duration_sec ?? 0)} unit="/km" />
                )}
                <Stat label="Climb" value={`${Math.round(item.elevation_gain_m ?? 0)}`} unit="m" />
              </div>
              {item.route && item.route.length > 1 && (
                <div className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 rounded-2xl bg-[#07080a] border border-[#1e232d]">
                  <RouteThumb points={item.route} color={accent} />
                </div>
              )}
            </div>
            <p className="text-xs text-[#848E9C] flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-[#C8FF00]" />
              {Math.round(item.burned_kcal ?? 0)} kcal burned
              {item.route && item.route_hidden_ends && <span>· start and end hidden for privacy</span>}
            </p>
          </>
        )}
      </div>

      {/* Counts */}
      {(item.kudos_count > 0 || item.comments_count > 0) && (
        <div className="px-4 pb-2 flex items-center justify-between text-sm text-[#848E9C]">
          <span className="flex items-center gap-1.5">
            {item.kudos_count > 0 && (
              <>
                <Heart className="h-4 w-4 text-[#F6465D] fill-[#F6465D]" aria-hidden="true" />
                {item.kudos_count} kudos
              </>
            )}
          </span>
          {item.comments_count > 0 && (
            <button onClick={() => setCommentsOpen((o) => !o)} className="hover:text-white">
              {item.comments_count} comment{item.comments_count === 1 ? '' : 's'}
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-2 py-1.5 border-t border-[#1e232d] grid grid-cols-2 gap-1">
        <button
          onClick={() => onToggleKudos(item)}
          aria-pressed={item.kudos_by_me}
          className={`h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            item.kudos_by_me ? 'text-[#F6465D]' : 'text-[#B7BDC6] hover:bg-[#181c24]'
          }`}
        >
          <Heart className={`h-5 w-5 ${item.kudos_by_me ? 'fill-[#F6465D]' : ''}`} />
          {item.kudos_by_me ? 'Kudos given' : 'Give kudos'}
        </button>
        <button
          onClick={() => setCommentsOpen((o) => !o)}
          aria-expanded={commentsOpen}
          className="h-11 rounded-xl text-sm font-semibold text-[#B7BDC6] hover:bg-[#181c24] flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-5 w-5" />
          Comment
        </button>
      </div>

      {commentsOpen && (
        <div className="px-4 pb-4">
          <CommentThread
            itemType={item.type}
            itemId={item.id}
            viewerName={viewerName}
            viewerId={viewerId}
            isAdmin={isAdmin}
            onCountChange={(d) => onCommentCount(item, d)}
          />
        </div>
      )}
    </article>
  );
};
