'use client'

import { ChildProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { FC, useEffect, useState } from 'react'
import { MOCK_SESSION } from '@/lib/mock-data'

const Layout: FC<ChildProps> = ({ children }) => {
	const { setSession } = useAuth()
	const [ready, setReady] = useState(false)

	useEffect(() => {
		// Mock mode: skip auth, inject fake session
		setSession(MOCK_SESSION)
		setReady(true)
	}, [])

	if (!ready) return null

	return <div>{children}</div>
}

export default Layout
