using AeroMail.Api.Models;
using FluentAssertions;

namespace AeroMail.Api.Tests;

/// <summary>
/// Tests for AeroMessage record model properties and derived fields.
/// </summary>
public class AeroMessageModelTests
{
    private static AeroMessage MakeMessage(
        uint uid = 42,
        string from = "sender@example.com",
        string[] ? to = null,
        DateTime? date = null,
        bool isRead = false,
        bool isStarred = false,
        string folder = "INBOX",
        string[] ? labels = null) =>
        new(
            Uid: uid,
            MessageId: $"<msg{uid}@example.com>",
            Subject: "Test Subject",
            From: from,
            FromName: "Test Sender",
            To: to ?? new[] { "recipient@example.com" },
            Date: date ?? DateTime.UtcNow,
            IsRead: isRead,
            IsStarred: isStarred,
            Snippet: "Test snippet",
            Body: "Test body",
            Folder: folder,
            Labels: labels ?? Array.Empty<string>()
        );

    [Fact]
    public void ImapUid_ReturnsUid()
    {
        var msg = MakeMessage(uid: 99);
        ((long)msg.Uid).Should().Be(msg.ImapUid);
    }

    [Fact]
    public void FromEmail_ReturnsFrom()
    {
        var msg = MakeMessage(from: "alice@test.com");
        msg.FromEmail.Should().Be("alice@test.com");
    }

    [Fact]
    public void ToEmails_ReturnsAsList()
    {
        var msg = MakeMessage(to: new[] { "a@test.com", "b@test.com" });
        msg.ToEmails.Should().ContainInOrder("a@test.com", "b@test.com");
    }

    [Fact]
    public void Timestamp_ConvertsDateToDateTimeOffset()
    {
        var date = new DateTime(2026, 3, 15, 12, 0, 0, DateTimeKind.Utc);
        var msg = MakeMessage(date: date);
        msg.Timestamp.UtcDateTime.Should().BeCloseTo(date, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void Labels_DefaultEmpty()
    {
        var msg = MakeMessage();
        msg.Labels.Should().BeEmpty();
    }

    [Fact]
    public void Labels_WithValues_Retained()
    {
        var msg = MakeMessage(labels: new[] { "work", "urgent" });
        msg.Labels.Should().ContainInOrder("work", "urgent");
    }

    [Fact]
    public void IsRead_Default_False()
    {
        var msg = MakeMessage(isRead: false);
        msg.IsRead.Should().BeFalse();
    }

    [Fact]
    public void IsStarred_WhenTrue_True()
    {
        var msg = MakeMessage(isStarred: true);
        msg.IsStarred.Should().BeTrue();
    }

    [Fact]
    public void CcEmails_DefaultEmpty()
    {
        var msg = MakeMessage();
        msg.CcEmails.Should().BeEmpty();
    }

    [Fact]
    public void HasAttachments_DefaultFalse()
    {
        var msg = MakeMessage();
        msg.HasAttachments.Should().BeFalse();
    }
}
