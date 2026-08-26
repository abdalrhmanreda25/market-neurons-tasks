import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import ThemeProvider, { THEME_KEY } from '@/components/ThemeProvider'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const metadata = {
  title: 'Market Neurons — Team Tasks',
  description: 'Tasks, hours and team analytics for the Market Neurons team.',
}

// Applied before first paint so the theme never flashes on load.
// Light is the default; dark only when the visitor has chosen it.
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    document.documentElement.setAttribute('data-theme', stored === 'dark' ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" className={jakarta.className} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
