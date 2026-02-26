'use client'

import ContactList from './_components/contact-list'
import { ChangeEvent, useEffect, useState } from 'react'
import AddContact from './_components/add-contact'
import { useCurrentContact } from '@/hooks/use-current'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { messageSchema, searchSchema } from '@/lib/validation'
import { zodResolver } from '@hookform/resolvers/zod'
import TopChat from './_components/top-chat'
import Chat from './_components/chat'
import { IMessage, IRoom } from '@/types'
import { MOCK_ROOMS, MOCK_MESSAGES } from '@/lib/mock-data'

const HomePage = () => {
	const [rooms, setRooms] = useState<IRoom[]>([])
	const [messages, setMessages] = useState<IMessage[]>([])

	const { currentRoom, editedMessage, setEditedMessage } = useCurrentContact()

	const contactForm = useForm<z.infer<typeof searchSchema>>({
		resolver: zodResolver(searchSchema),
		defaultValues: { query: '' },
	})

	const messageForm = useForm<z.infer<typeof messageSchema>>({
		resolver: zodResolver(messageSchema),
		defaultValues: { text: '' },
	})

	/** Load mock rooms on mount */
	useEffect(() => {
		setRooms(MOCK_ROOMS)
	}, [])

	/** Load mock messages when room changes */
	useEffect(() => {
		if (currentRoom) {
			setMessages(MOCK_MESSAGES[currentRoom.id] || [])
		}
	}, [currentRoom?.id])

	/** Create contact — mock only, just add to list */
	const onCreateContact = async (values: z.infer<typeof searchSchema>) => {
		const newRoom: IRoom = {
			id: String(Date.now()),
			name: 'Личный чат',
			type: 'PRIVATE',
			members: ['Алексей', values.query],
			createdBy: 'Алексей',
			createdAt: new Date().toISOString(),
			lastMessage: null,
		}
		setRooms(prev => [...prev, newRoom])
		contactForm.reset()
	}

	/** Send message — mock only, add locally */
	const onSubmitMessage = async (values: z.infer<typeof messageSchema>) => {
		if (!currentRoom) return
		if (editedMessage) {
			setMessages(prev =>
				prev.map(m => (m.id === editedMessage.id ? { ...m, content: values.text, edited: true } : m))
			)
			setEditedMessage(null)
		} else {
			const newMsg: IMessage = {
				id: String(Date.now()),
				sender: 'Алексей',
				content: values.text,
				timestamp: new Date().toISOString(),
				type: 'CHAT',
				roomId: currentRoom.id,
				status: 'SENT',
			}
			setMessages(prev => [...prev, newMsg])
			setRooms(prev =>
				prev.map(r => (r.id === currentRoom.id ? { ...r, lastMessage: newMsg } : r))
			)
		}
		messageForm.reset()
	}

	/** Read receipts — no-op in mock mode */
	const onReadMessages = async () => {}

	/** Delete message — mock only, remove locally */
	const onDeleteMessage = async (messageId: string) => {
		setMessages(prev => prev.filter(m => m.id !== messageId))
	}

	/** Typing — no-op in mock mode */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const onTyping = (_e: ChangeEvent<HTMLInputElement>) => {}

	return (
		<>
			<div className='w-80 max-md:w-16 h-screen border-r fixed inset-0 z-50'>
				<ContactList rooms={rooms} />
			</div>
			<div className='max-md:pl-16 pl-80 w-full'>
				{!currentRoom?.id && <AddContact contactForm={contactForm} onCreateContact={onCreateContact} />}
				{currentRoom?.id && (
					<div className='w-full relative'>
						<TopChat />
						<Chat
							messageForm={messageForm}
							onSubmitMessage={onSubmitMessage}
							messages={messages}
							onReadMessages={onReadMessages}
							onDeleteMessage={onDeleteMessage}
							onTyping={onTyping}
						/>
					</div>
				)}
			</div>
		</>
	)
}

export default HomePage
