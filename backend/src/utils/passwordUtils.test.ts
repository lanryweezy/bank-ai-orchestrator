import { hashPassword, comparePassword } from './passwordUtils';

describe('passwordUtils', () => {
  const plainPassword = 'mySecretPassword123';
  let hashedPassword = '';

  beforeAll(async () => {
    // Hash a password once to use in tests
    hashedPassword = await hashPassword(plainPassword);
  });

  describe('hashPassword', () => {
    it('should return a string', async () => {
      expect(typeof hashedPassword).toBe('string');
    });

    it('should not return the plain password', async () => {
      expect(hashedPassword).not.toBe(plainPassword);
    });

    it('should produce a different hash for the same password if called again (due to salt)', async () => {
      const hashedPasswordAgain = await hashPassword(plainPassword);
      expect(hashedPasswordAgain).not.toBe(hashedPassword);
    });
  });

  describe('comparePassword', () => {
    it('should return true for a correct password', async () => {
      const isMatch = await comparePassword(plainPassword, hashedPassword);
      expect(isMatch).toBe(true);
    });

    it('should return false for an incorrect password', async () => {
      const isMatch = await comparePassword('wrongPassword', hashedPassword);
      expect(isMatch).toBe(false);
    });

    it('should return false for an empty password if original is not empty', async () => {
      const isMatch = await comparePassword('', hashedPassword);
      expect(isMatch).toBe(false);
    });

    it('should handle non-string inputs by throwing an error (bcrypt behavior)', async () => {
      // Bcrypt typically throws if inputs are not strings, or if hash is malformed.
      // This test depends on the underlying bcryptjs library's error handling.
      // @ts-ignore to test invalid input type
      await expect(comparePassword(null, hashedPassword)).rejects.toThrow();
      // @ts-ignore to test invalid input type
      await expect(comparePassword(plainPassword, null)).rejects.toThrow();
    });
  });
});
