'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useCurrentContact } from '@/hooks/use-current'
import { useLoading } from '@/hooks/use-loading'
import { useAuth } from '@/hooks/use-auth'
import { FC } from 'react'

const TopChat: FC = () => {
	const { currentRoom } = useCurrentContact()
	const { typing } = useLoading()
	const { session } = useAuth()

	if (!currentRoom) return null

	const displayName =
		currentRoom.type === 'PRIVATE'
			? currentRoom.members.find(m => m !== session?.username) || currentRoom.name
			: currentRoom.name

	const initial = displayName.charAt(0).toUpperCase()
	const avatarUrl = currentRoom.avatarUrl || ''

	const isTyping = typing.sender && typing.message

	return (
		<div className='w-full flex items-center justify-between sticky top-0 z-50 h-[8vh] p-2 border-b bg-background'>
			<div className='flex items-center'>
				<Avatar className='z-40'>
					<AvatarImage src={avatarUrl} alt={displayName} className='object-cover' />
					<AvatarFallback className='uppercase bg-primary text-primary-foreground'>{initial}</AvatarFallback>
				</Avatar>
				<div className='ml-2'>
					<h2 className='font-medium text-sm'>{displayName}</h2>

					{isTyping ? (
						<div className='text-xs flex items-center gap-1 text-muted-foreground'>
							<p className='text-secondary-foreground animate-pulse line-clamp-1'>
								{typing.sender} {typing.message}
							</p>
							<div className='self-end mb-1'>
								<div className='flex justify-center items-center gap-1'>
									<div className='w-1 h-1 bg-secondary-foreground rounded-full animate-bounce [animation-delay:-0.3s]' />
									<div className='w-1 h-1 bg-secondary-foreground rounded-full animate-bounce [animation-delay:-0.10s]' />
									<div className='w-1 h-1 bg-secondary-foreground rounded-full animate-bounce [animation-delay:-0.15s]' />
								</div>
							</div>
						</div>
					) : (
						<p className='text-xs text-muted-foreground'>
							{currentRoom.type === 'PRIVATE' ? (
								<>
									<span className='text-muted-foreground'>●</span> Был(а) недавно
								</>
							) : (
								<>{currentRoom.members.length} участник(ов)</>
							)}
						</p>
					)}
				</div>
			</div>
		</div>
	)
}

export default TopChat
