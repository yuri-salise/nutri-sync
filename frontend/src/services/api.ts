import {
  AuthTokens,
  User,
  Exercise,
  WorkoutSession,
  WorkoutSet,
  WorkoutRoutine,
  RoutineExerciseInput,
  RunActivity,
  SportType,
  FeedItem,
  FeedComment,
  RagScanResult,
  NutritionLog,
  RagScanLog,
  ActivitySyncedSummary,
  PaginatedResponse,
  FoodItemSummary,
} from '../types';

const API_BASE = '/api/v1';

class ApiService {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('nutrisync_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') || endpoint.startsWith('/api') ? endpoint : `${API_BASE}${endpoint}`;
    const headers = { ...this.getHeaders(), ...(options.headers || {}) };

    try {
      const response = await fetch(url, { ...options, headers });

      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg =
          data?.error?.message ||
          (data?.error?.details && data.error.details.map((d: any) => `${d.field ? d.field + ': ' : ''}${d.message}`).join(', ')) ||
          data?.detail?.message ||
          `Server Error (${response.status})`;
        throw new Error(errorMsg);
      }

      return data as T;
    } catch (err: any) {
      console.error(`API Error on [${options.method || 'GET'} ${url}]:`, err);
      throw err;
    }
  }

  // Health
  async getHealth() {
    return this.request<{ status: string; version: string; database: string }>('/api/health');
  }

  // Auth
  async login(credentials: { email: string; password: string }): Promise<AuthTokens> {
    return this.request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(data: any): Promise<User> {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return this.request<User>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Exercises
  async getExercises(params?: {
    muscle_group?: string;
    category?: string;
    mine?: boolean;
    q?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Exercise>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.append(k, String(v));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<PaginatedResponse<Exercise>>(`/exercises${query}`);
  }

  async createExercise(data: { name: string; category: string; muscle_group: string; met_value: number }): Promise<Exercise> {
    return this.request<Exercise>('/exercises', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateExercise(id: number, data: Partial<Exercise>): Promise<Exercise> {
    return this.request<Exercise>(`/exercises/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteExercise(id: number): Promise<void> {
    return this.request<void>(`/exercises/${id}`, { method: 'DELETE' });
  }

  // Workouts
  async getWorkouts(params?: { page?: number; limit?: number; split_title?: string; only_mine?: boolean }): Promise<PaginatedResponse<WorkoutSession>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) searchParams.append(k, String(v));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<PaginatedResponse<WorkoutSession>>(`/workout-sessions${query}`);
  }

  async createWorkout(data: {
    split_title: string;
    duration_min: number;
    burned_kcal?: number;
    is_public: boolean;
    sets: Array<{ exercise_id: number; set_no: number; reps: number; weight_kg: number; is_pr?: boolean }>;
  }): Promise<WorkoutSession> {
    return this.request<WorkoutSession>('/workout-sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkout(id: number): Promise<void> {
    return this.request<void>(`/workout-sessions/${id}`, { method: 'DELETE' });
  }

  async verifyWorkoutSetPR(setId: number): Promise<WorkoutSet> {
    return this.request<WorkoutSet>(`/workout-sets/${setId}/verify`, { method: 'PATCH' });
  }

  // Workout routines
  async getRoutines(params?: { q?: string; page?: number; limit?: number }): Promise<PaginatedResponse<WorkoutRoutine>> {
    const searchParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== '') searchParams.append(k, String(v));
    });
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<PaginatedResponse<WorkoutRoutine>>(`/workout-routines${query}`);
  }

  async createRoutine(data: { name: string; notes?: string; exercises: RoutineExerciseInput[] }): Promise<WorkoutRoutine> {
    return this.request<WorkoutRoutine>('/workout-routines', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateRoutine(
    id: number,
    data: { name?: string; notes?: string; exercises?: RoutineExerciseInput[] }
  ): Promise<WorkoutRoutine> {
    return this.request<WorkoutRoutine>(`/workout-routines/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteRoutine(id: number): Promise<void> {
    return this.request<void>(`/workout-routines/${id}`, { method: 'DELETE' });
  }

  // Runs
  async getRuns(params?: { page?: number; limit?: number; surface_type?: string; sport_type?: SportType }): Promise<PaginatedResponse<RunActivity>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.append(k, String(v));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<PaginatedResponse<RunActivity>>(`/run-activities${query}`);
  }

  async createRun(data: {
    sport_type: SportType;
    title?: string;
    surface_type: 'road' | 'trail';
    distance_km: number;
    duration_sec: number;
    elevation_gain_m: number;
    burned_kcal?: number;
    route_geojson?: string;
    is_public: boolean;
  }): Promise<RunActivity> {
    return this.request<RunActivity>('/run-activities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteRun(id: number): Promise<void> {
    return this.request<void>(`/run-activities/${id}`, { method: 'DELETE' });
  }

  // RAG Nutrition Engine
  async scanMealRAG(query_input: string, image_base64?: string): Promise<RagScanResult> {
    return this.request<RagScanResult>('/rag-nutrition-scans', {
      method: 'POST',
      body: JSON.stringify({ query_input, image_base64 }),
    });
  }

  async getRagScanLogs(page: number = 1, limit: number = 20): Promise<PaginatedResponse<RagScanLog>> {
    return this.request<PaginatedResponse<RagScanLog>>(`/rag-nutrition-scans?page=${page}&limit=${limit}`);
  }

  async getNutritionKnowledgeItems(params?: { q?: string; source_dataset?: string; page?: number; limit?: number }): Promise<PaginatedResponse<FoodItemSummary>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') searchParams.append(k, String(v));
      });
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<PaginatedResponse<FoodItemSummary>>(`/nutrition-knowledge-items${query}`);
  }

  // Nutrition Logs
  async getNutritionLogs(page: number = 1, limit: number = 20): Promise<PaginatedResponse<NutritionLog>> {
    return this.request<PaginatedResponse<NutritionLog>>(`/nutrition-logs?page=${page}&limit=${limit}`);
  }

  async createNutritionLog(data: {
    meal_name: string;
    total_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    rag_scan_id?: number | null;
  }): Promise<NutritionLog> {
    return this.request<NutritionLog>('/nutrition-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteNutritionLog(id: number): Promise<void> {
    return this.request<void>(`/nutrition-logs/${id}`, { method: 'DELETE' });
  }

  // Activity Sync Summary
  async getActivitySyncedSummary(): Promise<ActivitySyncedSummary> {
    return this.request<ActivitySyncedSummary>('/activity-synced-summary');
  }

  // Community Feed
  // Community feed
  async getCommunityFeed(page = 1, limit = 10, activity_type: 'all' | 'workouts' | 'runs' | 'posts' = 'all'): Promise<PaginatedResponse<FeedItem>> {
    return this.request<PaginatedResponse<FeedItem>>(`/community-feed?page=${page}&limit=${limit}&activity_type=${activity_type}`);
  }

  async createPost(body: string): Promise<FeedItem> {
    return this.request<FeedItem>('/community-feed/posts', { method: 'POST', body: JSON.stringify({ body }) });
  }

  async deletePost(id: number): Promise<void> {
    return this.request<void>(`/community-feed/posts/${id}`, { method: 'DELETE' });
  }

  async giveKudos(type: string, id: number): Promise<{ kudos_count: number; kudos_by_me: boolean; coach_kudos_count: number }> {
    return this.request(`/community-feed/${type}/${id}/kudos`, { method: 'PUT' });
  }

  async removeKudos(type: string, id: number): Promise<void> {
    return this.request<void>(`/community-feed/${type}/${id}/kudos`, { method: 'DELETE' });
  }

  async getComments(type: string, id: number): Promise<PaginatedResponse<FeedComment>> {
    return this.request<PaginatedResponse<FeedComment>>(`/community-feed/${type}/${id}/comments?limit=100`);
  }

  async addComment(type: string, id: number, body: string): Promise<FeedComment> {
    return this.request<FeedComment>(`/community-feed/${type}/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  }

  async deleteComment(commentId: number): Promise<void> {
    return this.request<void>(`/community-feed/comments/${commentId}`, { method: 'DELETE' });
  }
}

export const api = new ApiService();
