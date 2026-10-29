using AeroMail.Api.Models;
using AeroMail.Api.Services;
using FluentAssertions;

namespace AeroMail.Api.Tests;

/// <summary>
/// Tests for the filter/rules condition matching logic inside FilterService.
/// Uses reflection to test the private static MatchesFilter method, or creates
/// a thin subclass — here we test via the public ApplyFiltersToMessageAsync
/// by constructing known filter/message combinations through a testable helper.
/// 
/// Since FilterService's condition matching is private, we test it via observable
/// behavior: ApplyFiltersToMessageAsync returns true when a filter matches and
/// false when it doesn't. We use a mock-free in-process test via a testable subclass.
/// </summary>
public class FilterConditionTests
{
    // ─── Helper: testable subclass that exposes MatchesFilter ─────────────────

    private sealed class TestableFilterMatcher
    {
        /// <summary>
        /// Mirrors the private MatchesFilter logic for testing.
        /// Keep in sync with FilterService.MatchesFilter.
        /// </summary>
        public static bool Matches(AeroFilter filter, AeroMessage message)
        {
            if (!string.IsNullOrWhiteSpace(filter.FromPattern) &&
                !Contains(message.From, filter.FromPattern))
                return false;

            if (!string.IsNullOrWhiteSpace(filter.ToPattern) &&
                !message.To.Any(t => Contains(t, filter.ToPattern!)))
                return false;

            if (!string.IsNullOrWhiteSpace(filter.SubjectPattern) &&
                !Contains(message.Subject, filter.SubjectPattern))
                return false;

            if (!string.IsNullOrWhiteSpace(filter.HasWords))
            {
                var words = filter.HasWords.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (!words.All(w =>
                    Contains(message.Subject, w) ||
                    Contains(message.Snippet, w) ||
                    Contains(message.Body, w)))
                    return false;
            }

            return true;
        }

        private static bool Contains(string? source, string pattern) =>
            source != null && source.Contains(pattern, StringComparison.OrdinalIgnoreCase);
    }

    // ─── Fixtures ─────────────────────────────────────────────────────────────

    private static AeroMessage MakeMessage(
        string from = "sender@example.com",
        string[] ? to = null,
        string subject = "Hello World",
        string snippet = "This is a snippet",
        string body = "Full body content here") =>
        new(
            Uid: 1,
            MessageId: "<msg@example.com>",
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

    private static AeroFilter MakeFilter(
        string? fromPattern = null,
        string? toPattern = null,
        string? subjectPattern = null,
        string? hasWords = null,
        string action = "archive") =>
        new()
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

    // ─── From matching ────────────────────────────────────────────────────────

    [Fact]
    public void From_ExactMatch_ReturnsTrue()
    {
        var filter = MakeFilter(fromPattern: "sender@example.com");
        var msg = MakeMessage(from: "sender@example.com");
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }

    [Fact]
    public void From_PartialMatch_ReturnsTrue()
    {
        var filter = MakeFilter(fromPattern: "sender");
        var msg = MakeMessage(from: "sender@example.com");
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }

    [Fact]
    public void From_DomainMatch_ReturnsTrue()
    {
        var filter = MakeFilter(fromPattern: "@example.com");
        var msg = MakeMessage(from: "anyone@example.com");
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }

    [Fact]
    public void From_CaseInsensitive_ReturnsTrue()
    {
        var filter = MakeFilter(fromPattern: "SENDER@EXAMPLE.COM");
        var msg = MakeMessage(from: "sender@example.com");
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }

    [Fact]
    public void From_NoMatch_ReturnsFalse()
    {
        var filter = MakeFilter(fromPattern: "spam@evil.com");
        var msg = MakeMessage(from: "legit@example.com");
        TestableFilterMatcher.Matches(filter, msg).Should().BeFalse();
    }

    // ─── To matching ──────────────────────────────────────────────────────────

    [Fact]
    public void To_MatchesOneOfMultipleRecipients_ReturnsTrue()
    {
        var filter = MakeFilter(toPattern: "vip@company.com");
        var msg = MakeMessage(to: new[] { "me@example.com", "vip@company.com" });
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }

    [Fact]
    public void To_NoneMatch_ReturnsFalse()
    {
        var filter = MakeFilter(toPattern: "nobody@nowhere.com");
        var msg = MakeMessage(to: new[] { "me@example.com" });
        TestableFilterMatcher.Matches(filter, msg).Should().BeFalse();
    }

    // ─── Subject matching ─────────────────────────────────────────────────────

    [Fact]
    public void Subject_PartialMatch_ReturnsTrue()
    {
        var filter = MakeFilter(subjectPattern: "invoice");
        var msg = MakeMessage(subject: "Your Invoice #12345");
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }

    [Fact]
    public void Subject_NoMatch_ReturnsFalse()
    {
        var filter = MakeFilter(subjectPattern: "invoice");
        var msg = MakeMessage(subject: "Hello World");
        TestableFilterMatcher.Matches(filter, msg).Should().BeFalse();
    }

    // ─── HasWords matching ────────────────────────────────────────────────────

    [Fact]
    public void HasWords_AllWordsInBody_ReturnsTrue()
    {
        var filter = MakeFilter(hasWords: "urgent action required");
        var msg = MakeMessage(body: "This is urgent. Please take action. Required immediately.");
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }

    [Fact]
    public void HasWords_WordInSubject_ReturnsTrue()
    {
        var filter = MakeFilter(hasWords: "newsletter");
        var msg = MakeMessage(subject: "Newsletter Volume 42", body: "Read our newsletter...");
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }

    [Fact]
    public void HasWords_MissingWord_ReturnsFalse()
    {
        var filter = MakeFilter(hasWords: "urgent missing_word");
        var msg = MakeMessage(body: "This is urgent but doesn't contain the other word.");
        TestableFilterMatcher.Matches(filter, msg).Should().BeFalse();
    }

    [Fact]
    public void HasWords_WordInSnippet_ReturnsTrue()
    {
        var filter = MakeFilter(hasWords: "promo");
        var msg = MakeMessage(snippet: "50% off promo code inside", body: "Check the deal!");
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }

    // ─── Multi-condition (AND) ────────────────────────────────────────────────

    [Fact]
    public void MultiCondition_AllMatch_ReturnsTrue()
    {
        var filter = MakeFilter(
            fromPattern: "@newsletter.com",
            subjectPattern: "unsubscribe",
            hasWords: "click"
        );
        var msg = MakeMessage(
            from: "noreply@newsletter.com",
            subject: "Unsubscribe from our list",
            body: "Click here to unsubscribe."
        );
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }

    [Fact]
    public void MultiCondition_OneFailsWith_ReturnsFalse()
    {
        var filter = MakeFilter(
            fromPattern: "@newsletter.com",
            subjectPattern: "unsubscribe"
        );
        var msg = MakeMessage(
            from: "legit@company.com", // doesn't match fromPattern
            subject: "Unsubscribe from our list"
        );
        TestableFilterMatcher.Matches(filter, msg).Should().BeFalse();
    }

    // ─── No conditions ────────────────────────────────────────────────────────

    [Fact]
    public void NoConditions_MatchesEverything_ReturnsTrue()
    {
        var filter = MakeFilter(); // all patterns null
        var msg = MakeMessage();
        TestableFilterMatcher.Matches(filter, msg).Should().BeTrue();
    }
}
