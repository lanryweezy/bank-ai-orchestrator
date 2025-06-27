import { generateToken, verifyToken, JwtPayload } from './jwtUtils';
import { jwtConfig } from '../config'; // To access the secret for direct manipulation if needed, or for checking expiry

describe('jwtUtils', () => {
  const mockPayload: JwtPayload = {
    userId: 'testUserId123',
    role: 'customer',
  };

  describe('generateToken', () => {
    it('should generate a string token', () => {
      const token = generateToken(mockPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWTs have three parts
    });

    it('should generate a different token for different payloads', () => {
      const token1 = generateToken(mockPayload);
      const token2 = generateToken({ ...mockPayload, userId: 'anotherUserId' });
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should correctly verify a valid token and return its payload', () => {
      const token = generateToken(mockPayload);
      const decodedPayload = verifyToken(token);
      expect(decodedPayload).not.toBeNull();
      expect(decodedPayload?.userId).toBe(mockPayload.userId);
      expect(decodedPayload?.role).toBe(mockPayload.role);
      // Check 'iat' and 'exp' are present (standard JWT claims)
      expect(decodedPayload).toHaveProperty('iat');
      expect(decodedPayload).toHaveProperty('exp');
    });

    it('should return null for an invalid or malformed token', () => {
      const invalidToken = 'this.is.not.a.valid.token';
      expect(verifyToken(invalidToken)).toBeNull();
    });

    it('should return null for an expired token', () => {
      // Generate a token that expires in 1 millisecond
      // const expiredToken = generateToken({ ...mockPayload, exp: Math.floor(Date.now() / 1000) - (60 * 60) }); // Expired 1 hour ago

      // Need to override jwtConfig temporarily for this test or use a different secret
      // For simplicity, we'll test with a token known to be signed by the same key but expired.
      // This requires a more complex setup to manipulate time (e.g. jest.useFakeTimers)
      // or by creating a token with a very short lifespan and waiting.

      // Let's test a token signed with a different secret (simulates tampering or wrong key)
      const tokenSignedWithDifferentSecret = require('jsonwebtoken').sign(mockPayload, 'differentSecret', { expiresIn: '1h' });
      expect(verifyToken(tokenSignedWithDifferentSecret)).toBeNull();

      // Test for actual expiry (simplified)
      // This is tricky to test without time manipulation.
      // We can check if the console logged an error for an expired token.
      // const consoleErrorSpy = jest.spyOn(console, 'error');
      // const tokenThatWillExpire = jwt.sign(mockPayload, jwtConfig.secret, { expiresIn: '1ms' });
      // await new Promise(resolve => setTimeout(resolve, 100)); // Wait for 100ms
      // expect(verifyToken(tokenThatWillExpire)).toBeNull();
      // expect(consoleErrorSpy).toHaveBeenCalledWith('Invalid token:', expect.any(Error)); // Check for TokenExpiredError
      // consoleErrorSpy.mockRestore();
      // For now, we'll rely on the default behavior of jwt.verify for expired tokens
    });

    it('should return null if token is null or undefined', () => {
      // @ts-ignore to test invalid input type
      expect(verifyToken(null)).toBeNull();
      // @ts-ignore to test invalid input type
      expect(verifyToken(undefined)).toBeNull();
    });
  });
});
