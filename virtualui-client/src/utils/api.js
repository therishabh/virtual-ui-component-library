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

// ---- Auto token refresh ----
// Access token 15 min ka hai, to kabhi bhi 401 aa sakta hai. Tab hum chupke se naya token lekar
// wahi request dobara bhej dete hain, user ko pata nahi chalta. Flow:
//   request -> 401 -> POST /refresh -> (success) original request retry
//                                   -> (fail)    user ko logged out karo

// In URLs pe 401 aaye to refresh mat karo: ye khud login/refresh/logout hain (warna loop ban jayega)
const NO_REFRESH_URLS = ['/api/auth/refresh', '/api/auth/google', '/api/auth/logout']

// Step 1: Is error pe refresh try karna chahiye ya nahi?
const shouldRefresh = (error) => {
    const request = error.config
    if (!request) return false                       // network error, request ka config hi nahi
    if (error.response?.status !== 401) return false // sirf 401 pe refresh
    if (request._retried) return false               // ek request ko sirf ek baar retry, warna infinite loop
    return !NO_REFRESH_URLS.some((url) => request.url?.includes(url))
}

// Step 2: Refresh call. Ek hi call chalni chahiye.
// 3 requests ek saath 401 khayein to teeno alag /refresh karengi aur server pe refresh token rotate hone se
// race ho jayegi. Isliye pehli call ka promise save karke baaki uska wait karti hain.
let refreshPromise = null
const refreshSession = () => {
    refreshPromise ??= api.post('/api/auth/refresh').finally(() => {
        refreshPromise = null // call khatam, agli baar fresh refresh ho sake
    })
    return refreshPromise
}

// Step 3: Refresh fail hone par UI ko logged out karo.
// Sirf tab jab user abhi logged in dikh raha ho, warna logged-out state me (jaise page load ka /me) faltu dispatch hoga.
const logoutInUI = () => {
    if (store.getState().user.userData) {
        store.dispatch(setUserData(null))
    }
}

api.interceptors.response.use(
    (response) => response, // success me kuch nahi karna
    async (error) => {
        if (!shouldRefresh(error)) return Promise.reject(error)

        error.config._retried = true

        try {
            await refreshSession()
        } catch {
            // Refresh fail = session sach me khatam (logout / 30 din poore / token chori)
            logoutInUI()
            return Promise.reject(error)
        }

        // Retry try/catch ke bahar hai, kyunki retry ka apna error (jaise 500) logout nahi karwana chahiye
        return api(error.config)
    }
)
