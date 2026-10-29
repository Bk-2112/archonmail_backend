using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using AeroMail.Api.Services;

namespace AeroMail.Api.Controllers;

[ApiController]
[Route("api/folders")]
[Authorize]
public class FoldersController : ControllerBase
{
    private readonly IImapService _imapService;

    public FoldersController(IImapService imapService)
    {
        _imapService = imapService;
    }

    /// <summary>
    /// GET /api/folders
    /// List all IMAP folders/mailboxes.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetFolders()
    {
        var folders = await _imapService.GetFoldersAsync();
        return Ok(folders);
    }
}
