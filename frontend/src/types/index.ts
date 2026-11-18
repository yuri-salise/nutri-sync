export type UserRole = 'athlete' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  weight_kg: number;
  base_kcal_goal: number;
  protein_goal_g: number;
  carbs_goal_g: number;
  fat_goal_g: number;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Exercise {
  id: number;
  name: string;
  category: string;
  muscle_group: string;
  met_value: number;
  /** approved = built-in library; private = the user's own custom exercise */
  status: 'approved' | 'private';
  created_by_id?: number | null;
  created_at: string;
}

export interface WorkoutSet {
  id?: number;
  session_id?: number;
  exercise_id: number;
  set_no: number;
  reps: number;
  weight_kg: number;
  is_pr: boolean;
  verified_by_id?: number | null;
  exercise?: Exercise;
}

export interface WorkoutSession {
  id: number;
  user_id: number;
  split_title: string;
  duration_min: number;
  burned_kcal: number;
  is_public: boolean;
  session_date: string;
  created_at: string;
  sets: WorkoutSet[];
}

export interface RoutineExercise {
  id: number;
  exercise_id: number;
  position: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number;
  rest_sec: number;
  exercise?: Exercise;
}

export interface WorkoutRoutine {
  id: number;
  user_id: number;
  name: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  exercises: RoutineExercise[];
}

export interface RoutineExerciseInput {
  exercise_id: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number;
  rest_sec: number;
}

export type SportType = 'run' | 'walk' | 'ride' | 'hike';

export interface FeedAuthor {
  id: number;
  name: string;
  is_coach?: boolean;
}

export interface FeedExercise {
  name: string;
  sets: number;
  reps: number;
  top_weight_kg: number;
  is_pr: boolean;
}

export interface FeedItem {
  key: string;
  type: 'workout' | 'run' | 'post';
  id: number;
  timestamp: string;
  author: FeedAuthor;
  title: string;
  text?: string | null;
  burned_kcal?: number | null;
  duration_min?: number | null;
  exercises?: FeedExercise[] | null;
  prs_count?: number | null;
  has_verified_pr?: boolean | null;
  sport_type?: SportType | null;
  surface_type?: string | null;
  distance_km?: number | null;
  duration_sec?: number | null;
  elevation_gain_m?: number | null;
  route?: [number, number][] | null;
  route_hidden_ends: boolean;
  kudos_count: number;
  kudos_by_me: boolean;
  /** How many of the kudos came from coaches. */
  coach_kudos_count?: number;
  comments_count: number;
  mine: boolean;
}

export interface FeedComment {
  id: number;
  author: FeedAuthor;
  body: string;
  created_at: string;
  mine: boolean;
}

export interface RunActivity {
  id: number;
  user_id: number;
  sport_type: SportType;
  title?: string | null;
  surface_type: 'road' | 'trail';
  distance_km: number;
  duration_sec: number;
  elevation_gain_m: number;
  burned_kcal: number;
  route_geojson?: string | null;
  is_public: boolean;
  recorded_at: string;
}

export interface FoodItemSummary {
  id: number;
  food_name: string;
  source_dataset: 'FNRI' | 'USDA' | string;
  kcal_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  serving_description: string;
}

export interface PredictedMacros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ScannedMealItem {
  query_text: string;
  matched_food: FoodItemSummary | null;
  grams: number;
  macros: PredictedMacros;
  match_score: number;
  confidence: 'high' | 'low' | 'none';
  alternatives: FoodItemSummary[];
}

export interface RagScanResult {
  scan_id: number;
  query_input: string;
  is_machine_generated: boolean;
  requires_human_confirmation: boolean;
  used_fallback: boolean;
  latency_ms: number;
  top_similarity_score: number;
  predicted_macros: PredictedMacros;
  items: ScannedMealItem[];
  unmatched: string[];
  retrieved_items: FoodItemSummary[];
  model_version: string;
  /** null: no photo sent. */
  photo_status?: 'used' | 'no_food' | 'unavailable' | null;
  photo_description?: string | null;
  /** Text typed with a photo; its amounts override the photo's guesses. */
  note?: string | null;
  note_amounts_applied?: number;
}

export interface NutritionLog {
  id: number;
  user_id: number;
  rag_scan_id?: number | null;
  meal_name: string;
  total_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at: string;
}

export interface RagScanLog {
  id: number;
  user_id: number;
  query_input: string;
  retrieved_item_ids: string;
  top_similarity_score: number;
  predicted_macros_json: string;
  model_version: string;
  latency_ms: number;
  used_fallback: boolean;
  created_at: string;
}

export interface ActivitySyncedSummary {
  date: string;
  user_weight_kg: number;
  base_goals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  activity_burn: {
    workout_burned_kcal: number;
    workout_minutes: number;
    run_burned_kcal: number;
    run_distance_km: number;
    run_duration_min: number;
    total_burned_kcal: number;
  };
  dynamic_targets: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  consumed: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    logged_meals_count: number;
  };
  remaining: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}
