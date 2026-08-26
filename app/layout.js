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
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var theme = stored || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" className={jakarta.className} suppressHydrationWarning>
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
