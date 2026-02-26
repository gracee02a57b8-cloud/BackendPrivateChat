// ═══════════════════════════════════════════════
//  Stories Bar — horizontal stories row
// ═══════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { fetchStories, createStory, viewStory, uploadFile } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import { Plus, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { cn, formatTime } from '@/lib/utils';

interface Story {
  id: number;
  username: string;
  mediaUrl: string;
  textContent?: string;
  createdAt: string;
  viewed?: boolean;
  viewerCount?: number;
}

interface StoryGroup {
  username: string;
  stories: Story[];
  allViewed: boolean;
}

export default function StoriesBar() {
  const { token, username, avatarMap } = useStore();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
  const [viewingIdx, setViewingIdx] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    fetchStories(token).then((stories: Story[]) => {
      const map = new Map<string, Story[]>();
      stories.forEach((s) => {
        if (!map.has(s.username)) map.set(s.username, []);
        map.get(s.username)!.push(s);
      });
      const g: StoryGroup[] = [];
      // Own stories first
      if (map.has(username!)) {
        g.push({ username: username!, stories: map.get(username!)!, allViewed: true });
        map.delete(username!);
      }
      map.forEach((stories, u) => {
        g.push({ username: u, stories, allViewed: stories.every((s) => s.viewed) });
      });
      setGroups(g);
    }).catch(console.error);
  }, [token, username]);

  const openStory = (group: StoryGroup) => {
    setViewingGroup(group);
    setViewingIdx(0);
    // Mark as viewed
    if (token && group.stories[0] && !group.stories[0].viewed) {
      viewStory(token, group.stories[0].id).catch(console.error);
    }
  };

  const nextStory = () => {
    if (!viewingGroup) return;
    if (viewingIdx < viewingGroup.stories.length - 1) {
      const nextIdx = viewingIdx + 1;
      setViewingIdx(nextIdx);
      if (token && !viewingGroup.stories[nextIdx].viewed) {
        viewStory(token, viewingGroup.stories[nextIdx].id).catch(console.error);
      }
    } else {
      // Next group
      const gIdx = groups.findIndex((g) => g.username === viewingGroup.username);
      if (gIdx < groups.length - 1) {
        openStory(groups[gIdx + 1]);
      } else {
        setViewingGroup(null);
      }
    }
  };

  const prevStory = () => {
    if (!viewingGroup) return;
    if (viewingIdx > 0) {
      setViewingIdx(viewingIdx - 1);
    } else {
      const gIdx = groups.findIndex((g) => g.username === viewingGroup.username);
      if (gIdx > 0) {
        setViewingGroup(groups[gIdx - 1]);
        setViewingIdx(groups[gIdx - 1].stories.length - 1);
      }
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const data = await uploadFile(token, file);
      await createStory(token, { mediaUrl: data.url });
      // Refresh
      const stories = await fetchStories(token);
      // Re-group...
      setShowUpload(false);
    } catch (err) {
      console.error(err);
    }
    e.target.value = '';
  };

  if (groups.length === 0 && !showUpload) return null;

  return (
    <>
      {/* Stories row */}
      <div className="px-2 py-3 bg-(--color-bg-surface) border-b border-(--color-separator)">
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-none px-1">
          {/* Add story */}
          <button
            onClick={() => setShowUpload(true)}
            className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
          >
            <div className="relative">
              <Avatar src={avatarMap[username!]} name={username || '?'} size="md" />
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-(--color-accent) rounded-full flex items-center justify-center border-2 border-(--color-bg-surface)">
                <Plus size={12} className="text-white" />
              </div>
            </div>
            <span className="text-[10px] text-(--color-text-secondary) max-w-[56px] truncate">Моя история</span>
          </button>

          {/* Story circles */}
          {groups.map((g) => (
            <button
              key={g.username}
              onClick={() => openStory(g)}
              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
            >
              <div className={cn(
                'p-0.5 rounded-full',
                g.allViewed
                  ? 'bg-(--color-text-tertiary)/30'
                  : 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-500'
              )}>
                <div className="p-0.5 bg-(--color-bg-surface) rounded-full">
                  <Avatar src={avatarMap[g.username]} name={g.username} size="md" />
                </div>
              </div>
              <span className="text-[10px] text-(--color-text-secondary) max-w-[56px] truncate">{g.username}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Upload input (hidden) */}
      {showUpload && (
        <input type="file" accept="image/*,video/*" className="hidden" ref={(el) => { if (el) el.click(); }} onChange={handleUpload} />
      )}

      {/* Story viewer modal */}
      {viewingGroup && (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col">
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
            {viewingGroup.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                <div className={cn(
                  'h-full bg-white rounded-full transition-all',
                  i < viewingIdx ? 'w-full' : i === viewingIdx ? 'w-full' : 'w-0'
                )} />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-10 pb-2 z-10">
            <Avatar src={avatarMap[viewingGroup.username]} name={viewingGroup.username} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{viewingGroup.username}</p>
              <p className="text-xs text-white/60">
                {formatTime(viewingGroup.stories[viewingIdx]?.createdAt)}
              </p>
            </div>
            <button onClick={() => setViewingGroup(null)} className="p-2 rounded-full hover:bg-white/10 cursor-pointer">
              <X size={22} className="text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex items-center justify-center relative">
            {viewingGroup.stories[viewingIdx]?.mediaUrl && (
              <img
                src={viewingGroup.stories[viewingIdx].mediaUrl}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            )}
            {viewingGroup.stories[viewingIdx]?.textContent && (
              <p className="absolute bottom-16 left-4 right-4 text-center text-white text-lg font-medium drop-shadow-lg">
                {viewingGroup.stories[viewingIdx].textContent}
              </p>
            )}

            {/* Nav areas */}
            <div className="absolute inset-y-0 left-0 w-1/3 cursor-pointer" onClick={prevStory} />
            <div className="absolute inset-y-0 right-0 w-1/3 cursor-pointer" onClick={nextStory} />
          </div>

          {/* Viewers count */}
          {viewingGroup.username === username && viewingGroup.stories[viewingIdx]?.viewerCount !== undefined && (
            <div className="flex items-center justify-center gap-1.5 py-3 text-white/60 text-xs">
              <Eye size={14} /> {viewingGroup.stories[viewingIdx].viewerCount} просмотров
            </div>
          )}
        </div>
      )}
    </>
  );
}
