namespace Samhallsinformation.Data;

using Microsoft.EntityFrameworkCore;
using Samhallsinformation.Models;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<CanonicalEvent> Events => Set<CanonicalEvent>();
    public DbSet<Source> Sources => Set<Source>();
    public DbSet<UserPreference> UserPreferences => Set<UserPreference>();
    public DbSet<User> Users => Set<User>();

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
        });
    }
}
