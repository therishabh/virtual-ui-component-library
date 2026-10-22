import { motion } from 'motion/react'
import Auth from '../components/Auth'
import { useState } from 'react'

const Home = () => {
    const [showAuth, setShowAuth] = useState(false);

    const onClose = () => {
        setShowAuth(false);
    }
  return (
    <div>
        <motion.button
            onClick={() => setShowAuth(true)}
            whileHover={{scale:1.05}}
            whileTap={{scale:0.95}}
            className="m-6 px-6 py-2.5 rounded-xl bg-linear-to-br from-[#3be8ff] to-[#1a9fd4] text-[#03181c] font-semibold shadow-[0_8px_24px_rgba(59,232,255,0.3)] hover:shadow-[0_12px_32px_rgba(59,232,255,0.5)] transition-shadow cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3be8ff]"
        >
            Open
        </motion.button>
        {showAuth && <Auth onClose={onClose}/>}
    </div>

  )
}

export default Home