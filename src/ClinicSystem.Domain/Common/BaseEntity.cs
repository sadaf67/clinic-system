// ══════════════════════════════════════════════════════════════
// این کلاس "پایه" همه موجودیت‌های دیتابیس هست
// یعنی همه جدول‌های دیتابیس (بیمار، نوبت، نسخه و...) از این کلاس ارث می‌برن
// پس همه‌شون به طور خودکار ID، تاریخ ساخت و حذف نرم دارن
// ══════════════════════════════════════════════════════════════
namespace ClinicSystem.Domain.Common;

public abstract class BaseEntity
{
    // هر رکورد یه شناسه یکتا (ID) داره که به صورت خودکار ساخته میشه
    // Guid یعنی یه کد ۳۲ رقمی تصادفی که در کل دنیا تکراری نیست!
    public Guid Id { get; protected set; } = Guid.NewGuid();

    // تاریخ و ساعتی که این رکورد ساخته شده - خودکار ست میشه
    public DateTime CreatedAt { get; protected set; } = DateTime.UtcNow;

    // تاریخ آخرین تغییر - اگه null بود یعنی هنوز تغییر نخورده
    public DateTime? UpdatedAt { get; protected set; }

    // این فیلد برای "حذف نرم" (Soft Delete) هست
    // وقتی چیزی رو حذف می‌کنیم، واقعاً از دیتابیس پاک نمی‌کنیم
    // فقط این فیلد رو true می‌کنیم - مثل اینکه بندازیمش تو سطل آشغال
    public bool IsDeleted { get; protected set; } = false;

    // این متد رکورد رو "حذف نرم" می‌کنه (از دیتابیس پاک نمیشه، فقط مخفی میشه)
    public void MarkAsDeleted() => IsDeleted = true;

    // این متد تاریخ آخرین تغییر رو به الان آپدیت می‌کنه
    public void SetUpdated() => UpdatedAt = DateTime.UtcNow;
}
