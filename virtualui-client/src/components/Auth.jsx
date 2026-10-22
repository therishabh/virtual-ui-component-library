import {useEffect, useState} from 'react'
import {AnimatePresence, motion} from 'motion/react';
import {TbSparkles, TbX} from 'react-icons/tb'
import {FiCopy, FiDownload, FiLogIn, FiSettings} from 'react-icons/fi'
import {FcGoogle} from 'react-icons/fc'
import {signInWithPopup} from 'firebase/auth'
import {auth, provider} from '../utils/firebase'
import {api, getErrorMessage} from '../utils/api'

// "How it works" ke steps; active step highlight hota hai aur uska description dikhta hai
const STEPS = [
    {icon: FiLogIn, title: 'Login with Google', desc: 'One click sign in, no password needed.'},
    {icon: TbSparkles, title: 'Get 150 AI Credits', desc: 'Free credits to generate premium UI components.'},
    {icon: FiSettings, title: 'Customize Props', desc: 'Tweak variants, sizes and colors live.'},
    {icon: FiCopy, title: 'Generate Components', desc: 'AI builds production-ready JSX for you.'},
    {icon: FiDownload, title: 'Copy or Save', desc: 'Copy the code or save it to your library.'},
]

const STATS = [
    {value: '150', label: 'AI Credits'},
    {value: '∞', label: 'Components'},
    {value: 'JSX', label: 'Ready'},
]

// Logo ka "V" mark, size ke hisaab se scale hota hai
const VMark = ({className = 'w-5 h-5'}) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M3 5l8.2 11.2c.4.5 1.2.5 1.6 0L16 12l-3.2 7.2a1 1 0 0 1-1.8 0L3 5z" />
        <path d="M21 4l-4.6 9-2.9-3.1L21 4z" />
    </svg>
)

const STEP_INTERVAL = 1000;

const Auth = ({onClose}) => {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  // Active step loop me ghoomta hai; hover pe ruk jata hai taaki user padh sake
  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setActive(i => (i + 1) % STEPS.length), STEP_INTERVAL)
    return () => clearInterval(id)
  }, [paused])

  const googleAuth = async () => {
    try {
        const response = await signInWithPopup(auth, provider);
        console.log('response', response);
        // displayName kuch Google accounts me null hota hai, server string maangta hai, isliye email se fallback
        const {email, displayName} = response.user;
        const name = displayName ?? email?.split('@')[0];

        const {data} = await api.post('/api/auth/google', {name, email});

        console.log('result', data);
    }catch (error) {
        console.error("Error during Google sign-in:", getErrorMessage(error));
    }
  }

  return (
    <AnimatePresence>
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 p-4">
            <motion.div initial={{opacity:0, scale:0.9, y:38}} animate={{opacity:1, scale:1, y:0}} exit={{opacity:0, scale:0.95, y:30}} transition={{duration:0.5}}
            className="flex flex-col sm:flex-row w-full max-w-220 max-h-[90vh] overflow-y-auto rounded-2xl border border-[#3be8ff]/10 shadow-[0_40px_80px_rgba(0,0,0,0.8)] relative"
            >
                {/* cross button */}
                <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 z-20 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer">
                    <TbX size="15" />
                </button>

                {/* left box */}
                <div className="sm:w-[52%] bg-linear-to-br from-[#03181c] to-[#041224] p-6 sm:p-10 relative overflow-hidden">
                    <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(59,232,255,0.08)_0%,transparent_70%)] pointer-events-none" />

                    {/* brand */}
                    <div className="flex items-center gap-3 relative">
                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#5ee7ff] to-[#2bb8d8] text-[#03181c] flex items-center justify-center shadow-[0_0_24px_rgba(59,232,255,0.35)]">
                            <VMark />
                        </div>
                        <span className="text-white text-xl font-bold tracking-tight">VirtualUI</span>
                    </div>

                    {/* steps */}
                    <p className="mt-10 mb-5 text-[11px] font-semibold tracking-[0.3em] text-[#3be8ff] uppercase">How it works</p>
                    <ul className="flex flex-col gap-2 relative" onMouseLeave={() => setPaused(false)}>
                        {STEPS.map(({icon: Icon, title, desc}, i) => {
                            const highlight = i === active
                            return (
                            <li key={title} onMouseEnter={() => { setActive(i); setPaused(true) }} className={`flex items-center gap-4 rounded-xl px-3 py-3 transition-all duration-200 cursor-default ${highlight ? 'bg-[#3be8ff]/8 border border-[#3be8ff]/15' : 'border border-transparent'}`}>
                                <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center border ${highlight ? 'bg-linear-to-br from-[#5ee7ff] to-[#2bb8d8] text-[#03181c] border-transparent' : 'bg-white/5 border-white/10 text-white/60'}`}>
                                    <Icon size={15} />
                                </span>
                                <div>
                                    <p className={`text-sm font-medium ${highlight ? 'text-white' : 'text-white/60'}`}>{title}</p>
                                    {highlight && (
                                        <motion.p key={`${title}-desc`} initial={{opacity:0, y:-4}} animate={{opacity:1, y:0}} className="text-xs text-[#3be8ff]/50 mt-0.5">{desc}</motion.p>
                                    )}
                                </div>
                            </li>
                            )
                        })}
                    </ul>
                </div>

                {/* right box  */}
                <div className="sm:w-[48%] bg-[#030d12] p-6 sm:p-10 relative overflow-hidden flex flex-col items-center justify-center text-center
                    bg-[linear-gradient(rgba(59,232,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,232,255,0.03)_1px,transparent_1px)] bg-size-[28px_28px]">
                    <div className="w-16 h-16 rounded-2xl bg-[#071a21] border border-[#3be8ff]/15 text-[#3be8ff] flex items-center justify-center shadow-[0_0_32px_rgba(59,232,255,0.1)]">
                        <VMark className="w-7 h-7" />
                    </div>

                    <h2 className="mt-6 text-2xl font-bold text-white">Welcome</h2>
                    <p className="mt-3 max-w-65 text-sm leading-relaxed text-white/40">
                        Sign in to generate AI-powered UI components in seconds
                    </p>

                    {/* stats */}
                    <div className="mt-8 flex items-start justify-center gap-6">
                        {STATS.map(({value, label}) => (
                            <div key={label}>
                                <p className="text-xl font-bold text-[#3be8ff]">{value}</p>
                                <p className="mt-1 text-[10px] tracking-wider text-white/40 uppercase">{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* google button (abhi sirf UI) */}
                    <motion.button onClick={googleAuth} whileHover={{scale:1.02}} whileTap={{scale:0.98}} type="button"
                        className="mt-8 w-full flex items-center justify-center gap-3 rounded-xl bg-white py-3.5 text-[15px] font-semibold text-[#1f1f1f] shadow-[0_8px_24px_rgba(0,0,0,0.4)] cursor-pointer">
                        <FcGoogle size={22} />
                        Continue with Google
                    </motion.button>

                    <p className="mt-5 text-xs text-white/30">
                        No account needed for npm. <a href="#" className="text-[#3be8ff] hover:underline">View docs →</a>
                    </p>
                </div>
            </motion.div>
        </motion.div>
    </AnimatePresence>
  )
}

export default Auth
