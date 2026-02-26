export interface ChildProps {
	children: React.ReactNode
}

export interface IError extends Error {
	response: { data: { message?: string; error?: string } }
}

/** BarsikChat user (from /api/chat/contacts or /api/profile) */
export interface IUser {
	username: string
	online: boolean
	lastSeen: string | null
	avatarUrl: string | null
	tag: string | null
	firstName?: string
	lastName?: string
	bio?: string
}

/** BarsikChat room (from /api/rooms) */
export interface IRoom {
	id: string
	name: string
	type: 'PRIVATE' | 'GROUP' | 'GENERAL' | 'SAVED'
	members: string[]
	createdBy: string
	createdAt: string
	description?: string
	avatarUrl?: string
	/** Client-side: last message for sidebar display */
	lastMessage?: IMessage | null
}

/** BarsikChat message (from /api/rooms/{id}/history or WebSocket) */
export interface IMessage {
	id: string
	sender: string
	content: string
	timestamp: string
	type: string
	roomId: string
	fileUrl?: string
	fileName?: string
	fileSize?: number
	fileType?: string
	status?: string
	edited?: boolean
	replyToId?: string
	replyToSender?: string
	replyToContent?: string
}

/** Auth response from /api/auth/login or /api/auth/register */
export interface IAuthResponse {
	token: string
	username: string
	role: string
	avatarUrl: string | null
	tag: string | null
}

/** Stored session in localStorage */
export interface ISession {
	token: string
	username: string
	role: string
	avatarUrl: string | null
	tag: string | null
}
