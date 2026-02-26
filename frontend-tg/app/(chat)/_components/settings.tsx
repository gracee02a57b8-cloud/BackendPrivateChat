'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/use-auth'
import { LogIn, Menu, Moon, Sun, UserPlus } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'

const Settings = () => {
	const { resolvedTheme, setTheme } = useTheme()
	const { session, logout } = useAuth()
	const router = useRouter()

	const onLogout = () => {
		logout()
		router.replace('/auth')
	}

	const displayName = session?.username || 'User'
	const initial = displayName.charAt(0).toUpperCase()

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button size={'icon'} variant={'secondary'} className='max-md:w-full'>
					<Menu />
				</Button>
			</PopoverTrigger>
			<PopoverContent className='p-0 w-80'>
				<div className='flex items-center gap-2 p-3'>
					<Avatar>
						<AvatarImage src={session?.avatarUrl || ''} alt={displayName} className='object-cover' />
						<AvatarFallback className='uppercase bg-primary text-primary-foreground'>{initial}</AvatarFallback>
					</Avatar>
					<div>
						<p className='font-medium text-sm'>{displayName}</p>
						{session?.tag && <p className='text-xs text-muted-foreground'>{session.tag}</p>}
					</div>
				</div>
				<Separator />
				<div className='flex flex-col'>
					<div
						className='flex justify-between items-center p-2 hover:bg-secondary cursor-pointer'
						onClick={() => window.location.reload()}
					>
						<div className='flex items-center gap-1'>
							<UserPlus size={16} />
							<span className='text-sm'>Новый чат</span>
						</div>
					</div>

					<div className='flex justify-between items-center p-2 hover:bg-secondary'>
						<div className='flex items-center gap-1'>
							{resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
							<span className='text-sm'>{resolvedTheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span>
						</div>
						<Switch
							checked={resolvedTheme === 'dark'}
							onCheckedChange={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
						/>
					</div>

					<div className='flex justify-between items-center bg-destructive p-2 cursor-pointer' onClick={onLogout}>
						<div className='flex items-center gap-1'>
							<LogIn size={16} />
							<span className='text-sm'>Выйти</span>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default Settings
