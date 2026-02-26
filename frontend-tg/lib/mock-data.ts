import { IMessage, IRoom, ISession } from '@/types'

/** Mock session — fake logged-in user */
export const MOCK_SESSION: ISession = {
	token: 'mock-token',
	username: 'Алексей',
	role: 'USER',
	avatarUrl: null,
	tag: '@alexey',
}

/** Mock rooms */
export const MOCK_ROOMS: IRoom[] = [
	{
		id: '1',
		name: 'Личный чат',
		type: 'PRIVATE',
		members: ['Алексей', 'Мария'],
		createdBy: 'Алексей',
		createdAt: '2026-02-26T09:00:00',
		lastMessage: {
			id: 'm6',
			sender: 'Мария',
			content: 'Хорошо, до встречи! 👋',
			timestamp: '2026-02-26T14:32:00',
			type: 'CHAT',
			roomId: '1',
			status: 'DELIVERED',
		},
	},
	{
		id: '2',
		name: 'Рабочий чат',
		type: 'GROUP',
		members: ['Алексей', 'Мария', 'Дмитрий', 'Елена', 'Иван'],
		createdBy: 'Дмитрий',
		createdAt: '2026-02-20T10:00:00',
		description: 'Рабочие обсуждения команды',
		lastMessage: {
			id: 'm10',
			sender: 'Дмитрий',
			content: 'Деплой прошёл успешно ✅',
			timestamp: '2026-02-26T13:15:00',
			type: 'CHAT',
			roomId: '2',
			status: 'READ',
		},
	},
	{
		id: '3',
		name: 'Личный чат',
		type: 'PRIVATE',
		members: ['Алексей', 'Иван'],
		createdBy: 'Иван',
		createdAt: '2026-02-25T08:00:00',
		lastMessage: {
			id: 'm15',
			sender: 'Алексей',
			content: 'Скинь ссылку на репозиторий',
			timestamp: '2026-02-26T11:45:00',
			type: 'CHAT',
			roomId: '3',
			status: 'READ',
		},
	},
	{
		id: '4',
		name: 'BarsikChat News',
		type: 'GROUP',
		members: ['Алексей', 'Мария', 'Дмитрий'],
		createdBy: 'Алексей',
		createdAt: '2026-02-18T12:00:00',
		description: 'Новости и обновления BarsikChat',
		lastMessage: {
			id: 'm20',
			sender: 'Алексей',
			content: 'Вышло обновление v2.0! 🎉',
			timestamp: '2026-02-25T18:00:00',
			type: 'CHAT',
			roomId: '4',
			status: 'READ',
		},
	},
	{
		id: '5',
		name: 'Личный чат',
		type: 'PRIVATE',
		members: ['Алексей', 'Елена'],
		createdBy: 'Алексей',
		createdAt: '2026-02-22T15:00:00',
		lastMessage: {
			id: 'm25',
			sender: 'Елена',
			content: 'Спасибо за помощь! 🙏',
			timestamp: '2026-02-25T16:30:00',
			type: 'CHAT',
			roomId: '5',
			status: 'READ',
		},
	},
]

/** Mock messages per room */
export const MOCK_MESSAGES: Record<string, IMessage[]> = {
	'1': [
		{ id: 'm1', sender: 'Мария', content: 'Привет! Как дела?', timestamp: '2026-02-26T14:00:00', type: 'CHAT', roomId: '1', status: 'READ' },
		{ id: 'm2', sender: 'Алексей', content: 'Привет! Всё отлично, работаю над проектом 💻', timestamp: '2026-02-26T14:05:00', type: 'CHAT', roomId: '1', status: 'READ' },
		{ id: 'm3', sender: 'Мария', content: 'О, над каким?', timestamp: '2026-02-26T14:10:00', type: 'CHAT', roomId: '1', status: 'READ' },
		{ id: 'm4', sender: 'Алексей', content: 'BarsikChat — мессенджер как Telegram 😄', timestamp: '2026-02-26T14:15:00', type: 'CHAT', roomId: '1', status: 'READ' },
		{ id: 'm5', sender: 'Мария', content: 'Круто! Покажешь когда будет готово?', timestamp: '2026-02-26T14:20:00', type: 'CHAT', roomId: '1', status: 'READ' },
		{ id: 'm6', sender: 'Мария', content: 'Хорошо, до встречи! 👋', timestamp: '2026-02-26T14:32:00', type: 'CHAT', roomId: '1', status: 'DELIVERED' },
	],
	'2': [
		{ id: 'm7', sender: 'Дмитрий', content: 'Всем привет! Стендап через 10 минут', timestamp: '2026-02-26T10:00:00', type: 'CHAT', roomId: '2', status: 'READ' },
		{ id: 'm8', sender: 'Елена', content: 'Ок, буду 👍', timestamp: '2026-02-26T10:02:00', type: 'CHAT', roomId: '2', status: 'READ' },
		{ id: 'm9', sender: 'Алексей', content: 'Сейчас допишу тесты и подключусь', timestamp: '2026-02-26T10:03:00', type: 'CHAT', roomId: '2', status: 'READ' },
		{ id: 'm10', sender: 'Дмитрий', content: 'Деплой прошёл успешно ✅', timestamp: '2026-02-26T13:15:00', type: 'CHAT', roomId: '2', status: 'READ' },
	],
	'3': [
		{ id: 'm11', sender: 'Иван', content: 'Привет, можешь помочь с Docker?', timestamp: '2026-02-26T11:00:00', type: 'CHAT', roomId: '3', status: 'READ' },
		{ id: 'm12', sender: 'Алексей', content: 'Конечно! Что именно?', timestamp: '2026-02-26T11:10:00', type: 'CHAT', roomId: '3', status: 'READ' },
		{ id: 'm13', sender: 'Иван', content: 'Не могу подключить volume к контейнеру', timestamp: '2026-02-26T11:15:00', type: 'CHAT', roomId: '3', status: 'READ' },
		{ id: 'm14', sender: 'Алексей', content: 'Попробуй docker compose down -v и заново up', timestamp: '2026-02-26T11:30:00', type: 'CHAT', roomId: '3', status: 'READ' },
		{ id: 'm15', sender: 'Алексей', content: 'Скинь ссылку на репозиторий', timestamp: '2026-02-26T11:45:00', type: 'CHAT', roomId: '3', status: 'READ' },
	],
	'4': [
		{ id: 'm16', sender: 'Алексей', content: '🚀 BarsikChat v1.5 — добавлены групповые чаты!', timestamp: '2026-02-20T12:00:00', type: 'CHAT', roomId: '4', status: 'READ' },
		{ id: 'm17', sender: 'Мария', content: 'Ура! Отличная работа!', timestamp: '2026-02-20T12:05:00', type: 'CHAT', roomId: '4', status: 'READ' },
		{ id: 'm18', sender: 'Дмитрий', content: 'WebSocket работает стабильно 🔥', timestamp: '2026-02-22T15:00:00', type: 'CHAT', roomId: '4', status: 'READ' },
		{ id: 'm19', sender: 'Алексей', content: 'В v2.0 будет тёмная тема и emoji', timestamp: '2026-02-24T10:00:00', type: 'CHAT', roomId: '4', status: 'READ' },
		{ id: 'm20', sender: 'Алексей', content: 'Вышло обновление v2.0! 🎉', timestamp: '2026-02-25T18:00:00', type: 'CHAT', roomId: '4', status: 'READ' },
	],
	'5': [
		{ id: 'm21', sender: 'Елена', content: 'Привет! Можешь объяснить как работает WebSocket?', timestamp: '2026-02-25T15:00:00', type: 'CHAT', roomId: '5', status: 'READ' },
		{ id: 'm22', sender: 'Алексей', content: 'Конечно! Это двусторонний канал связи между клиентом и сервером', timestamp: '2026-02-25T15:10:00', type: 'CHAT', roomId: '5', status: 'READ' },
		{ id: 'm23', sender: 'Алексей', content: 'В отличие от HTTP, соединение не закрывается после каждого запроса', timestamp: '2026-02-25T15:12:00', type: 'CHAT', roomId: '5', status: 'READ' },
		{ id: 'm24', sender: 'Елена', content: 'А, теперь понятно! А как это в Spring Boot реализовано?', timestamp: '2026-02-25T16:00:00', type: 'CHAT', roomId: '5', status: 'READ' },
		{ id: 'm25', sender: 'Елена', content: 'Спасибо за помощь! 🙏', timestamp: '2026-02-25T16:30:00', type: 'CHAT', roomId: '5', status: 'READ' },
	],
}
