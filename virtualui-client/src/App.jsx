
import { Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './pages/Home'
import { useEffect } from 'react'
import { api } from './utils/api.js'
import { useDispatch } from 'react-redux'
import { setUserData } from './redux/userSlice.js'

function App() {

  const dispatch = useDispatch();

  useEffect(() => {

    const fetchCurrenctUser = async() => {
      try {
        const result = await api.get('/api/auth/me');
        dispatch(setUserData(result.data))
      } catch (error) {
        // 401 = logged out; phir bhi check complete mark karna zaroori hai
        console.log('error', error)
        dispatch(setUserData(null))
      }

    }
    fetchCurrenctUser();
    
  }, [])

  return (
    <Routes>
      <Route path='/' element={<Home/>} />
    </Routes>
  )
}

export default App
