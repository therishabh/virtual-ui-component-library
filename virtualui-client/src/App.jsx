
import { Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './pages/Home'
import { useEffect } from 'react'
import axios from 'axios'
import { api } from './utils/api.js'
import { useDispatch } from 'react-redux'
import { setUserData } from './redux/userSlice.js'

function App() {

  const dispatch = useDispatch();

  useEffect(() => {
    // StrictMode (sirf dev me) effect ko mount -> cleanup -> mount chalata hai, isliye /me 2 baar hit hota hai.
    // Cleanup me pehli request abort karte hain, taaki uska stale response state overwrite na kare.
    const controller = new AbortController();

    const fetchCurrentUser = async () => {
      try {
        const result = await api.get('/api/auth/me', { signal: controller.signal });
        dispatch(setUserData(result.data))
      } catch (error) {
        // Abort hui request error nahi hai (cleanup ne cancel ki), ignore karo
        if (axios.isCancel(error)) return;
        // 401 = logged out; phir bhi check complete mark karna zaroori hai
        console.log('error', error)
        dispatch(setUserData(null))
      }
    }
    fetchCurrentUser();

    return () => controller.abort();
  }, [dispatch])

  return (
    <Routes>
      <Route path='/' element={<Home/>} />
    </Routes>
  )
}

export default App
