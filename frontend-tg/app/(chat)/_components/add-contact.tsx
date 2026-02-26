'use client'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLoading } from '@/hooks/use-loading'
import { searchSchema } from '@/lib/validation'
import { FC } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { FaTelegram } from 'react-icons/fa'
import { z } from 'zod'

interface Props {
	contactForm: UseFormReturn<z.infer<typeof searchSchema>>
	onCreateContact: (values: z.infer<typeof searchSchema>) => void
}
const AddContact: FC<Props> = ({ contactForm, onCreateContact }) => {
	const { isCreating } = useLoading()

	return (
		<div className='h-screen w-full flex z-40 relative'>
			<div className='flex justify-center items-center z-50 w-full'>
				<div className='flex flex-col items-center gap-4'>
					<FaTelegram size={120} className='dark:text-blue-400 text-blue-500' />
					<h1 className='text-3xl font-spaceGrotesk font-bold'>Начните общение</h1>
					<p className='text-muted-foreground text-sm text-center max-w-sm'>
						Введите имя пользователя, чтобы начать приватный чат
					</p>
					<Form {...contactForm}>
						<form onSubmit={contactForm.handleSubmit(onCreateContact)} className='space-y-2 w-full'>
							<FormField
								control={contactForm.control}
								name='query'
								render={({ field }) => (
									<FormItem>
										<Label>Имя пользователя</Label>
										<FormControl>
											<Input placeholder='username' disabled={isCreating} className='h-10 bg-secondary' {...field} />
										</FormControl>
										<FormMessage className='text-xs text-red-500' />
									</FormItem>
								)}
							/>
							<Button type='submit' className='w-full' size={'lg'} disabled={isCreating}>
								Начать чат
							</Button>
						</form>
					</Form>
				</div>
			</div>
		</div>
	)
}

export default AddContact
