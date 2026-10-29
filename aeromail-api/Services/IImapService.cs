using AeroMail.Api.Models;

namespace AeroMail.Api.Services;

public interface IImapService
{
    Task<IEnumerable<AeroMessage>> GetMessagesAsync(string folder, int page, int pageSize);
    Task<AeroMessage?> GetMessageAsync(uint uid, string folder);
    Task<IEnumerable<AeroMessage>> SearchMessagesAsync(string query);
    Task<IEnumerable<FolderInfo>> GetFoldersAsync();
    Task UpdateFlagsAsync(uint uid, string folder, string[] flags, bool add);
    Task MoveMessageAsync(uint uid, string fromFolder, string toFolder);
    Task DeleteMessageAsync(uint uid, string folder);
}
