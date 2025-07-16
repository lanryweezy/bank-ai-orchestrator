import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// import { useAuth } from '@/contexts/AuthContext'; // Assuming an AuthContext might be created later

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  // const { login } = useAuth(); // If using AuthContext
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      // Hardcoded test credentials
      if (username === 'admin' && password === 'admin123') {
        // Mock admin login
        const mockAdminUser = {
          id: '1',
          username: 'admin',
          email: 'admin@example.com',
          role: 'platform_admin',
          full_name: 'System Administrator'
        };
        const mockToken = 'mock-admin-token-' + Date.now();
        
        localStorage.setItem('authToken', mockToken);
        localStorage.setItem('userRole', 'platform_admin');
        localStorage.setItem('user', JSON.stringify(mockAdminUser));
        
        console.log('Admin login successful');
        navigate('/dashboard');
        return;
      }
      
      if (username === 'user' && password === 'user123') {
        // Mock regular user login
        const mockUser = {
          id: '2',
          username: 'user',
          email: 'user@example.com',
          role: 'user',
          full_name: 'Test User'
        };
        const mockToken = 'mock-user-token-' + Date.now();
        
        localStorage.setItem('authToken', mockToken);
        localStorage.setItem('userRole', 'user');
        localStorage.setItem('user', JSON.stringify(mockUser));
        
        console.log('User login successful');
        navigate('/dashboard');
        return;
      }

      // If credentials don't match hardcoded ones, try API call
      const response = await apiClient<{ user: any; token: string }>('/auth/login', {
        method: 'POST',
        data: { username, password },
      });
      
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      localStorage.setItem('userRole', response.user.role || 'user');
      navigate('/dashboard');
      
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Invalid credentials. Try admin/admin123 or user/user123 for testing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Login</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="yourusername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            
            {/* Test Credentials Info */}
            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border">
              <p className="font-semibold mb-1">Test Credentials:</p>
              <p>Admin: <span className="font-mono">admin / admin123</span></p>
              <p>User: <span className="font-mono">user / user123</span></p>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm text-center">
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-blue-600 hover:underline">
            Register here
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
