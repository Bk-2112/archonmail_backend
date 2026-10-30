import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add Bearer JWT token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('archon_mail_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Intercept 401s and redirect to /login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('archon_mail_token')
      localStorage.removeItem('archon_mail_user')
      window.location.href = '/login?error=session_expired'
    }
    return Promise.reject(error)
  }
)

export default apiClient
