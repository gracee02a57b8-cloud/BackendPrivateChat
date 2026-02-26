import { IMessage, IRoom } from '@/types'
import { create } from 'zustand'

type Store = {
	currentRoom: IRoom | null
	setCurrentRoom: (room: IRoom | null) => void
	editedMessage: IMessage | null
	setEditedMessage: (message: IMessage | null) => void
}

export const useCurrentContact = create<Store>()(set => ({
	currentRoom: null,
	setCurrentRoom: room => set({ currentRoom: room }),
	editedMessage: null,
	setEditedMessage: message => set({ editedMessage: message }),
}))
