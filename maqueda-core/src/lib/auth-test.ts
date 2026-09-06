// Test authentication functions that work without a database

export async function verifySession() {
  // In a test environment, check localStorage
  if (typeof window !== 'undefined') {
    const testUser = localStorage.getItem('testUser');
    if (testUser) {
      return { isAuth: true, userId: 'test-user-id' };
    }
  }
  
  // Server-side or no test user
  return { isAuth: false };
}

export async function deleteSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('testUser');
  }
}