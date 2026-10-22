import axios from 'axios'

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
