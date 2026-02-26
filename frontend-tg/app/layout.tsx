import { ThemeProvider } from '@/components/providers/theme.provider'
import './globals.css'

import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'

const spaceGrotesk = Space_Grotesk({
	weight: ['400', '500', '600', '700', '300'],
	subsets: ['latin'],
	variable: '--font-spaceGrotesk',
})

export const metadata: Metadata = {
	title: 'BarsikChat',
	description: 'BarsikChat — быстрый и безопасный мессенджер',
	icons: { icon: '/logo.svg' },
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang='ru' suppressHydrationWarning>
			<body className={`${spaceGrotesk.variable} antialiased sidebar-custom-scrollbar`} suppressHydrationWarning>
				<ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
					<main>{children}</main>
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	)
}
