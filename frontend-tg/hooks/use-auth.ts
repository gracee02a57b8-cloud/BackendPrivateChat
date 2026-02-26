import { ISession, IUser } from '@/types'
import { create } from 'zustand'

type AuthStore = {
	session: ISession | null
	setSession: (session: ISession | null) => void
	onlineUsers: IUser[]
	setOnlineUsers: (users: IUser[]) => void
	logout: () => void
}

export const useAuth = create<AuthStore>()(set => ({
	session: null,
	setSession: session => set({ session }),
	onlineUsers: [],
	setOnlineUsers: users => set({ onlineUsers: users }),
	logout: () => {
		if (typeof window !== 'undefined') {
			localStorage.removeItem('barsik_session')
		}
		set({ session: null })
	},
}))

/** Load session from localStorage on app start */
export function loadSession(): ISession | null {
	if (typeof window === 'undefined') return null
	const raw = localStorage.getItem('barsik_session')
	if (!raw) return null
	try {
		return JSON.parse(raw)
	} catch {
		return null
	}
}

/** Save session to localStorage */
export function saveSession(session: ISession) {
	if (typeof window !== 'undefined') {
		localStorage.setItem('barsik_session', JSON.stringify(session))
	}
}
