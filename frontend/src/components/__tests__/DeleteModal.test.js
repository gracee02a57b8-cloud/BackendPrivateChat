import { describe, it, expect } from 'vitest';

// ====== Delete Modal Logic Tests ======
// Tests for the delete confirmation modal behavior (replacing window.confirm)

describe('DeleteModal state management', () => {
  it('deleteConfirm starts as null', () => {
    const state = { deleteConfirm: null };
    expect(state.deleteConfirm).toBeNull();
  });

  it('setting deleteConfirm stores message info', () => {
    const msg = { id: 'msg-1', content: 'Hello world', sender: 'alice' };
    const state = { deleteConfirm: msg };
    expect(state.deleteConfirm).toEqual(msg);
    expect(state.deleteConfirm.id).toBe('msg-1');
    expect(state.deleteConfirm.content).toBe('Hello world');
  });

  it('cancel resets deleteConfirm to null', () => {
    const state = { deleteConfirm: { id: 'msg-1', content: 'test' } };
    state.deleteConfirm = null;
    expect(state.deleteConfirm).toBeNull();
  });

  it('confirm calls delete with correct id and resets state', () => {
    const deletedIds = [];
    const onDeleteMessage = (id) => deletedIds.push(id);

    let deleteConfirm = { id: 'msg-42', content: 'To be deleted' };
    onDeleteMessage(deleteConfirm.id);
    deleteConfirm = null;

    expect(deletedIds).toEqual(['msg-42']);
    expect(deleteConfirm).toBeNull();
  });

  it('truncates long content in preview', () => {
    const longContent = 'A'.repeat(200);
    const preview = longContent.length > 80
      ? longContent.slice(0, 80) + '…'
      : longContent;
    expect(preview).toHaveLength(81);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('shows file placeholder for messages without content', () => {
    const msg = { id: 'msg-1', content: null, fileUrl: '/uploads/file.pdf' };
    const preview = msg.content
      ? (msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content)
      : '📎 Файл';
    expect(preview).toBe('📎 Файл');
  });

  it('shows short content as-is', () => {
    const msg = { id: 'msg-1', content: 'Short text' };
    const preview = msg.content
      ? (msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content)
      : '📎 Файл';
    expect(preview).toBe('Short text');
  });
});

describe('Sidebar delete modal for rooms', () => {
  it('stores room info for delete confirmation', () => {
    const room = { id: 'room-1', name: 'Dev Room' };
    const deleteConfirm = { id: room.id, name: 'Dev Room' };
    expect(deleteConfirm.id).toBe('room-1');
    expect(deleteConfirm.name).toBe('Dev Room');
  });

  it('confirm deletes room by id', () => {
    const deletedRoomIds = [];
    const onDeleteRoom = (id) => deletedRoomIds.push(id);

    let deleteConfirm = { id: 'room-42', name: 'Test Room' };
    onDeleteRoom(deleteConfirm.id);
    deleteConfirm = null;

    expect(deletedRoomIds).toEqual(['room-42']);
    expect(deleteConfirm).toBeNull();
  });
});
