// ══════════════════════════════════════════════════════════════
// این کلاس تاریخچه علائم حیاتی بیمار رو در طول زمان ذخیره می‌کنه
// مثلاً وزن بیمار در هر ویزیت ذخیره میشه
// بعداً می‌تونیم یه نمودار از تغییرات وزن بیمار رسم کنیم
// ══════════════════════════════════════════════════════════════
using ClinicSystem.Domain.Common;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Domain.Entities;

public class VitalSign : BaseEntity
{
    // این اندازه‌گیری مال کدوم بیمار هست
    public Guid PatientId { get; set; }
    public Patient Patient { get; set; } = null!;

    // چه چیزی اندازه گرفته شده؟ وزن؟ فشار؟ قند؟
    // از enum VitalTrendType استفاده می‌کنه
    public VitalTrendType Type { get; set; }

    // مقدار اندازه‌گیری شده (مثلاً: 75.5 برای وزن)
    public decimal Value { get; set; }

    // واحد اندازه‌گیری (مثلاً: kg، mmHg، mg/dl)
    public string? Unit { get; set; }

    // تاریخ و ساعت اندازه‌گیری
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;

    // یادداشت اضافه (مثلاً: "بعد از ناهار اندازه گرفته شد")
    public string? Notes { get; set; }

    // شناسه کسی که اندازه گرفته (دکتر یا پرستار)
    public Guid? RecordedByUserId { get; set; }
}
