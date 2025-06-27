import { query } from '../config/db'; // Adjusted path
import { hashPassword, comparePassword } from '../utils/passwordUtils'; // Adjusted path
import { generateToken, JwtPayload } from '../utils/jwtUtils'; // Adjusted path
import { v4 as uuidv4 } from 'uuid';

// Basic user type - expand as needed
interface User {
  user_id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  full_name?: string;
}

export const registerUser = async (userData: Pick<User, 'username' | 'email' | 'full_name'> & {password: string}, role: string = 'customer') => {
  const { username, email, password, full_name } = userData;

  // Check if user already exists
  const existingUser = await query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
  if (existingUser.rows.length > 0) {
    throw new Error('User with this username or email already exists.');
  }

  const hashedPassword = await hashPassword(password);
  const userId = uuidv4(); // Generate UUID for new user

  const newUser = await query(
    'INSERT INTO users (user_id, username, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, username, email, role, full_name',
    [userId, username, email, hashedPassword, full_name, role]
  );

  return newUser.rows[0];
};

export const loginUser = async (credentials: Pick<User, 'username'> & {password: string}) => {
  const { username, password } = credentials;

  const result = await query('SELECT user_id, username, email, password_hash, role, full_name FROM users WHERE username = $1', [username]);
  if (result.rows.length === 0) {
    throw new Error('Invalid username or password.');
  }

  const user: User = result.rows[0];

  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid username or password.');
  }

  const tokenPayload: JwtPayload = {
    userId: user.user_id,
    role: user.role,
  };
  const token = generateToken(tokenPayload);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, token };
};
