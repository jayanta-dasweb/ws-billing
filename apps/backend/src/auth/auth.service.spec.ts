import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('generates unique CSRF tokens', () => {
    const service = Object.create(AuthService.prototype) as AuthService;
    const a = service.generateCsrfToken();
    const b = service.generateCsrfToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });
});
