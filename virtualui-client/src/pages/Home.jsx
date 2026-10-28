import { AnimatePresence, motion } from 'motion/react'
import Auth from '../components/Auth'
import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { FiArrowRight, FiCheck, FiCode, FiCopy, FiGrid, FiLogOut, FiPlay, FiSliders } from 'react-icons/fi'
import { TbBrandNpm, TbSparkles } from 'react-icons/tb'
import { api } from '../utils/api'
import { selectAuthChecked, selectUserData, setUserData } from '../redux/userSlice'

const INSTALL_CMD = 'npm install virtual-ui-lib'

const FEATURES = [
  { icon: FiGrid, title: 'Prebuilt UI Components', desc: 'Install VirtualUI and use ready-made, production-grade components instantly.' },
  { icon: TbSparkles, title: 'AI Component Generator', desc: 'Describe your UI in plain English and generate React components in seconds.' },
  { icon: FiSliders, title: 'Customizable Props', desc: 'Modify component props and preview changes in real-time without rebuilding.' },
  { icon: FiCode, title: 'Clean JSX Code', desc: 'Copy production-ready JSX directly into your project — zero boilerplate.' },
  { icon: TbBrandNpm, title: 'NPM Library', desc: 'Import VirtualUI components with a simple npm install command.' },
  { icon: FiPlay, title: 'Live Preview', desc: 'Instantly preview AI-generated components before exporting your code.' },
]

// Logo ka "V" mark (Auth.jsx wala hi)
const VMark = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3 5l8.2 11.2c.4.5 1.2.5 1.6 0L16 12l-3.2 7.2a1 1 0 0 1-1.8 0L3 5z" />
    <path d="M21 4l-4.6 9-2.9-3.1L21 4z" />
  </svg>
)

const Home = () => {
  const [showAuth, setShowAuth] = useState(false)
  const [copied, setCopied] = useState(false)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const dispatch = useDispatch()

  const userData = useSelector(selectUserData)
  const authChecked = useSelector(selectAuthChecked)

  // Menu ke bahar click ya Escape pe band karo
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout')
      dispatch(setUserData(null))
      setMenuOpen(false)
    } catch (error) {
      console.log('logout failed', error)
    }
  }

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      console.log('copy failed', error)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090d] text-white overflow-x-hidden relative">
      {/* Top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-130 bg-[radial-gradient(ellipse_at_top,rgba(59,232,255,0.08),transparent_70%)]" />

      {/* Navbar */}
      <nav className="relative flex items-center justify-between px-6 md:px-8 h-16 border-b border-white/5 z-50">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-linear-to-br from-[#3be8ff] to-[#1a9fd4] text-[#03181c] shadow-[0_0_20px_rgba(59,232,255,0.35)]">
            <VMark />
          </span>
          <span className="text-lg font-semibold tracking-tight">VirtualAI</span>
        </div>

        <div className="flex items-center gap-5">
          <a href="#components" className="text-sm text-white/60 hover:text-white transition-colors">
            Components
          </a>

          {!authChecked ? (
            // /me aane tak skeleton, taaki Login button flash na ho
            <div className="w-28 h-10 rounded-xl bg-white/5 animate-pulse" />
          ) : userData ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors cursor-pointer"
              >
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-linear-to-br from-[#3be8ff] to-[#1a9fd4] text-[#03181c] text-xs font-bold">
                  {userData.name?.[0]?.toUpperCase() ?? 'U'}
                </span>
                <span className="text-sm font-medium">{userData.name?.split(' ')[0]}</span>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-3 w-64 origin-top-right rounded-2xl border border-white/10 bg-[#0d1218] shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-white/5">
                      <p className="font-semibold truncate">{userData.name}</p>
                      <p className="mt-1 text-xs text-white/40 truncate">{userData.email}</p>
                    </div>
                    <button
                      role="menuitem"
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-sm text-white/70 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <FiGrid className="text-[#3be8ff]" /> My Components
                    </button>
                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-sm text-[#e5736f] border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <FiLogOut /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
            >
              Login
            </button>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center text-center px-6 pt-20 md:pt-28 pb-24">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#3be8ff]/20 bg-[#3be8ff]/5 text-[11px] font-semibold tracking-[0.2em] text-[#7ad9e6]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#3be8ff]" />
          AI-POWERED REACT UI LIBRARY
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-8 text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]"
        >
          Build React UI
          <br />
          <span className="text-[#3bc9e8]">Faster with AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8 max-w-xl text-base md:text-lg text-white/45 leading-relaxed"
        >
          Use prebuilt VirtualUI components or generate custom ones with AI. Copy clean JSX
          directly into your project in seconds.
        </motion.p>

        {/* Install command */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-10 flex items-center gap-3 px-5 py-3 rounded-xl bg-white/3 border border-white/10 font-mono text-sm"
        >
          <span className="text-[#3be8ff]">$</span>
          <span>{INSTALL_CMD}</span>
          <button
            onClick={copyInstall}
            aria-label="Copy install command"
            className="ml-2 text-white/40 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? <FiCheck className="text-[#3be8ff]" /> : <FiCopy />}
          </button>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 flex flex-wrap justify-center gap-4"
        >
          <motion.button
            onClick={() => !userData && setShowAuth(true)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-[#07090d] font-semibold shadow-[0_8px_30px_rgba(255,255,255,0.15)] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3be8ff]"
          >
            Get Started <FiArrowRight />
          </motion.button>
          <motion.button
            onClick={() => !userData && setShowAuth(true)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 bg-white/2 text-white/90 font-medium hover:bg-white/6 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3be8ff]"
          >
            <TbSparkles /> Generate AI Component
          </motion.button>
        </motion.div>

        {/* Code preview window */}
        <motion.div
          id="components"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-20 w-full max-w-207 text-left rounded-2xl border border-white/8 bg-[#0b0e14] shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center gap-2 px-6 pt-5">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-xs font-mono text-white/25">App.jsx</span>
          </div>
          <pre className="px-6 py-6 overflow-x-auto font-mono text-sm leading-8 text-white/85">
            <code>
              <span className="text-[#3be8ff]">import</span> {'{ Button, Card }'}{' '}
              <span className="text-[#3be8ff]">from</span>{' '}
              <span className="text-[#7ad9e6]">'virtual-ui-lib'</span>;{'\n'}
              <span className="text-[#3be8ff]">export default function</span>{' '}
              <span className="text-[#e5c07b]">App</span>() {'{'}
              {'\n'}
              {'  '}
              <span className="text-white/45">return (</span>
              {'\n'}
              {'    '}
              <span className="text-white/45">{'<'}</span>Card title=
              <span className="text-[#7ad9e6]">"Dashboard"</span>
              <span className="text-white/45">{'>'}</span>
              {'\n'}
              {'      '}
              <span className="text-white/45">{'<'}</span>Button text=
              <span className="text-[#7ad9e6]">"Hello"</span>{' '}
              <span className="text-white/45">{'/>'}</span>
              {'\n'}
              {'    '}
              <span className="text-white/45">{'</'}Card{'>'}</span>
              {'\n'}
              {'  '}
              <span className="text-white/45">)</span>
              {'\n'}
              {'}'}
            </code>
          </pre>
        </motion.div>
      </main>

      {/* Features */}
      <section className="relative z-10 px-6 md:px-8 pb-28">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center text-4xl md:text-5xl font-bold tracking-tight"
        >
          Everything you need
        </motion.h2>

        <div className="mt-14 mx-auto max-w-6xl grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration:0.5 }}
              whileHover={{ y: -4 }}
              className="rounded-2xl border border-white/6 bg-white/2 p-7 hover:border-[#3be8ff]/25 transition-colors"
            >
              <span className="grid place-items-center w-11 h-11 rounded-xl border border-[#3be8ff]/15 bg-[#3be8ff]/8 text-[#3be8ff] text-lg">
                <Icon />
              </span>
              <h3 className="mt-6 text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-white/45 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
    </div>
  )
}

export default Home
