import { registerUser, loginUser } from './authService';
import * as db from '../config/db'; // To mock the 'query' function
import * as passwordUtils from '../utils/passwordUtils'; // To mock password functions
import * as jwtUtils from '../utils/jwtUtils'; // To mock JWT functions
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
jest.mock('../config/db');
jest.mock('../utils/passwordUtils');
jest.mock('../utils/jwtUtils');
jest.mock('uuid');


describe('authService', () => {
  const mockQuery = db.query as jest.Mock;
  const mockHashPassword = passwordUtils.hashPassword as jest.Mock;
  const mockComparePassword = passwordUtils.comparePassword as jest.Mock;
  const mockGenerateToken = jwtUtils.generateToken as jest.Mock;
  const mockUuidv4 = uuidv4 as jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    mockQuery.mockReset();
    mockHashPassword.mockReset();
    mockComparePassword.mockReset();
    mockGenerateToken.mockReset();
    mockUuidv4.mockReset();
  });

  describe('registerUser', () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      full_name: 'Test User',
    };

    it('should register a new user successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // No existing user
        .mockResolvedValueOnce({ rows: [{ user_id: 'new-uuid', ...userData, role: 'customer' }] }); // Inserted user
      mockHashPassword.mockResolvedValue('hashedPassword123');
      mockUuidv4.mockReturnValue('new-uuid');

      const result = await registerUser(userData);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenNthCalledWith(1, 'SELECT * FROM users WHERE username = $1 OR email = $2', [userData.username, userData.email]);
      expect(mockHashPassword).toHaveBeenCalledWith(userData.password);
      expect(mockUuidv4).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenNthCalledWith(2,
        'INSERT INTO users (user_id, username, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, username, email, role, full_name',
        ['new-uuid', userData.username, userData.email, 'hashedPassword123', userData.full_name, 'customer']
      );
      expect(result).toEqual({ user_id: 'new-uuid', ...userData, role: 'customer' });
    });

    it('should throw an error if user already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-uuid', ...userData }] }); // Existing user found

      await expect(registerUser(userData)).rejects.toThrow('User with this username or email already exists.');
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockHashPassword).not.toHaveBeenCalled();
    });

    it('should assign default role "customer" if not provided', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ user_id: 'new-uuid', ...userData, role: 'customer' }] });
        mockHashPassword.mockResolvedValue('hashedPassword123');
        mockUuidv4.mockReturnValue('new-uuid');

        await registerUser(userData); // Role not passed, should default

        expect(mockQuery).toHaveBeenNthCalledWith(2,
            expect.any(String), // SQL query
            expect.arrayContaining([userData.username, userData.email, 'hashedPassword123', userData.full_name, 'customer']) // Check role
        );
    });
  });

  describe('loginUser', () => {
    const loginCredentials = {
      username: 'testuser',
      password: 'password123',
    };
    const dbUser = {
      user_id: 'user-uuid-123',
      username: 'testuser',
      email: 'test@example.com',
      password_hash: 'hashedPasswordFromServer',
      role: 'customer',
      full_name: 'Test User',
    };

    it('should login an existing user and return user data and token', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbUser] });
      mockComparePassword.mockResolvedValue(true); // Password matches
      mockGenerateToken.mockReturnValue('mockAuthToken123');

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password_hash, ...expectedUser } = dbUser;
      const result = await loginUser(loginCredentials);

      expect(mockQuery).toHaveBeenCalledWith('SELECT user_id, username, email, password_hash, role, full_name FROM users WHERE username = $1', [loginCredentials.username]);
      expect(mockComparePassword).toHaveBeenCalledWith(loginCredentials.password, dbUser.password_hash);
      expect(mockGenerateToken).toHaveBeenCalledWith({ userId: dbUser.user_id, role: dbUser.role });
      expect(result).toEqual({
        user: expectedUser,
        token: 'mockAuthToken123',
      });
    });

    it('should throw an error if user does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No user found

      await expect(loginUser(loginCredentials)).rejects.toThrow('Invalid username or password.');
      expect(mockComparePassword).not.toHaveBeenCalled();
      expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should throw an error if password does not match', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbUser] });
      mockComparePassword.mockResolvedValue(false); // Password does not match

      await expect(loginUser(loginCredentials)).rejects.toThrow('Invalid username or password.');
      expect(mockGenerateToken).not.toHaveBeenCalled();
    });
  });
});
