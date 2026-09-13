/**
 * E2E Helper Fixtures for CollabBoard Playwright Suite
 */

export const MOCK_USER_A = {
  uid: 'e2e-user-alice',
  email: 'alice@collabboard.dev',
  displayName: 'Alice Tester',
  token: 'mock-e2e-token-alice',
};

export const MOCK_USER_B = {
  uid: 'e2e-user-bob',
  email: 'bob@collabboard.dev',
  displayName: 'Bob Tester',
  token: 'mock-e2e-token-bob',
};

export async function loginAsUser(page, user = MOCK_USER_A) {
  await page.addInitScript((userData) => {
    sessionStorage.setItem('e2e_user', JSON.stringify(userData));
    window.__E2E_USER__ = userData;
  }, user);
}
