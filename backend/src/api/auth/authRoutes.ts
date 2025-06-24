import * as express from 'express';
import { registerUser, loginUser } from '../../services/authService'; // Adjusted path
import { z, ZodError } from 'zod';

const router: express.Router = express.Router();

// Zod schemas for validation
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  full_name: z.string().min(1, "Full name is required").optional(),
});

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

/**
 * @openapi
 * tags:
 *   name: Authentication
 *   description: User authentication and registration
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Creates a new user account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: johndoe@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: strongpassword123
 *               full_name:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       '201':
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 user:
 *                   type: object # Consider referencing a User schema if defined in components
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     role:
 *                       type: string
 *                     full_name:
 *                       type: string
 *                       nullable: true
 *       '400':
 *         description: Validation failed (invalid input)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '409':
 *         description: User with this username or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', async (req: express.Request, res: express.Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { username, email, password, full_name } = validatedData;

    const user = await registerUser({ username, email, password, full_name });
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.message.includes('already exists')) {
        return res.status(409).json({ message: error.message });
    }
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Log in an existing user
 *     description: Authenticates a user and returns a JWT token upon successful login.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               password:
 *                 type: string
 *                 example: strongpassword123
 *     responses:
 *       '200':
 *         description: User logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: # Consider referencing a User schema
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                       format: email
 *                     role:
 *                       type: string
 *                     full_name:
 *                       type: string
 *                       nullable: true
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       '400':
 *         description: Validation failed (invalid input)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Invalid username or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', async (req: express.Request, res: express.Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { username, password } = validatedData;

    const result = await loginUser({ username, password });
    res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.message.includes('Invalid username or password')) {
        return res.status(401).json({ message: error.message });
    }
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});

export default router;
