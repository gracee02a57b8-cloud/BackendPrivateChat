import axios from 'axios'

/** In production, nginx proxies /api to the backend. In dev, use env var. */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

export const axiosClient = axios.create({
	baseURL: BASE_URL,
	headers: { 'Content-Type': 'application/json' },
})

/** Attach JWT token to every request from localStorage */
axiosClient.interceptors.request.use(config => {
	if (typeof window !== 'undefined') {
		const raw = localStorage.getItem('barsik_session')
		if (raw) {
			try {
				const session = JSON.parse(raw)
				if (session?.token) {
					config.headers.Authorization = `Bearer ${session.token}`
				}
			} catch {
				// ignore
			}
		}
	}
	return config
})
