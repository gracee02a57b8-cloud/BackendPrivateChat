import { z } from 'zod'

export const loginSchema = z.object({
	username: z.string().min(1, { message: 'Имя пользователя обязательно' }),
	password: z.string().min(1, { message: 'Пароль обязателен' }),
})

export const registerSchema = z.object({
	username: z.string().min(1, { message: 'Имя пользователя обязательно' }).max(20, { message: 'Не более 20 символов' }),
	password: z.string().min(8, { message: 'Пароль не менее 8 символов' }),
	tag: z.string().min(2, { message: 'Тег: 2-24 символа (латиница, цифры, _)' }),
})

export const messageSchema = z.object({
	text: z.string().min(1, { message: 'Сообщение не может быть пустым' }),
})

export const searchSchema = z.object({
	query: z.string().min(1, { message: 'Введите имя пользователя или тег' }),
})
