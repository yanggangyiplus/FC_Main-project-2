/**
 * API Client 설정
 */
import axios, { AxiosInstance, AxiosError } from 'axios'

class APIClient {
  private client: AxiosInstance

  constructor() {
    const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    
    // 디버깅: 실제 baseURL 확인
    console.log('[API Client] VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)
    console.log('[API Client] Final baseURL:', apiBaseURL)
    console.log('[API Client] baseURL starts with https:', apiBaseURL.startsWith('https://'))
    
    this.client = axios.create({
      baseURL: apiBaseURL,
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

    return this.client.post('/ai/stt/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  // 일정 정보 추출 (LLM)
  async extractTodoInfo(text: string) {
    return this.client.post('/ai/todo/extract', {
      text: text
    })
  }

  // OCR endpoints
  async extractTextFromImage(imageFile: File | Blob) {
    const formData = new FormData()
    formData.append('file', imageFile)

    return this.client.post('/ai/ocr/extract-text', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  async extractReceiptInfo(imageFile: File) {
    const formData = new FormData()
    formData.append('file', imageFile)

    return this.client.post('/ocr/extract-receipt', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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

  // Routine (시간표) endpoints
  async getRoutines() {
    return this.client.get('/routines')
  }

  async getRoutine(id: string) {
    return this.client.get(`/routines/${id}`)
  }

  async createRoutine(data: any) {
    return this.client.post('/routines', data)
  }

  async updateRoutine(id: string, data: any) {
    return this.client.patch(`/routines/${id}`, data)
  }

  async deleteRoutine(id: string) {
    return this.client.delete(`/routines/${id}`)
  }

  async deleteAllRoutines() {
    return this.client.delete('/routines/all')
  }

  // Family endpoints
  async getFamilyMembers() {
    return this.client.get('/family/members')
  }

  async createFamilyMember(data: any) {
    return this.client.post('/family/members', data)
  }

  async updateFamilyMember(id: string, data: any) {
    return this.client.patch(`/family/members/${id}`, data)
  }

  async deleteFamilyMember(id: string) {
    return this.client.delete(`/family/members/${id}`)
  }

  // User endpoints
  async updateUser(data: any) {
    return this.client.patch('/auth/me', data)
  }

  // File upload endpoints
  async uploadAudioFile(audioFile: File, todoId?: string) {
    const formData = new FormData()
    formData.append('file', audioFile)
    if (todoId) {
      formData.append('todo_id', todoId)
    }

    return this.client.post('/files/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  async uploadImageFile(imageFile: File, todoId?: string, memoId?: string) {
    const formData = new FormData()
    formData.append('file', imageFile)
    if (todoId) {
      formData.append('todo_id', todoId)
    }
    if (memoId) {
      formData.append('memo_id', memoId)
    }

    return this.client.post('/files/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  // Google Calendar endpoints
  async getGoogleCalendarAuthUrl() {
    return this.client.get('/calendar/google-auth-url')
  }

  async getCalendarStatus() {
    return this.client.get('/calendar/status')
  }

  async enableCalendarSync() {
    return this.client.post('/calendar/enable')
  }

  async disableCalendarSync() {
    return this.client.post('/calendar/disable')
  }

  async googleCalendarCallback(code: string, state: string) {
    return this.client.post('/calendar/google-callback', {
      code,
      state,
    })
  }

  async getGoogleCalendarEvents(timeMin?: string, timeMax?: string, maxResults: number = 100) {
    const params: any = { max_results: maxResults }
    if (timeMin) params.time_min = timeMin
    if (timeMax) params.time_max = timeMax
    return this.client.get('/calendar/events', { params })
  }

  async testGoogleCalendarConnection() {
    return this.client.get('/calendar/test-connection')
  }

  async debugListCalendars() {
    return this.client.get('/calendar/debug/calendars')
  }

  async deleteGoogleCalendarEvent(eventId: string) {
    return this.client.delete(`/calendar/event/${eventId}`)
  }

  async syncAllTodosToGoogleCalendar() {
    return this.client.post('/calendar/sync/all')
  }

  async syncGoogleCalendar() {
    return this.client.post('/calendar/sync/all')
  }

  async exportTodosToGoogleCalendar() {
    return this.client.post('/calendar/export')
  }

  async toggleCalendarImport() {
    return this.client.post('/calendar/toggle-import')
  }

  async toggleCalendarExport() {
    return this.client.post('/calendar/toggle-export')
  }

  // Notification endpoints
  async getNotifications(skip: number = 0, limit: number = 100) {
    return this.client.get('/notifications', {
      params: { skip, limit }
    })
  }

  async sendScheduledNotifications() {
    return this.client.post('/notifications/send-scheduled')
  }
}

export const apiClient = new APIClient()
