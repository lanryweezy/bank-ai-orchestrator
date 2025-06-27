import * as request from 'supertest';
import * as express from 'express';
import authRoutes from './authRoutes'; // The router we want to test
import * as authService from '../../services/authService'; // To mock its functions

// Mock the authService
jest.mock('../../services/authService');

const app = express();
app.use(express.json()); // Important for parsing JSON request bodies
app.use('/auth', authRoutes); // Mount the routes under a /auth prefix for testing

describe('Auth API Routes (/auth)', () => {
  const mockRegisterUser = authService.registerUser as jest.Mock;
  const mockLoginUser = authService.loginUser as jest.Mock;

  beforeEach(() => {
    mockRegisterUser.mockReset();
    mockLoginUser.mockReset();
  });

  describe('POST /auth/register', () => {
    const validUserData = {
      username: 'newuser',
      email: 'newuser@example.com',
      password: 'password123',
      full_name: 'New User',
    };

    it('should register a user successfully with valid data', async () => {
      const serviceResponse = { user_id: '1', ...validUserData };
      mockRegisterUser.mockResolvedValue(serviceResponse);

      const response = await request(app)
        .post('/auth/register')
        .send(validUserData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user).toEqual(serviceResponse);
      expect(mockRegisterUser).toHaveBeenCalledWith(validUserData);
    });

    it('should return 400 for missing username', async () => {
      const { username, ...invalidData } = validUserData; // username removed
      const response = await request(app)
        .post('/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors[0].path).toContain('username');
    });

    it('should return 400 for invalid email', async () => {
      const invalidData = { ...validUserData, email: 'invalid-email' };
      const response = await request(app)
        .post('/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors[0].path).toContain('email');
    });

    it('should return 400 for short password', async () => {
      const invalidData = { ...validUserData, password: '123' };
      const response = await request(app)
        .post('/auth/register')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors[0].path).toContain('password');
    });

    it('should return 409 if user already exists (service throws error)', async () => {
      mockRegisterUser.mockRejectedValue(new Error('User with this username or email already exists.'));
      const response = await request(app)
        .post('/auth/register')
        .send(validUserData);

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('User with this username or email already exists.');
    });

    it('should return 500 for other service errors', async () => {
      mockRegisterUser.mockRejectedValue(new Error('Some generic service error'));
      const response = await request(app)
        .post('/auth/register')
        .send(validUserData);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error during registration.');
    });
  });

  describe('POST /auth/login', () => {
    const loginCredentials = { username: 'testuser', password: 'password123' };
    const serviceResponse = {
      user: { user_id: '1', username: 'testuser', email: 'test@example.com', role: 'customer' },
      token: 'mockToken123',
    };

    it('should login a user successfully with valid credentials', async () => {
      mockLoginUser.mockResolvedValue(serviceResponse);

      const response = await request(app)
        .post('/auth/login')
        .send(loginCredentials);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(serviceResponse);
      expect(mockLoginUser).toHaveBeenCalledWith(loginCredentials);
    });

    it('should return 400 for missing username on login', async () => {
      const { username, ...invalidCredentials } = loginCredentials;
      const response = await request(app)
        .post('/auth/login')
        .send(invalidCredentials);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors[0].path).toContain('username');
    });

    it('should return 400 for missing password on login', async () => {
      const { password, ...invalidCredentials } = loginCredentials;
      const response = await request(app)
        .post('/auth/login')
        .send(invalidCredentials);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors[0].path).toContain('password');
    });

    it('should return 401 for invalid credentials (service throws error)', async () => {
      mockLoginUser.mockRejectedValue(new Error('Invalid username or password.'));
      const response = await request(app)
        .post('/auth/login')
        .send(loginCredentials);

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid username or password.');
    });

    it('should return 500 for other service errors during login', async () => {
      mockLoginUser.mockRejectedValue(new Error('Some generic service error'));
      const response = await request(app)
        .post('/auth/login')
        .send(loginCredentials);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error during login.');
    });
  });
});
