import { encrypt, decrypt } from '../src/lib/auth';
import { validateEmail, validatePassword } from '../src/lib/security';

describe('Authentication Security', () => {
  it('should encrypt and decrypt data correctly', async () => {
    const testData = { userId: '123', sessionId: 'abc' };
    const encrypted = await encrypt(testData);
    const decrypted = await decrypt(encrypted);
    
    expect(decrypted.userId).toBe(testData.userId);
    expect(decrypted.sessionId).toBe(testData.sessionId);
  });

  it('should validate email addresses correctly', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
  });

  it('should validate passwords correctly', () => {
    const validPassword = 'StrongPass123!';
    const invalidPassword = 'weak';
    
    expect(validatePassword(validPassword).valid).toBe(true);
    expect(validatePassword(invalidPassword).valid).toBe(false);
  });
});