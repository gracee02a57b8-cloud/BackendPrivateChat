'use client'

import { ChildProps } from '@/types'
import { useAuth, loadSession } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import { FC, useEffect, useState } from 'react'

const Layout: FC<ChildProps> = ({ children }) => {
	const { session, setSession } = useAuth()
	const router = useRouter()
	const [checking, setChecking] = useState(true)

	useEffect(() => {
		const saved = loadSession()
		if (!saved) {
			router.replace('/auth')
			return
		}
		setSession(saved)
		setChecking(false)
	}, [])

	if (checking && !session) return null

	return <div>{children}</div>
}

export default Layout
