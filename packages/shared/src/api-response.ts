export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: ApiMeta;
  timestamp: string;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  statusCode: number;
  timestamp: string;
  path?: string;
}
