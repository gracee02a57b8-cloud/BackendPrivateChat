'use client'

import { useCurrentContact } from '@/hooks/use-current'
import { useAuth } from '@/hooks/use-auth'
import { CONST } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { IMessage } from '@/types'
import { Check, CheckCheck, Edit2, Trash } from 'lucide-react'
import { FC } from 'react'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../ui/context-menu'

interface Props {
	message: IMessage
	onDeleteMessage: (messageId: string) => Promise<void>
}
const MessageCard: FC<Props> = ({ message, onDeleteMessage }) => {
	const { setEditedMessage } = useCurrentContact()
	const { session } = useAuth()

	const isMine = message.sender === session?.username

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					className={cn(
						'm-2.5 font-medium text-xs flex',
						isMine ? 'justify-end' : 'justify-start'
					)}
				>
					<div
						className={cn(
							'relative inline p-2 pl-2.5 pr-12 max-w-full rounded-lg',
							isMine ? 'bg-primary' : 'bg-secondary'
						)}
					>
						{/* Sender name for group chats */}
						{!isMine && (
							<p className='text-[10px] font-bold text-blue-400 mb-0.5'>{message.sender}</p>
						)}

						{/* File attachment */}
						{message.fileUrl && (
							<a href={message.fileUrl} target='_blank' rel='noreferrer' className='text-blue-300 underline text-xs block mb-1'>
								📎 {message.fileName || 'Файл'}
							</a>
						)}

						{/* Message text */}
						{message.content && message.content.length > 0 && (
							<p className={cn('text-sm', isMine ? 'text-white' : 'text-foreground')}>
								{message.content}
							</p>
						)}

						{/* Edited indicator */}
						{message.edited && (
							<span className='text-[9px] opacity-50 mr-1'>ред.</span>
						)}

						{/* Time and status */}
						<div className='right-1 bottom-0 absolute opacity-60 text-[9px] flex gap-[3px]'>
							<p>{formatMsgTime(message.timestamp)}</p>
							<div className='self-end'>
								{isMine && (
									message.status === CONST.READ ? <CheckCheck size={12} className='text-blue-300' /> : <Check size={12} />
								)}
							</div>
						</div>
					</div>
				</div>
			</ContextMenuTrigger>
			<ContextMenuContent className='w-56 p-0 mb-10'>
				{isMine && (
					<>
						<ContextMenuItem className='cursor-pointer' onClick={() => setEditedMessage(message)}>
							<Edit2 size={14} className='mr-2' />
							<span>Редактировать</span>
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem className='cursor-pointer' onClick={() => onDeleteMessage(message.id)}>
							<Trash size={14} className='mr-2' />
							<span>Удалить</span>
						</ContextMenuItem>
					</>
				)}
			</ContextMenuContent>
		</ContextMenu>
	)
}

function formatMsgTime(timestamp: string): string {
	try {
		const date = new Date(timestamp.replace(' ', 'T'))
		const hours = date.getHours().toString().padStart(2, '0')
		const minutes = date.getMinutes().toString().padStart(2, '0')
		return `${hours}:${minutes}`
	} catch {
		return ''
	}
}

export default MessageCard
