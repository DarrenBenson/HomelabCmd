const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-key-change-me';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    // Try to parse error message from response body
    let message = `API error: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail?.message) {
        message = errorData.detail.message;
      } else if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      }
    } catch {
      // Ignore JSON parse errors, use default message
    }
    throw new ApiError(response.status, message);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),
  put: <T>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  post: <T>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: async (endpoint: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
    });

    if (!response.ok) {
      let message = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail?.message) {
          message = errorData.detail.message;
        } else if (typeof errorData.detail === 'string') {
          message = errorData.detail;
        }
      } catch {
        // Ignore JSON parse errors, use default message
      }
      throw new ApiError(response.status, message);
    }
    // 204 No Content - no body to parse
  },
};
