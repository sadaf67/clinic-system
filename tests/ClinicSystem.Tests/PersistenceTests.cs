using ClinicSystem.Domain.Entities;
using ClinicSystem.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace ClinicSystem.Tests;

public class PersistenceTests
{
    private static ClinicDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ClinicDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        return new ClinicDbContext(options);
    }

    [Fact]
    public async Task SaveChanges_creates_audit_record()
    {
        await using var db = CreateDb();
        db.ClinicBranches.Add(new ClinicBranch { Name = "Main" });
        await db.SaveChangesAsync();
        var audit = await db.AuditLogs.SingleAsync();
        Assert.Equal("ClinicBranch", audit.EntityType);
        Assert.Equal("Added", audit.Action);
    }

    [Fact]
    public async Task Soft_deleted_branch_is_filtered()
    {
        await using var db = CreateDb();
        var branch = new ClinicBranch { Name = "Temporary" };
        db.ClinicBranches.Add(branch);
        await db.SaveChangesAsync();
        branch.MarkAsDeleted();
        await db.SaveChangesAsync();
        Assert.Empty(await db.ClinicBranches.ToListAsync());
        Assert.Single(await db.ClinicBranches.IgnoreQueryFilters().ToListAsync());
    }
}
