/**
 * API Client 설정
 */
import axios, { AxiosInstance, AxiosError } from 'axios'

class APIClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
      withCredentials: true, // httpOnly 쿠키 전송
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // 요청 인터셉터 (디버깅용 + Authorization 헤더)
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
        
        // Authorization 헤더 추가
        const token = localStorage.getItem('access_token')
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
          console.log(`[API] Added Authorization header`)
        }
        
        return config
      },
      (error) => Promise.reject(error)
    )

    // Refresh Token 자동 갱신 (google-issue.md 참고)
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[API] Response status: ${response.status}`)
        return response
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as any

        // 상세한 에러 로깅
        if (error.response) {
          console.error(`[API Error] Status: ${error.response.status}, Data:`, error.response.data)
        } else if (error.request) {
          console.error(`[API Error] No response received:`, error.request)
        } else {
          console.error(`[API Error] ${error.message}`)
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            // Refresh token으로 새로운 access token 요청
            const refreshToken = localStorage.getItem('refresh_token')
            if (refreshToken) {
              await this.refreshToken(refreshToken)
              // 원래 요청 재시도
              return this.client(originalRequest)
            }
          } catch (refreshError) {
            // Refresh 실패 시 로그인 페이지로 이동
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            window.location.href = '/login'
          }
        }

        return Promise.reject(error)
      }
    )
  }

  async refreshToken(refreshToken: string): Promise<string> {
    const response = await this.client.post('/auth/refresh', {
      refresh_token: refreshToken,
    })
    
    const newAccessToken = response.data.access_token
    localStorage.setItem('access_token', newAccessToken)
    
    return newAccessToken
  }

  // Auth endpoints
  async getGoogleInitUrl() {
    return this.client.get('/auth/google-init')
  }

  async googleLogin(code: string, state: string) {
    return this.client.post('/auth/google-login', {
      code,
      state,
    })
  }

  async logout() {
    return this.client.post('/auth/logout')
  }

  async getCurrentUser() {
    return this.client.get('/auth/me')
  }

  // Todo endpoints
  async getTodos(date?: string, status?: string) {
    return this.client.get('/todos', {
      params: { date, status },
    })
  }

  /**
   * 오늘 할 일 조회
   */
  async getTodosToday() {
    return this.client.get('/todos/today')
  }

  async getTodo(id: string) {
    return this.client.get(`/todos/${id}`)
  }

  async createTodo(data: any) {
    return this.client.post('/todos', data)
  }

  async updateTodo(id: string, data: any) {
    return this.client.patch(`/todos/${id}`, data)
  }

  async deleteTodo(id: string) {
    return this.client.delete(`/todos/${id}`)
  }

  async completeTodo(id: string) {
    return this.client.post(`/todos/${id}/complete`)
  }

  // STT endpoints
  async transcribeAudio(audioFile: File, context: string = 'todo') {
    const formData = new FormData()
    formData.append('file', audioFile)
    formData.append('context', context)

    return this.client.post('/stt/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  // OCR endpoints
  async extractReceiptInfo(imageFile: File) {
    const formData = new FormData()
    formData.append('file', imageFile)

    return this.client.post('/ocr/extract-receipt', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  async extractTextFromImage(imageFile: File, method: string = 'gemini') {
    const formData = new FormData()
    formData.append('file', imageFile)

    return this.client.post('/ai/ocr/extract-text', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: { method },
    })
  }

  // Receipt endpoints
  async getReceipts(date?: string, category?: string) {
    return this.client.get('/receipts', {
      params: { date, category },
    })
  }

  async createReceipt(data: any) {
    return this.client.post('/receipts', data)
  }

  async getDailyStats(date: string) {
    return this.client.get(`/receipts/stats/daily`, {
      params: { date },
    })
  }
}

export const apiClient = new APIClient()
