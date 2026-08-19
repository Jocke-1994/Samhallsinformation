namespace Samhallsinformation.Data;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Models;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<CanonicalEvent>             Events                    => Set<CanonicalEvent>();
    public DbSet<Source>                     Sources                   => Set<Source>();
    public DbSet<UserPreference>             UserPreferences           => Set<UserPreference>();
    public DbSet<User>                       Users                     => Set<User>();
    public DbSet<UserDevice>                 UserDevices               => Set<UserDevice>();
    public DbSet<UserSourcePreference>       UserSourcePreferences     => Set<UserSourcePreference>();
    public DbSet<UserNotificationSetting>    UserNotificationSettings  => Set<UserNotificationSetting>();
    public DbSet<UserDoNotDisturbSchedule>   UserDoNotDisturbSchedules => Set<UserDoNotDisturbSchedule>();
    public DbSet<UserSettingAuditLog>        UserSettingAuditLogs      => Set<UserSettingAuditLog>();
    public DbSet<NotificationDeliveryLog>    NotificationDeliveryLogs  => Set<NotificationDeliveryLog>();
    public DbSet<PasswordResetToken>         PasswordResetTokens       => Set<PasswordResetToken>();
    public DbSet<EmailVerificationToken>     EmailVerificationTokens   => Set<EmailVerificationToken>();
    public DbSet<RefreshToken>               RefreshTokens             => Set<RefreshToken>();
    public DbSet<UserPolisenFilter>          UserPolisenFilters        => Set<UserPolisenFilter>();
    public DbSet<UserSavedEvent>             UserSavedEvents           => Set<UserSavedEvent>();
    public DbSet<SupportTicket>              SupportTickets            => Set<SupportTicket>();
    public DbSet<SupportTicketMessage>       SupportTicketMessages     => Set<SupportTicketMessage>();
    public DbSet<SupportTicketScheduledAction> SupportTicketScheduledActions => Set<SupportTicketScheduledAction>();
    public DbSet<FeatureIdea>                FeatureIdeas              => Set<FeatureIdea>();
    public DbSet<FeatureIdeaTester>          FeatureIdeaTesters        => Set<FeatureIdeaTester>();
    public DbSet<FeatureIdeaChecklistItem>   FeatureIdeaChecklistItems => Set<FeatureIdeaChecklistItem>();
    public DbSet<IngestorRunLog>             IngestorRunLogs           => Set<IngestorRunLog>();
    public DbSet<FaqItem>                    FaqItems                  => Set<FaqItem>();
    public DbSet<SiteSettings>               SiteSettings              => Set<SiteSettings>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<NullableUtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CanonicalEvent>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.ExternalId);
            entity.HasIndex(e => e.Geography);
            entity.HasIndex(e => e.PublishedAt);
        });

        modelBuilder.Entity<Source>(entity =>
        {
            entity.HasKey(e => e.Id);
        });

        modelBuilder.Entity<UserPreference>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.PushEnabled).HasDefaultValue(true);
            entity.Property(e => e.PushNyaHandelser).HasDefaultValue(true);
            entity.Property(e => e.PushNyVersion).HasDefaultValue(true);
            entity.Property(e => e.AuthProvider).HasDefaultValue("local");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
        });

        modelBuilder.Entity<UserDevice>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Endpoint).IsUnique();
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserSourcePreference>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.SourceId }).IsUnique();
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Source).WithMany().HasForeignKey(e => e.SourceId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserNotificationSetting>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.SourceId }).IsUnique();
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Source).WithMany().HasForeignKey(e => e.SourceId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserDoNotDisturbSchedule>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserSettingAuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.ChangedAt);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<NotificationDeliveryLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.SentAt);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Token).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<IngestorRunLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.RunAt);
            entity.HasIndex(e => e.SourceId);
        });

        modelBuilder.Entity<EmailVerificationToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Token).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserPolisenFilter>(entity =>
        {
            entity.HasKey(e => e.UserId);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserSavedEvent>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.EventId }).IsUnique();
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Event).WithMany().HasForeignKey(e => e.EventId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SupportTicket>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TicketNumber).IsUnique();
            entity.HasIndex(e => e.CreatedByUserId);
            entity.HasIndex(e => e.AssignedToUserId);
            entity.HasIndex(e => e.Status);
            entity.HasOne(e => e.CreatedByUser).WithMany().HasForeignKey(e => e.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.AssignedToUser).WithMany().HasForeignKey(e => e.AssignedToUserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SupportTicketMessage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TicketId);
            entity.HasOne(e => e.Ticket).WithMany().HasForeignKey(e => e.TicketId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.AuthorUser).WithMany().HasForeignKey(e => e.AuthorUserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SupportTicketScheduledAction>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TicketId);
            entity.HasIndex(e => new { e.Executed, e.ScheduledAt });
            entity.HasOne(e => e.Ticket).WithMany().HasForeignKey(e => e.TicketId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.CreatedByUser).WithMany().HasForeignKey(e => e.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.ReassignToUser).WithMany().HasForeignKey(e => e.ReassignToUserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<FeatureIdea>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.IdeaNumber).IsUnique();
            entity.HasIndex(e => e.Stage);
            entity.HasIndex(e => e.SourceTicketId);
            entity.HasIndex(e => e.CreatedByUserId);
            entity.HasOne(e => e.SourceTicket).WithMany().HasForeignKey(e => e.SourceTicketId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.CreatedByUser).WithMany().HasForeignKey(e => e.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<FeatureIdeaTester>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.FeatureIdeaId, e.UserId }).IsUnique();
            entity.HasOne(e => e.Idea).WithMany().HasForeignKey(e => e.FeatureIdeaId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FeatureIdeaChecklistItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.FeatureIdeaId);
            entity.HasOne(e => e.Idea).WithMany().HasForeignKey(e => e.FeatureIdeaId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.DoneByUser).WithMany().HasForeignKey(e => e.DoneByUserId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<FaqItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Kategori);
        });

        modelBuilder.Entity<SiteSettings>(entity =>
        {
            entity.HasKey(e => e.Id);
        });
    }
}
