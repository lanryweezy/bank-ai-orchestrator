// Enhanced API Client

const BASE_URL = '/api'; // Proxied by Vite dev server

interface ApiClientOptions extends RequestInit {
  data?: any;
  requiresAuth?: boolean;
}

async function apiClient<T = any>(
  endpoint: string,
  { data, headers: customHeaders, requiresAuth = true, ...customConfig }: ApiClientOptions = {}
): Promise<T> {
  const config: RequestInit = {
    method: data ? 'POST' : 'GET', // Default to POST if data is provided, else GET
    headers: {
      'Content-Type': data ? 'application/json' : undefined,
      ...customHeaders,
    },
    ...customConfig,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  // Retrieve token from storage and add to headers if required
  if (requiresAuth) {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`,
      };
    }
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      
      // Handle specific HTTP status codes
      if (response.status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
        return Promise.reject(new Error('Session expired. Please login again.'));
      }
      
      // Throw an error object that includes the status and the parsed message
      const error: any = new Error(errorData.message || 'API request failed');
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    // Handle cases where response might be empty (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return await response.json();
    } else {
        // If not json, or empty, return null or handle as appropriate
        return null as T;
    }

  } catch (error: any) {
    // Log error for debugging (in production, use proper logging service)
    if (process.env.NODE_ENV === 'development') {
      console.error('API Client Error:', error.message, 'Status:', error.status, 'Data:', error.data);
    }
    throw error; // Re-throw to be caught by the calling function
  }
}

export default apiClient;
