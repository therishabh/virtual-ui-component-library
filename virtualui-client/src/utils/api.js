import axios from 'axios'
import { store } from '../redux/store.js'
import { setUserData } from '../redux/userSlice.js'

// Ek shared axios instance: baseURL aur cookie setting ek jagah, har call me repeat nahi karni padegi
export const api = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL,
    withCredentials: true, // httpOnly JWT cookie bhejne/lene ke liye (server pe CORS credentials: true ke saath pair)
    timeout: 10_000,       // default me axios kabhi timeout nahi karta, server hang ho to request latki rehti hai
})

// Server ka asli message nikalne ka helper: "status code 400" se kuch pata nahi chalta
export const getErrorMessage = (error) =>
    axios.isAxiosError(error)
        ? (error.response?.data?.message ?? error.message)
        : 'Something went wrong'

// Cookie expire / invalid ho jaye (401) to UI ko bhi logged out kar do, har component me handle nahi karna padega
api.interceptors.response.use(
    // Success response ko jaisa hai waisa aage bhej do
    (response) => response,
    (error) => {
        // 401 = cookie expire/invalid. Sirf tab dispatch karo jab user abhi logged in ho,
        // warna logged-out state me (jaise /me ka 401) har baar faltu dispatch hoga
        if (error.response?.status === 401 && store.getState().user.userData) {
            store.dispatch(setUserData(null))
        }
        // Error ko reject karte raho, taaki caller ka catch block bhi chale
        return Promise.reject(error)
    }
)
