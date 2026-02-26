'use client'

import { Loader2 } from 'lucide-react'
import ContactList from './_components/contact-list'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import AddContact from './_components/add-contact'
import { useCurrentContact } from '@/hooks/use-current'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { messageSchema, searchSchema } from '@/lib/validation'
import { zodResolver } from '@hookform/resolvers/zod'
import TopChat from './_components/top-chat'
import Chat from './_components/chat'
import { useLoading } from '@/hooks/use-loading'
import { axiosClient } from '@/http/axios'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'
import { socket } from '@/lib/socket'
import { IMessage, IRoom } from '@/types'

const HomePage = () => {
	const [rooms, setRooms] = useState<IRoom[]>([])
	const [messages, setMessages] = useState<IMessage[]>([])

	const { setLoading, isLoading, setLoadMessages, setTyping } = useLoading()
	const { currentRoom, editedMessage, setEditedMessage } = useCurrentContact()
	const { session } = useAuth()

	const socketInitialized = useRef(false)

	const contactForm = useForm<z.infer<typeof searchSchema>>({
		resolver: zodResolver(searchSchema),
		defaultValues: { query: '' },
	})

	const messageForm = useForm<z.infer<typeof messageSchema>>({
		resolver: zodResolver(messageSchema),
		defaultValues: { text: '' },
	})

	/** Fetch rooms list */
	const getRooms = async () => {
		setLoading(true)
		try {
			const { data } = await axiosClient.get<IRoom[]>('/api/rooms')
			// For each room, fetch last message
			const roomsWithLastMsg = await Promise.all(
				data.map(async (room) => {
					try {
						const { data: msgs } = await axiosClient.get<IMessage[]>(
							`/api/rooms/${room.id}/history?page=0&size=1`
						)
						return { ...room, lastMessage: msgs.length > 0 ? msgs[0] : null }
					} catch {
						return { ...room, lastMessage: null }
					}
				})
			)
			setRooms(roomsWithLastMsg)
		} catch {
			toast({ description: 'Не удалось загрузить чаты', variant: 'destructive' })
		} finally {
			setLoading(false)
		}
	}

	/** Fetch messages for current room */
	const getMessages = async () => {
		if (!currentRoom) return
		setLoadMessages(true)
		try {
			const { data } = await axiosClient.get<IMessage[]>(
				`/api/rooms/${currentRoom.id}/history?page=0&size=100`
			)
			setMessages(data)
		} catch {
			toast({ description: 'Не удалось загрузить сообщения', variant: 'destructive' })
		} finally {
			setLoadMessages(false)
		}
	}

	/** Connect WebSocket and set up listeners */
	useEffect(() => {
		if (!session?.token || socketInitialized.current) return
		socketInitialized.current = true

		socket.connect(session.token)

		// New chat message
		socket.on('CHAT', (msg) => {
			// Add to messages if viewing this room
			setMessages(prev => {
				if (prev.length > 0 && prev[0]?.roomId === msg.roomId) {
					// Avoid duplicates
					if (prev.some(m => m.id === msg.id)) return prev
					return [...prev, msg]
				}
				// Not viewing this room — still update last message in sidebar
				return prev
			})
			// Update last message in room list
			setRooms(prev =>
				prev.map(r => (r.id === msg.roomId ? { ...r, lastMessage: msg } : r))
			)
		})

		// Voice / video circle also goes to chat
		socket.on('VOICE', (msg) => {
			setMessages(prev => {
				if (prev.length > 0 && prev[0]?.roomId === msg.roomId) {
					if (prev.some(m => m.id === msg.id)) return prev
					return [...prev, msg]
				}
				return prev
			})
			setRooms(prev =>
				prev.map(r => (r.id === msg.roomId ? { ...r, lastMessage: msg } : r))
			)
		})

		// Typing indicator
		socket.on('TYPING', (msg) => {
			setTyping({ sender: msg.sender, message: 'печатает...' })
			// Auto-clear after 3s
			setTimeout(() => setTyping({ sender: null, message: '' }), 3000)
		})

		// Message status updates
		socket.on('STATUS_UPDATE', (msg) => {
			setMessages(prev =>
				prev.map(m => (m.id === msg.id ? { ...m, status: msg.status } : m))
			)
		})

		// Message edited
		socket.on('EDIT', (msg) => {
			setMessages(prev =>
				prev.map(m => (m.id === msg.id ? { ...m, content: msg.content, edited: true } : m))
			)
		})

		// Message deleted
		socket.on('DELETE', (msg) => {
			setMessages(prev => prev.filter(m => m.id !== msg.id))
		})

		return () => {
			socket.disconnect()
			socketInitialized.current = false
		}
	}, [session?.token])

	/** Fetch rooms on mount */
	useEffect(() => {
		if (session) getRooms()
	}, [session])

	/** Fetch messages when room changes */
	useEffect(() => {
		if (currentRoom) {
			getMessages()
			// Send READ_RECEIPT
			socket.send({ type: 'READ_RECEIPT', roomId: currentRoom.id })
		}
	}, [currentRoom?.id])

	/** Create a private room with a user */
	const onCreateContact = async (values: z.infer<typeof searchSchema>) => {
		try {
			const { data: room } = await axiosClient.post<IRoom>(`/api/rooms/private/${values.query}`)
			setRooms(prev => {
				const exists = prev.some(r => r.id === room.id)
				return exists ? prev : [...prev, { ...room, lastMessage: null }]
			})
			toast({ description: 'Чат создан!' })
			contactForm.reset()
		} catch (error: unknown) {
			const err = error as { response?: { data?: { error?: string }; status?: number } }
			if (err?.response?.status === 400) {
				toast({ description: 'Нельзя создать чат с самим собой', variant: 'destructive' })
			} else {
				toast({ description: 'Пользователь не найден', variant: 'destructive' })
			}
		}
	}

	/** Send or edit a message */
	const onSubmitMessage = async (values: z.infer<typeof messageSchema>) => {
		if (!currentRoom) return
		if (editedMessage) {
			// Edit message
			socket.send({
				type: 'EDIT',
				id: editedMessage.id,
				roomId: currentRoom.id,
				content: values.text,
			})
			setMessages(prev =>
				prev.map(m => (m.id === editedMessage.id ? { ...m, content: values.text, edited: true } : m))
			)
			setEditedMessage(null)
		} else {
			// Send new message
			socket.send({
				type: 'CHAT',
				content: values.text,
				roomId: currentRoom.id,
			})
		}
		messageForm.reset()
	}

	/** Send read receipts */
	const onReadMessages = async () => {
		if (!currentRoom) return
		socket.send({ type: 'READ_RECEIPT', roomId: currentRoom.id })
	}

	/** Delete a message */
	const onDeleteMessage = async (messageId: string) => {
		if (!currentRoom) return
		socket.send({
			type: 'DELETE',
			id: messageId,
			roomId: currentRoom.id,
		})
		setMessages(prev => prev.filter(m => m.id !== messageId))
	}

	/** Typing indicator */
	const onTyping = (e: ChangeEvent<HTMLInputElement>) => {
		if (!currentRoom) return
		if (e.target.value.length > 0) {
			socket.send({ type: 'TYPING', roomId: currentRoom.id })
		}
	}

	return (
		<>
			<div className='w-80 max-md:w-16 h-screen border-r fixed inset-0 z-50'>
				{isLoading && (
					<div className='w-full h-[95vh] flex justify-center items-center'>
						<Loader2 size={50} className='animate-spin' />
					</div>
				)}
				{!isLoading && <ContactList rooms={rooms} />}
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
