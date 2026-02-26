'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { axiosClient } from '@/http/axios'
import { loginSchema, registerSchema } from '@/lib/validation'
import { IAuthResponse } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { FaTelegram } from 'react-icons/fa'
import { ModeToggle } from '@/components/shared/mode-toggle'
import { saveSession } from '@/hooks/use-auth'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'

const AuthPage = () => {
	const [mode, setMode] = useState<'login' | 'register'>('login')
	const [loading, setLoading] = useState(false)
	const router = useRouter()

	const loginForm = useForm<z.infer<typeof loginSchema>>({
		resolver: zodResolver(loginSchema),
		defaultValues: { username: '', password: '' },
	})

	const registerForm = useForm<z.infer<typeof registerSchema>>({
		resolver: zodResolver(registerSchema),
		defaultValues: { username: '', password: '', tag: '' },
	})

	const onLogin = async (values: z.infer<typeof loginSchema>) => {
		setLoading(true)
		try {
			const { data } = await axiosClient.post<IAuthResponse>('/api/auth/login', values)
			saveSession({
				token: data.token,
				username: data.username,
				role: data.role,
				avatarUrl: data.avatarUrl,
				tag: data.tag,
			})
			router.replace('/')
		} catch (error: unknown) {
			const err = error as { response?: { data?: { error?: string } } }
			toast({ description: err?.response?.data?.error || 'Ошибка входа', variant: 'destructive' })
		} finally {
			setLoading(false)
		}
	}

	const onRegister = async (values: z.infer<typeof registerSchema>) => {
		setLoading(true)
		try {
			const { data } = await axiosClient.post<IAuthResponse>('/api/auth/register', values)
			saveSession({
				token: data.token,
				username: data.username,
				role: data.role,
				avatarUrl: data.avatarUrl,
				tag: data.tag,
			})
			router.replace('/')
		} catch (error: unknown) {
			const err = error as { response?: { data?: { error?: string } } }
			toast({ description: err?.response?.data?.error || 'Ошибка регистрации', variant: 'destructive' })
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className='container max-w-md w-full h-screen flex justify-center items-center flex-col space-y-4'>
			<FaTelegram size={120} className='text-blue-500' />
			<div className='flex items-center gap-2'>
				<h1 className='text-4xl font-bold'>BarsikChat</h1>
				<ModeToggle />
			</div>
			<p className='text-center text-muted-foreground text-sm'>
				Быстрый и безопасный мессенджер
			</p>

			{mode === 'login' ? (
				<div className='w-full'>
					<Form {...loginForm}>
						<form onSubmit={loginForm.handleSubmit(onLogin)} className='space-y-2'>
							<FormField
								control={loginForm.control}
								name='username'
								render={({ field }) => (
									<FormItem>
										<Label>Имя пользователя или @тег</Label>
										<FormControl>
											<Input placeholder='username' disabled={loading} className='h-10 bg-secondary' {...field} />
										</FormControl>
										<FormMessage className='text-xs text-red-500' />
									</FormItem>
								)}
							/>
							<FormField
								control={loginForm.control}
								name='password'
								render={({ field }) => (
									<FormItem>
										<Label>Пароль</Label>
										<FormControl>
											<Input placeholder='••••••••' type='password' disabled={loading} className='h-10 bg-secondary' {...field} />
										</FormControl>
										<FormMessage className='text-xs text-red-500' />
									</FormItem>
								)}
							/>
							<Button type='submit' className='w-full' size='lg' disabled={loading}>
								{loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
								Войти
							</Button>
						</form>
					</Form>
					<p className='text-center text-sm mt-4 text-muted-foreground'>
						Нет аккаунта?{' '}
						<span className='text-primary cursor-pointer hover:underline' onClick={() => setMode('register')}>
							Зарегистрироваться
						</span>
					</p>
				</div>
			) : (
				<div className='w-full'>
					<Form {...registerForm}>
						<form onSubmit={registerForm.handleSubmit(onRegister)} className='space-y-2'>
							<FormField
								control={registerForm.control}
								name='username'
								render={({ field }) => (
									<FormItem>
										<Label>Имя пользователя</Label>
										<FormControl>
											<Input placeholder='username' disabled={loading} className='h-10 bg-secondary' {...field} />
										</FormControl>
										<FormMessage className='text-xs text-red-500' />
									</FormItem>
								)}
							/>
							<FormField
								control={registerForm.control}
								name='tag'
								render={({ field }) => (
									<FormItem>
										<Label>Тег</Label>
										<FormControl>
											<Input placeholder='@mytag' disabled={loading} className='h-10 bg-secondary' {...field} />
										</FormControl>
										<FormMessage className='text-xs text-red-500' />
									</FormItem>
								)}
							/>
							<FormField
								control={registerForm.control}
								name='password'
								render={({ field }) => (
									<FormItem>
										<Label>Пароль</Label>
										<FormControl>
											<Input placeholder='Минимум 8 символов' type='password' disabled={loading} className='h-10 bg-secondary' {...field} />
										</FormControl>
										<FormMessage className='text-xs text-red-500' />
									</FormItem>
								)}
							/>
							<Button type='submit' className='w-full' size='lg' disabled={loading}>
								{loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
								Зарегистрироваться
							</Button>
						</form>
					</Form>
					<p className='text-center text-sm mt-4 text-muted-foreground'>
						Уже есть аккаунт?{' '}
						<span className='text-primary cursor-pointer hover:underline' onClick={() => setMode('login')}>
							Войти
						</span>
					</p>
				</div>
			)}
		</div>
	)
}

export default AuthPage
