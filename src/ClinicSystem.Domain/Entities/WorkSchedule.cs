// ══════════════════════════════════════════════════════════════
// این فایل برنامه کاری دکتر رو تعریف می‌کنه
// مثلاً: دکتر شنبه تا چهارشنبه از ۸ صبح تا ۱ بعدازظهر کار می‌کنه
// و DayOff روزهایی که دکتر تعطیله رو ثبت می‌کنه
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Common;

namespace ClinicSystem.Domain.Entities;

// ─── برنامه هفتگی کاری دکتر ───────────────────────────────────
public class WorkSchedule : BaseEntity
{
    // این برنامه مال کدوم دکتر هست
    public Guid DoctorId { get; set; }
    public ApplicationUser Doctor { get; set; } = null!;

    // چه روزی از هفته؟ (شنبه=Saturday=6، یکشنبه=Sunday=0 و...)
    // در سی‌شارپ DayOfWeek یه enum آماده هست
    public DayOfWeek DayOfWeek { get; set; }

    // از ساعت چند کار شروع میشه (مثلاً: ۰۸:۰۰)
    public TimeSpan StartTime { get; set; }

    // ساعت پایان کار (مثلاً: ۱۳:۰۰)
    public TimeSpan EndTime { get; set; }

    // هر نوبت چند دقیقه طول می‌کشه؟ (پیش‌فرض: ۳۰ دقیقه)
    public int SlotDurationMinutes { get; set; } = 30;

    // آیا این برنامه فعاله؟ وقتی برنامه رو تغییر میدیم، قدیمی false میشه
    public bool IsActive { get; set; } = true;

    // حداکثر چند بیمار در هر اسلات زمانی؟ (معمولاً ۱)
    public int MaxPatientsPerSlot { get; set; } = 1;
}

// ─── روزهای تعطیل دکتر ────────────────────────────────────────
// وقتی دکتر مرخصی میره یا کنگره داره، اینجا ثبت میشه
// در این روزها هیچ نوبتی داده نمیشه
public class DayOff : BaseEntity
{
    // این تعطیلی مال کدوم دکتر هست
    public Guid DoctorId { get; set; }
    public ApplicationUser Doctor { get; set; } = null!;

    // تاریخ تعطیلی
    public DateTime Date { get; set; }

    // دلیل تعطیلی به فارسی (مثلاً: مرخصی، کنگره پزشکی)
    public string? Reason { get; set; }

    // دلیل تعطیلی به انگلیسی
    public string? ReasonEn { get; set; }
}
