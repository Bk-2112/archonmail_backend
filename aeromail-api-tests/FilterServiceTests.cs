using System;
using System.Linq;
using System.Reflection;
using AeroMail.Api.Models;
using AeroMail.Api.Services;
using Xunit;

namespace AeroMail.Tests;

/// <summary>
/// Unit tests for FilterService pattern-matching logic.
/// MatchesFilter is private static, so we exercise it via reflection to avoid
/// requiring a live database.  The logic is deterministic and dependency-free.
/// </summary>
public class FilterServiceTests
{
    // Grab the private static MatchesFilter method via reflection once.
    private static readonly MethodInfo _matchesFilter =
        typeof(FilterService)
            .GetMethod("MatchesFilter", BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("MatchesFilter method not found via reflection.");

    /// <summary>Invoke MatchesFilter(filter, message) and return the bool result.</summary>
    private static bool MatchesFilter(AeroFilter filter, AeroMessage message)
    {
        var result = _matchesFilter.Invoke(null, new object[] { filter, message });
        return (bool)result!;
    }

    // ─── Helper ──────────────────────────────────────────────────────────────

    private static AeroMessage MakeMessage(
        string from = "sender@example.com",
        string subject = "Hello",
        string[] to = null!,
        string snippet = "",
        string body = "")
    {
        return new AeroMessage(
            Uid: 1,
            MessageId: Guid.NewGuid().ToString(),
            Subject: subject,
            From: from,
            FromName: "Sender",
            To: to ?? new[] { "recipient@example.com" },
            Date: DateTime.UtcNow,
            IsRead: false,
            IsStarred: false,
            Snippet: snippet,
            Body: body,
            Folder: "INBOX",
            Labels: Array.Empty<string>()
        );
    }

    private static AeroFilter MakeFilter(
        string? fromPattern = null,
        string? toPattern = null,
        string? subjectPattern = null,
        string? hasWords = null,
        string action = "archive")
    {
        return new AeroFilter
        {
            Id = Guid.NewGuid(),
            AccountId = Guid.NewGuid(),
            FromPattern = fromPattern,
            ToPattern = toPattern,
            SubjectPattern = subjectPattern,
            HasWords = hasWords,
            Action = action,
            IsActive = true,
        };
    }

    // ─── From Pattern ────────────────────────────────────────────────────────

    [Fact]
    public void MatchesFilter_FromPattern_MatchesCaseInsensitive()
    {
        var filter  = MakeFilter(fromPattern: "EXAMPLE.COM");
        var message = MakeMessage(from: "sender@example.com");

        Assert.True(MatchesFilter(filter, message));
    }

    [Fact]
    public void MatchesFilter_FromPattern_NoMatch()
    {
        var filter  = MakeFilter(fromPattern: "other.com");
        var message = MakeMessage(from: "sender@example.com");

        Assert.False(MatchesFilter(filter, message));
    }

    [Fact]
    public void MatchesFilter_FromPattern_PartialMatch()
    {
        var filter  = MakeFilter(fromPattern: "example");
        var message = MakeMessage(from: "user@example.com");

        Assert.True(MatchesFilter(filter, message));
    }

    // ─── Subject Pattern ─────────────────────────────────────────────────────

    [Fact]
    public void MatchesFilter_SubjectPattern_MatchesCaseInsensitive()
    {
        var filter  = MakeFilter(subjectPattern: "INVOICE");
        var message = MakeMessage(subject: "Invoice #1234");

        Assert.True(MatchesFilter(filter, message));
    }

    [Fact]
    public void MatchesFilter_SubjectPattern_NoMatch()
    {
        var filter  = MakeFilter(subjectPattern: "newsletter");
        var message = MakeMessage(subject: "Invoice #1234");

        Assert.False(MatchesFilter(filter, message));
    }

    // ─── To Pattern ──────────────────────────────────────────────────────────

    [Fact]
    public void MatchesFilter_ToPattern_MatchesOneOfMultipleRecipients()
    {
        var filter  = MakeFilter(toPattern: "team@");
        var message = MakeMessage(to: new[] { "alice@example.com", "team@example.com" });

        Assert.True(MatchesFilter(filter, message));
    }

    [Fact]
    public void MatchesFilter_ToPattern_NoMatch()
    {
        var filter  = MakeFilter(toPattern: "boss@");
        var message = MakeMessage(to: new[] { "alice@example.com" });

        Assert.False(MatchesFilter(filter, message));
    }

    // ─── HasWords ────────────────────────────────────────────────────────────

    [Fact]
    public void MatchesFilter_HasWords_AllWordsInSubject()
    {
        var filter  = MakeFilter(hasWords: "action required");
        var message = MakeMessage(subject: "Action Required: Your account");

        Assert.True(MatchesFilter(filter, message));
    }

    [Fact]
    public void MatchesFilter_HasWords_WordInBody()
    {
        var filter  = MakeFilter(hasWords: "unsubscribe");
        var message = MakeMessage(body: "Click here to unsubscribe from this mailing list.");

        Assert.True(MatchesFilter(filter, message));
    }

    [Fact]
    public void MatchesFilter_HasWords_WordInSnippet()
    {
        var filter  = MakeFilter(hasWords: "promo");
        var message = MakeMessage(snippet: "Special promo offer just for you");

        Assert.True(MatchesFilter(filter, message));
    }

    [Fact]
    public void MatchesFilter_HasWords_MissingWord_NoMatch()
    {
        var filter  = MakeFilter(hasWords: "urgent confidential");
        var message = MakeMessage(subject: "urgent notice", body: "please read");

        // "confidential" is not present anywhere → should not match
        Assert.False(MatchesFilter(filter, message));
    }

    // ─── No criteria (empty filter) ──────────────────────────────────────────

    [Fact]
    public void MatchesFilter_NoCriteria_AlwaysMatches()
    {
        var filter  = MakeFilter(); // all patterns null
        var message = MakeMessage();

        Assert.True(MatchesFilter(filter, message));
    }

    // ─── Multiple criteria (AND semantics) ───────────────────────────────────

    [Fact]
    public void MatchesFilter_MultiCriteria_AllMustMatch()
    {
        var filter = MakeFilter(
            fromPattern: "newsletter@",
            subjectPattern: "weekly digest"
        );

        var matchingMsg = MakeMessage(
            from: "newsletter@company.com",
            subject: "Your Weekly Digest"
        );
        var partialMsg = MakeMessage(
            from: "newsletter@company.com",
            subject: "Breaking News"  // subject doesn't match
        );

        Assert.True(MatchesFilter(filter, matchingMsg));
        Assert.False(MatchesFilter(filter, partialMsg));
    }
}
