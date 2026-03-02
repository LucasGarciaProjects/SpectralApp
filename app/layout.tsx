import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SpectralApp',
  description: 'Created by Lucas',
  generator: 'SpectralApp.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
