// Basic API Client

const BASE_URL = '/api'; // Proxied by Vite dev server

interface ApiClientOptions extends RequestInit {
  data?: any;
}

async function apiClient<T = any>(
  endpoint: string,
  { data, headers: customHeaders, ...customConfig }: ApiClientOptions = {}
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

  // Retrieve token from storage (e.g., localStorage)
  // const token = localStorage.getItem('authToken');
  // if (token) {
  //   config.headers = {
  //     ...config.headers,
  //     'Authorization': `Bearer ${token}`,
  //   };
  // }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      // Throw an error object that includes the status and the parsed message
      const error: any = new Error(errorData.message || 'API request failed');
      error.status = response.status;
      error.data = errorData; // Attach full error data
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
    // Log or handle error appropriately
    console.error('API Client Error:', error.message, 'Status:', error.status, 'Data:', error.data);
    throw error; // Re-throw to be caught by the calling function
  }
}

export default apiClient;
