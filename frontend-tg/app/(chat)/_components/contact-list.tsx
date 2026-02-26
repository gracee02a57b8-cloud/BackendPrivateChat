'use client'

import { IRoom } from '@/types'
import React, { FC, useState } from 'react'
import Settings from './settings'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, sliceText } from '@/lib/utils'
import { useCurrentContact } from '@/hooks/use-current'
import { useAuth } from '@/hooks/use-auth'
import { format } from 'date-fns'
import { CONST } from '@/lib/constants'

interface Props {
	rooms: IRoom[]
}
const ContactList: FC<Props> = ({ rooms }) => {
	const [query, setQuery] = useState('')
	const { session } = useAuth()
	const { setCurrentRoom, currentRoom } = useCurrentContact()

	const filteredRooms = rooms
		.filter(room => {
			const displayName = getRoomDisplayName(room, session?.username || '')
			return displayName.toLowerCase().includes(query.toLowerCase())
		})
		.sort((a, b) => {
			const dateA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0
			const dateB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0
			return dateB - dateA
		})

	const renderRoom = (room: IRoom) => {
		const onChat = () => {
			if (currentRoom?.id === room.id) return
			setCurrentRoom(room)
		}

		const displayName = getRoomDisplayName(room, session?.username || '')
		const avatarUrl = room.avatarUrl || ''
		const initial = displayName.charAt(0).toUpperCase()

		return (
			<div
				className={cn(
					'flex justify-between items-center cursor-pointer hover:bg-secondary/50 md:p-2',
					currentRoom?.id === room.id && 'bg-secondary/50'
				)}
				onClick={onChat}
			>
				<div className='flex items-center gap-2'>
					<div className='relative'>
						<Avatar className='z-40'>
							<AvatarImage src={avatarUrl} alt={displayName} className='object-cover' />
							<AvatarFallback className='uppercase bg-primary text-primary-foreground'>{initial}</AvatarFallback>
						</Avatar>
					</div>

					<div className='max-md:hidden'>
						<h2 className='capitalize line-clamp-1 text-sm'>{displayName}</h2>
						{room.lastMessage && (
							<p
								className={cn(
									'text-xs line-clamp-1',
									room.lastMessage.sender === session?.username
										? 'text-muted-foreground'
										: room.lastMessage.status !== CONST.READ
											? 'text-foreground'
											: 'text-muted-foreground'
								)}
							>
								{room.lastMessage.sender !== session?.username && (
									<span className='font-medium'>{room.lastMessage.sender}: </span>
								)}
								{sliceText(room.lastMessage.content || '', 25)}
							</p>
						)}
						{!room.lastMessage && (
							<p className='text-xs text-muted-foreground'>Нет сообщений</p>
						)}
					</div>
				</div>
				{room.lastMessage && (
					<div className='self-end max-md:hidden'>
						<p className='text-xs text-muted-foreground'>
							{formatTime(room.lastMessage.timestamp)}
						</p>
					</div>
				)}
			</div>
		)
	}

	return (
		<>
			{/* Top bar */}
			<div className='flex items-center bg-background md:pl-2 sticky top-0 z-50'>
				<Settings />
				<div className='md:m-2 w-full max-md:hidden'>
					<Input
						className='bg-secondary'
						value={query}
						onChange={e => setQuery(e.target.value)}
						type='text'
						placeholder='Поиск...'
					/>
				</div>
			</div>
			<div className='max-md:mt-2'>
				{filteredRooms.length === 0 ? (
					<div className='w-full h-[95vh] flex justify-center items-center text-center text-muted-foreground'>
						<p>Список чатов пуст</p>
					</div>
				) : (
					filteredRooms.map(room => <div key={room.id}>{renderRoom(room)}</div>)
				)}
			</div>
		</>
	)
}

/** Get display name: for private rooms, show the other user's name */
function getRoomDisplayName(room: IRoom, myUsername: string): string {
	if (room.type === 'PRIVATE') {
		const other = room.members.find(m => m !== myUsername)
		return other || room.name
	}
	return room.name
}

/** Format timestamp for sidebar */
function formatTime(timestamp: string): string {
	try {
		const date = new Date(timestamp.replace(' ', 'T'))
		const now = new Date()
		const isToday = date.toDateString() === now.toDateString()
		if (isToday) {
			return format(date, 'HH:mm')
		}
		return format(date, 'dd.MM')
	} catch {
		return ''
	}
}

export default ContactList
