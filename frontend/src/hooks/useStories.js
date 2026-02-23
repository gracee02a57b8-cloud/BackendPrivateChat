import { useState, useEffect, useCallback, useRef } from 'react';

const API = '';

export default function useStories({ token, username, wsRef }) {
  const [stories, setStories] = useState([]); // flat list of StoryDto
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  /* ── Fetch all active stories ── */
  const fetchStories = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/stories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStories(data);
      }
    } catch (e) {
      console.error('Failed to fetch stories', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  /* ── Initial fetch ── */
  useEffect(() => {
    if (!fetchedRef.current && token) {
      fetchedRef.current = true;
      fetchStories();
    }
  }, [token, fetchStories]);

  /* ── Upload story (video file) ── */
  const uploadStory = useCallback(async (file, thumbnailBlob) => {
    if (!token || !file) return null;

    // 1. Upload video file
    const fd = new FormData();
    fd.append('file', file);
    const uploadRes = await fetch(`${API}/api/upload/file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!uploadRes.ok) throw new Error('Upload failed');
    const uploadData = await uploadRes.json();

    // 2. Upload thumbnail if provided
    let thumbnailUrl = null;
    if (thumbnailBlob) {
      const tfd = new FormData();
      tfd.append('file', thumbnailBlob);
      const tRes = await fetch(`${API}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: tfd,
      });
      if (tRes.ok) {
        const tData = await tRes.json();
        thumbnailUrl = tData.url;
      }
    }

    // 3. Get video duration
    let duration = 0;
    try {
      duration = await getVideoDuration(file);
    } catch (_) {}

    // 4. Create story record
    const res = await fetch(`${API}/api/stories`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoUrl: uploadData.url,
        thumbnailUrl,
        duration: Math.round(duration),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create story');
    }

    const story = await res.json();

    // 5. Broadcast via WS
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'STORY_POSTED',
        content: story.id,
      }));
    }

    // 6. Refresh stories list
    await fetchStories();
    return story;
  }, [token, wsRef, fetchStories]);

  /* ── Mark story as viewed ── */
  const viewStory = useCallback(async (storyId) => {
    if (!token) return;
    try {
      await fetch(`${API}/api/stories/${storyId}/view`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      // Update local state
      setStories(prev => prev.map(s =>
        s.id === storyId ? { ...s, viewedByMe: true, viewCount: s.viewCount + 1 } : s
      ));
    } catch (e) {
      console.error('Failed to mark story viewed', e);
    }
  }, [token]);

  /* ── Get viewers ── */
  const getViewers = useCallback(async (storyId) => {
    if (!token) return [];
    try {
      const res = await fetch(`${API}/api/stories/${storyId}/viewers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.error('Failed to get viewers', e);
    }
    return [];
  }, [token]);

  /* ── Delete story ── */
  const deleteStory = useCallback(async (storyId) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/stories/${storyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStories(prev => prev.filter(s => s.id !== storyId));
      }
    } catch (e) {
      console.error('Failed to delete story', e);
    }
  }, [token]);

  /* ── Group stories by author ── */
  const groupedStories = groupByAuthor(stories, username);

  return {
    stories,
    groupedStories,
    loading,
    fetchStories,
    uploadStory,
    viewStory,
    getViewers,
    deleteStory,
  };
}

/* ── Helpers ── */

function groupByAuthor(stories, currentUser) {
  const map = new Map();

  for (const story of stories) {
    if (!map.has(story.author)) {
      map.set(story.author, {
        author: story.author,
        stories: [],
        hasUnviewed: false,
      });
    }
    const group = map.get(story.author);
    group.stories.push(story);
    if (!story.viewedByMe) group.hasUnviewed = true;
  }

  // Sort: current user first, then unviewed, then viewed
  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    if (a.author === currentUser) return -1;
    if (b.author === currentUser) return 1;
    if (a.hasUnviewed && !b.hasUnviewed) return -1;
    if (!a.hasUnviewed && b.hasUnviewed) return 1;
    return 0;
  });

  return groups;
}

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = reject;
    video.src = URL.createObjectURL(file);
  });
}
