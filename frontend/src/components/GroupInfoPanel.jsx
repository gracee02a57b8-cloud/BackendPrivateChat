import { useState, useEffect, useCallback } from 'react';
import { copyToClipboard } from '../utils/clipboard';
import { showToast } from './Toast';
import { getAvatarColor, formatLastSeen } from '../utils/avatar';
import { X, Link, LogOut, Image, Film, FolderOpen, Users, Trash2 } from 'lucide-react';

/**
 * GroupInfoPanel — Telegram-style overlay panel showing group info.
 *
 * - Group avatar + name + member count
 * - Action buttons (notifications placeholder, invite link, leave)
 * - Media stats (photos, videos, files, links)
 * - Full member list with online status + creator badge
 */
export default function GroupInfoPanel({
  room,
  username,
  allUsers,
  onlineUsers,
  avatarMap,
  token,
  onClose,
  onLeaveRoom,
}) {
  const [mediaStats, setMediaStats] = useState(null);

  // Fetch media stats
  useEffect(() => {
    if (!room?.id || !token) return;
    fetch(`/api/rooms/${room.id}/media-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setMediaStats(data); })
      .catch(() => {});
  }, [room?.id, token]);

  const handleCopyLink = useCallback(async () => {
    const link = `${window.location.origin}/?join=${room.id}`;
    const ok = await copyToClipboard(link);
    if (ok) showToast('Ссылка скопирована!');
  }, [room?.id]);

  const handleLeave = useCallback(() => {
    if (onLeaveRoom) onLeaveRoom(room.id);
    onClose();
  }, [onLeaveRoom, room?.id, onClose]);

  if (!room) return null;

  const members = room.members || [];
  const creator = room.creator;
  const onlineCount = members.filter(m => onlineUsers?.includes(m)).length;

  // Build enriched member list sorted: online first, then alphabetically
  const enrichedMembers = members.map(m => {
    const info = allUsers.find(u => u.username === m);
    return {
      username: m,
      avatarUrl: avatarMap?.[m] || info?.avatarUrl || '',
      isOnline: onlineUsers?.includes(m) || false,
      lastSeen: info?.lastSeen || null,
      isCreator: m === creator,
    };
  }).sort((a, b) => {
    // Creator first
    if (a.isCreator && !b.isCreator) return -1;
    if (!a.isCreator && b.isCreator) return 1;
    // Online before offline
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="grp-info-overlay" onClick={onClose}>
      <div className="grp-info-panel" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <button className="grp-info-close" onClick={onClose}><X size={20} /></button>

        {/* Header: avatar + name + count */}
        <div className="grp-info-header">
          <div
            className="grp-info-avatar"
            style={{ background: getAvatarColor(room.name || 'G') }}
          >
            {(room.name || 'G').charAt(0).toUpperCase()}
          </div>
          <h2 className="grp-info-name">{room.name}</h2>
          <span className="grp-info-subtitle">
            {members.length} участник{members.length === 1 ? '' : members.length < 5 ? 'а' : 'ов'}
            {onlineCount > 0 && `, ${onlineCount} в сети`}
          </span>
        </div>

        {/* Action buttons */}
        <div className="grp-info-actions">
          <button className="grp-info-action-btn" onClick={handleCopyLink} title="Скопировать ссылку-приглашение">
            <span className="grp-info-action-icon"><Link size={20} /></span>
            <span className="grp-info-action-label">Ссылка</span>
          </button>
          <button className="grp-info-action-btn" onClick={handleLeave} title="Покинуть группу">
            <span className="grp-info-action-icon"><LogOut size={20} /></span>
            <span className="grp-info-action-label">Покинуть</span>
          </button>
        </div>

        {/* Media stats */}
        {mediaStats && (
          <div className="grp-info-media">
            {mediaStats.photos > 0 && (
              <div className="grp-info-media-row">
                <span className="grp-info-media-icon"><Image size={16} /></span>
                <span>{mediaStats.photos} фотографи{mediaStats.photos === 1 ? 'я' : mediaStats.photos < 5 ? 'и' : 'й'}</span>
              </div>
            )}
            {mediaStats.videos > 0 && (
              <div className="grp-info-media-row">
                <span className="grp-info-media-icon"><Film size={16} /></span>
                <span>{mediaStats.videos} видео</span>
              </div>
            )}
            {mediaStats.files > 0 && (
              <div className="grp-info-media-row">
                <span className="grp-info-media-icon"><FolderOpen size={16} /></span>
                <span>{mediaStats.files} файл{mediaStats.files === 1 ? '' : mediaStats.files < 5 ? 'а' : 'ов'}</span>
              </div>
            )}
            {mediaStats.links > 0 && (
              <div className="grp-info-media-row">
                <span className="grp-info-media-icon"><Link size={16} /></span>
                <span>{mediaStats.links} ссыл{mediaStats.links === 1 ? 'ка' : mediaStats.links < 5 ? 'ки' : 'ок'}</span>
              </div>
            )}
            {mediaStats.photos === 0 && mediaStats.videos === 0 && mediaStats.files === 0 && mediaStats.links === 0 && (
              <div className="grp-info-media-row grp-info-media-empty">
                <span>Нет медиа-файлов</span>
              </div>
            )}
          </div>
        )}

        {/* Members */}
        <div className="grp-info-members">
          <div className="grp-info-members-header">
            <span><Users size={16} /> {members.length} УЧАСТНИК{members.length === 1 ? '' : members.length < 5 ? 'А' : 'ОВ'}</span>
          </div>
          <div className="grp-info-members-list">
            {enrichedMembers.map(member => (
              <div key={member.username} className="grp-info-member">
                <div className="grp-info-member-avatar-wrap">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.username} className="grp-info-member-avatar-img" />
                  ) : (
                    <div
                      className="grp-info-member-avatar"
                      style={{ background: getAvatarColor(member.username) }}
                    >
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {member.isOnline && <span className="grp-info-member-online-dot" />}
                </div>
                <div className="grp-info-member-info">
                  <span className="grp-info-member-name">
                    {member.username}
                    {member.username === username && ' (вы)'}
                  </span>
                  <span className={`grp-info-member-status ${member.isOnline ? 'online' : ''}`}>
                    {member.isOnline ? 'в сети' : formatLastSeen(member.lastSeen)}
                  </span>
                </div>
                {member.isCreator && (
                  <span className="grp-info-member-badge">владелец</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Delete chat button */}
        <div className="grp-info-delete-wrap">
          <button className="grp-info-delete-btn" onClick={handleLeave}>
            <Trash2 size={16} />
            Удалить чат
          </button>
        </div>
      </div>
    </div>
  );
}
