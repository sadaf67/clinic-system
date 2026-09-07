// ══════════════════════════════════════════════════════════════
// این کلاس "پل ارتباطی" بین کد C# و دیتابیس SQL Server هست
// وقتی می‌خوایم از دیتابیس چیزی بخونیم یا بنویسیم، از این کلاس استفاده می‌کنیم
// EF Core (Entity Framework Core) این کار رو آسون می‌کنه:
// ما با آبجکت‌های C# کار می‌کنیم، EF اون‌ها رو به SQL تبدیل می‌کنه
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Common;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace ClinicSystem.Infrastructure.Data;

// IdentityDbContext یعنی از دیتابیس کاربران آماده‌ی مایکروسافت استفاده می‌کنیم
// ApplicationUser کاربر ما هست، IdentityRole<Guid> نقش‌ها هستن
public class ClinicDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    // سازنده - تنظیمات اتصال به دیتابیس از بیرون داده میشه (Dependency Injection)
    public ClinicDbContext(DbContextOptions<ClinicDbContext> options) : base(options) { }

    // ═══ جداول دیتابیس ═══════════════════════════════════════
    // هر DbSet یه جدول در دیتابیس هست
    // وقتی می‌نویسیم context.Patients.ToList() یعنی SELECT * FROM Patients

    public DbSet<Patient> Patients => Set<Patient>();                           // جدول بیماران
    public DbSet<Appointment> Appointments => Set<Appointment>();               // جدول نوبت‌ها
    public DbSet<MedicalRecord> MedicalRecords => Set<MedicalRecord>();         // جدول پرونده‌های پزشکی
    public DbSet<MedicalFile> MedicalFiles => Set<MedicalFile>();               // جدول فایل‌های پزشکی
    public DbSet<Prescription> Prescriptions => Set<Prescription>();            // جدول نسخه‌ها
    public DbSet<PrescriptionItem> PrescriptionItems => Set<PrescriptionItem>(); // جدول اقلام نسخه
    public DbSet<VitalSign> VitalSigns => Set<VitalSign>();                     // جدول علائم حیاتی
    public DbSet<OnlineConsultation> Consultations => Set<OnlineConsultation>(); // جدول مشاوره‌های آنلاین
    public DbSet<ConsultationMessage> ConsultationMessages => Set<ConsultationMessage>(); // جدول پیام‌های چت
    public DbSet<Notification> Notifications => Set<Notification>();            // جدول اعلان‌ها
    public DbSet<WorkSchedule> WorkSchedules => Set<WorkSchedule>();            // جدول برنامه کاری
    public DbSet<DayOff> DaysOff => Set<DayOff>();                             // جدول روزهای تعطیل
    public DbSet<ClinicBranch> ClinicBranches => Set<ClinicBranch>();
    public DbSet<VisitQueueItem> VisitQueueItems => Set<VisitQueueItem>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<MedicalRecordVersion> MedicalRecordVersions => Set<MedicalRecordVersion>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<InsuranceClaim> InsuranceClaims => Set<InsuranceClaim>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<CalendarSyncRecord> CalendarSyncRecords => Set<CalendarSyncRecord>();
    public DbSet<TelemedicineSession> TelemedicineSessions => Set<TelemedicineSession>();

    // این متد تنظیمات جداول دیتابیس رو مشخص می‌کنه (شبیه طراحی دیتابیس)
    protected override void OnModelCreating(ModelBuilder builder)
    {
        // اول تنظیمات پیش‌فرض Identity رو اعمال کن
        base.OnModelCreating(builder);

        // ═══ تغییر نام جداول Identity ════════════════════════
        // مایکروسافت اسم‌های پیش‌فرض مثل AspNetUsers داره
        // ما اسم‌های ساده‌تر می‌خوایم
        builder.Entity<ApplicationUser>().ToTable("Users");         // جدول کاربران
        builder.Entity<IdentityRole<Guid>>().ToTable("Roles");      // جدول نقش‌ها
        builder.Entity<IdentityUserRole<Guid>>().ToTable("UserRoles");   // کدوم کاربر چه نقشی داره
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("UserClaims"); // ادعاهای کاربر
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("UserLogins"); // لاگین‌های خارجی
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("RoleClaims"); // ادعاهای نقش
        builder.Entity<IdentityUserToken<Guid>>().ToTable("UserTokens"); // توکن‌های کاربر

        // ═══ فیلتر حذف نرم (Soft Delete) ════════════════════
        // این فیلترها می‌گن: وقتی از دیتابیس می‌خونی، ردیف‌های حذف شده رو نشون نده
        // یعنی IsDeleted=true ها نادیده گرفته میشن - مثل اینکه اصلاً وجود ندارن
        builder.Entity<Patient>().HasQueryFilter(p => !p.IsDeleted);
        builder.Entity<Appointment>().HasQueryFilter(a => !a.IsDeleted);
        builder.Entity<MedicalRecord>().HasQueryFilter(m => !m.IsDeleted);
        builder.Entity<Prescription>().HasQueryFilter(p => !p.IsDeleted);
        builder.Entity<PrescriptionItem>().HasQueryFilter(i => !i.IsDeleted && !i.Prescription.IsDeleted);
        builder.Entity<VitalSign>().HasQueryFilter(v => !v.IsDeleted && !v.Patient.IsDeleted);
        builder.Entity<OnlineConsultation>().HasQueryFilter(c => !c.IsDeleted && !c.Patient.IsDeleted);
        builder.Entity<ConsultationMessage>().HasQueryFilter(m => !m.IsDeleted && !m.Consultation.IsDeleted);
        builder.Entity<MedicalFile>().HasQueryFilter(x => !x.IsDeleted &&
            (x.MedicalRecord == null || !x.MedicalRecord.IsDeleted) &&
            (x.Consultation == null || !x.Consultation.IsDeleted));
        builder.Entity<Notification>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<WorkSchedule>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<DayOff>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<ClinicBranch>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<VisitQueueItem>().HasQueryFilter(x => !x.IsDeleted && !x.Appointment.IsDeleted);
        builder.Entity<MedicalRecordVersion>().HasQueryFilter(x => !x.IsDeleted && !x.MedicalRecord.IsDeleted);
        builder.Entity<Invoice>().HasQueryFilter(x => !x.IsDeleted && !x.Patient.IsDeleted);
        builder.Entity<InvoiceItem>().HasQueryFilter(x => !x.IsDeleted && !x.Invoice.IsDeleted);
        builder.Entity<Payment>().HasQueryFilter(x => !x.IsDeleted && !x.Invoice.IsDeleted);
        builder.Entity<InsuranceClaim>().HasQueryFilter(x => !x.IsDeleted && !x.Invoice.IsDeleted);
        builder.Entity<InventoryItem>().HasQueryFilter(x => !x.IsDeleted);
        builder.Entity<InventoryTransaction>().HasQueryFilter(x => !x.IsDeleted && !x.InventoryItem.IsDeleted);
        builder.Entity<CalendarSyncRecord>().HasQueryFilter(x => !x.IsDeleted && !x.Appointment.IsDeleted);
        builder.Entity<TelemedicineSession>().HasQueryFilter(x => !x.IsDeleted && !x.Appointment.IsDeleted);

        // ═══ تنظیمات جدول بیمار ══════════════════════════════
        builder.Entity<Patient>(e =>
        {
            // کد ملی باید یکتا باشه - دو بیمار با یه کد ملی نمیشه
            e.HasIndex(p => p.NationalCode).IsUnique();
            // هر بیمار فقط یه حساب کاربری داشته باشه
            e.HasIndex(p => p.UserId).IsUnique();
            // کد ملی حداکثر ۱۰ کاراکتر و اجباریه
            e.Property(p => p.NationalCode).HasMaxLength(10).IsRequired();
        });

        // ═══ تنظیمات جدول نوبت ═══════════════════════════════
        builder.Entity<Appointment>(e =>
        {
            e.HasIndex(a => new { a.DoctorId, a.AppointmentDate, a.StartTime })
                .IsUnique()
                .HasFilter("[IsDeleted] = 0 AND [Status] <> 3");
            // رابطه بین نوبت و بیمار: هر بیمار می‌تونه چند نوبت داشته باشه
            // Restrict یعنی: اگه بیمار نوبت داشت، نمیشه بیمار رو حذف کرد
            e.HasOne(a => a.Patient).WithMany(p => p.Appointments)
                .HasForeignKey(a => a.PatientId).OnDelete(DeleteBehavior.Restrict);
            // رابطه بین نوبت و دکتر
            e.HasOne(a => a.Doctor).WithMany()
                .HasForeignKey(a => a.DoctorId).OnDelete(DeleteBehavior.Restrict);
        });

        // ═══ تنظیمات نسخه ════════════════════════════════════
        builder.Entity<Prescription>(e =>
        {
            // وقتی نسخه حذف بشه، همه داروهاش هم حذف بشن (Cascade)
            e.HasMany(p => p.Items).WithOne(i => i.Prescription)
                .HasForeignKey(i => i.PrescriptionId).OnDelete(DeleteBehavior.Cascade);
            // نسخه به بیمار و دکتر وصله - نمی‌تونیم بیمار یا دکتر رو حذف کنیم اگه نسخه دارن
            e.HasOne(p => p.Patient).WithMany(patient => patient.Prescriptions)
                .HasForeignKey(p => p.PatientId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(p => p.Doctor).WithMany()
                .HasForeignKey(p => p.DoctorId).OnDelete(DeleteBehavior.Restrict);
        });

        // ═══ تنظیمات مشاوره آنلاین ═══════════════════════════
        builder.Entity<OnlineConsultation>(e =>
        {
            // وقتی مشاوره حذف بشه، همه پیام‌هاش هم حذف بشن
            e.HasMany(c => c.Messages).WithOne(m => m.Consultation)
                .HasForeignKey(m => m.ConsultationId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(c => c.Doctor).WithMany()
                .HasForeignKey(c => c.DoctorId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(c => c.Patient).WithMany(patient => patient.Consultations)
                .HasForeignKey(c => c.PatientId).OnDelete(DeleteBehavior.Restrict);
            // هزینه مشاوره: ۱۰ رقم کل، بدون اعشار (ریال نیاز به اعشار نداره)
            e.Property(c => c.Fee).HasPrecision(10, 0);
        });

        // ═══ تنظیمات پرونده پزشکی ════════════════════════════
        builder.Entity<MedicalRecord>(e =>
        {
            e.HasOne(m => m.Patient).WithMany(p => p.MedicalRecords)
                .HasForeignKey(m => m.PatientId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(m => m.Doctor).WithMany()
                .HasForeignKey(m => m.DoctorId).OnDelete(DeleteBehavior.Restrict);
            // دقت اعداد اعشاری - وزن: ۹۹۹.۹۹، قد: ۲۵۰.۰۰، دما: ۴۱.۵
            e.Property(m => m.Weight).HasPrecision(5, 2);
            e.Property(m => m.Height).HasPrecision(5, 2);
            e.Property(m => m.Temperature).HasPrecision(4, 1);
            e.Property(m => m.BloodSugar).HasPrecision(6, 2);
        });

        // ═══ تنظیمات اعلان ════════════════════════════════════
        builder.Entity<Notification>(e =>
        {
            e.HasOne(n => n.User).WithMany()
                .HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<MedicalFile>(e =>
        {
            e.HasOne(x => x.MedicalRecord).WithMany(x => x.Files)
                .HasForeignKey(x => x.MedicalRecordId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Consultation).WithMany(x => x.Attachments)
                .HasForeignKey(x => x.ConsultationId).OnDelete(DeleteBehavior.Restrict);
        });

        // ═══ تنظیمات علائم حیاتی ═════════════════════════════
        builder.Entity<VitalSign>(e =>
        {
            e.HasOne(v => v.Patient).WithMany(patient => patient.VitalSigns)
                .HasForeignKey(v => v.PatientId).OnDelete(DeleteBehavior.Restrict);
            // دقت اندازه‌گیری: ۸ رقم کل، ۲ رقم اعشار
            e.Property(v => v.Value).HasPrecision(8, 2);
            // ایندکس برای جستجوی سریع تاریخچه یه بیمار برای یه نوع اندازه‌گیری
            e.HasIndex(v => new { v.PatientId, v.Type, v.RecordedAt });
        });

        builder.Entity<ClinicBranch>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.HasIndex(x => x.Name).IsUnique();
        });

        builder.Entity<VisitQueueItem>(e =>
        {
            e.HasIndex(x => x.AppointmentId).IsUnique();
            e.HasIndex(x => new { x.BranchId, x.CheckedInAt, x.QueueNumber });
            e.HasOne(x => x.Appointment).WithOne(x => x.QueueItem)
                .HasForeignKey<VisitQueueItem>(x => x.AppointmentId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<AuditLog>(e =>
        {
            e.HasIndex(x => new { x.EntityType, x.EntityId, x.CreatedAt });
            e.Property(x => x.Action).HasMaxLength(32);
            e.Property(x => x.EntityType).HasMaxLength(128);
        });

        builder.Entity<MedicalRecordVersion>(e =>
        {
            e.HasIndex(x => new { x.MedicalRecordId, x.VersionNumber }).IsUnique();
            e.HasOne(x => x.MedicalRecord).WithMany(x => x.Versions)
                .HasForeignKey(x => x.MedicalRecordId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<OutboxMessage>(e =>
        {
            e.HasIndex(x => x.IdempotencyKey).IsUnique();
            e.HasIndex(x => new { x.ProcessedAt, x.AvailableAt });
        });

        builder.Entity<Invoice>(e =>
        {
            e.HasIndex(x => x.Number).IsUnique();
            e.Property(x => x.DiscountAmount).HasPrecision(18, 0);
            e.Property(x => x.InsuranceAmount).HasPrecision(18, 0);
            e.HasOne(x => x.Patient).WithMany(x => x.Invoices)
                .HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<InvoiceItem>(e =>
        {
            e.Property(x => x.Quantity).HasPrecision(18, 2);
            e.Property(x => x.UnitPrice).HasPrecision(18, 0);
            e.HasOne(x => x.Invoice).WithMany(x => x.Items)
                .HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<Payment>(e =>
        {
            e.HasIndex(x => x.IdempotencyKey).IsUnique();
            e.Property(x => x.Amount).HasPrecision(18, 0);
            e.HasOne(x => x.Invoice).WithMany(x => x.Payments)
                .HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<InsuranceClaim>(e =>
        {
            e.HasIndex(x => x.ClaimNumber).IsUnique();
            e.Property(x => x.ClaimedAmount).HasPrecision(18, 0);
            e.Property(x => x.ApprovedAmount).HasPrecision(18, 0);
            e.HasOne(x => x.Invoice).WithMany()
                .HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<InventoryItem>(e =>
        {
            e.HasIndex(x => new { x.BranchId, x.Sku }).IsUnique();
            e.Property(x => x.QuantityOnHand).HasPrecision(18, 2);
            e.Property(x => x.ReorderLevel).HasPrecision(18, 2);
        });
        builder.Entity<InventoryTransaction>(e =>
        {
            e.Property(x => x.QuantityDelta).HasPrecision(18, 2);
            e.Property(x => x.BalanceAfter).HasPrecision(18, 2);
            e.HasOne(x => x.InventoryItem).WithMany(x => x.Transactions)
                .HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<CalendarSyncRecord>(e =>
        {
            e.HasIndex(x => new { x.AppointmentId, x.UserId, x.Provider }).IsUnique();
            e.HasOne(x => x.Appointment).WithMany()
                .HasForeignKey(x => x.AppointmentId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<TelemedicineSession>(e =>
        {
            e.HasIndex(x => x.AppointmentId).IsUnique();
            e.HasOne(x => x.Appointment).WithOne(x => x.TelemedicineSession)
                .HasForeignKey<TelemedicineSession>(x => x.AppointmentId).OnDelete(DeleteBehavior.Restrict);
        });
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ChangeTracker.DetectChanges();
        var actor = AuditContext.Current;
        var logs = ChangeTracker.Entries<BaseEntity>()
            .Where(x => x.Entity is not AuditLog and not OutboxMessage && x.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(entry =>
            {
                var oldValues = entry.State == EntityState.Added ? null : entry.Properties
                    .Where(p => p.IsModified || entry.State == EntityState.Deleted)
                    .ToDictionary(p => p.Metadata.Name, p => p.OriginalValue);
                var newValues = entry.State == EntityState.Deleted ? null : entry.Properties
                    .Where(p => entry.State == EntityState.Added || p.IsModified)
                    .ToDictionary(p => p.Metadata.Name, p => p.CurrentValue);
                return new AuditLog
                {
                    ActorUserId = actor?.UserId,
                    ActorName = actor?.Name ?? "system",
                    Action = entry.State.ToString(),
                    EntityType = entry.Metadata.ClrType.Name,
                    EntityId = entry.Entity.Id.ToString(),
                    OldValuesJson = oldValues == null ? null : JsonSerializer.Serialize(oldValues),
                    NewValuesJson = newValues == null ? null : JsonSerializer.Serialize(newValues),
                    IpAddress = actor?.IpAddress,
                    CorrelationId = actor?.CorrelationId ?? Guid.NewGuid().ToString("N")
                };
            }).ToList();
        if (logs.Count > 0) AuditLogs.AddRange(logs);
        return await base.SaveChangesAsync(cancellationToken);
    }
}
