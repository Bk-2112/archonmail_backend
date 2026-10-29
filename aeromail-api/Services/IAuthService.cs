using AeroMail.Api.Models;

namespace AeroMail.Api.Services;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
    Task LogoutAsync(string jti);
    bool IsTokenRevoked(string jti);
}
