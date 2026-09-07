// ══════════════════════════════════════════════════════════════
// AppointmentService — سرویس منطق تجاری نوبت‌ها
//
// این کلاس "مغز" بخش نوبت‌هاست. وقتی بیمار می‌خواد نوبت بگیره،
// این کلاس چک می‌کنه:
// ۱. آیا دکتر توی اون روز کار می‌کنه؟
// ۲. آیا دکتر توی اون روز مرخصیه؟
// ۳. آیا اون ساعت خالیه و قبلاً رزرو نشده؟
//
// بعد از ایجاد نوبت، یه پیامک تأیید هم میفرسته.
//
// این کلاس توی لایه Application هست — یعنی به دیتابیس مستقیم
// دسترسی نداره و از طریق ریپازیتوری‌ها کار می‌کنه.
// ══════════════════════════════════════════════════════════════

using ClinicSystem.Application.DTOs.Appointment;
using ClinicSystem.Application.Interfaces.Repositories;
using ClinicSystem.Application.Interfaces.Services;
using ClinicSystem.Domain.Entities;
using ClinicSystem.Domain.Enums;

namespace ClinicSystem.Application.Services;

public class AppointmentService : IAppointmentService
{
    private readonly IAppointmentRepository _appointmentRepo; // نوبت‌ها
    private readonly IGenericRepository<WorkSchedule> _scheduleRepo; // برنامه هفتگی دکتر
    private readonly IGenericRepository<DayOff> _dayOffRepo;         // روزهای تعطیل
    private readonly INotificationService _notificationService;       // ارسال پیامک/نوتیفیکیشن
    private readonly ITelemedicineService _telemedicineService;

    public AppointmentService(
        IAppointmentRepository appointmentRepo,
        IGenericRepository<WorkSchedule> scheduleRepo,
        IGenericRepository<DayOff> dayOffRepo,
        INotificationService notificationService,
        ITelemedicineService telemedicineService)
    {
        _appointmentRepo = appointmentRepo;
        _scheduleRepo = scheduleRepo;
        _dayOffRepo = dayOffRepo;
        _notificationService = notificationService;
        _telemedicineService = telemedicineService;
    }

    // ──────────────────────────────────────────────────────────────
    // GetByIdAsync: گرفتن یه نوبت مشخص
    // خطا میده اگه نوبت پیدا نشه (برخلاف null که سکوت می‌کنه)
    // ──────────────────────────────────────────────────────────────
    public async Task<AppointmentDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var appt = await _appointmentRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Appointment {id} not found.");
        return MapToDto(appt);
    }

    // ──────────────────────────────────────────────────────────────
    // GetPagedAsync: گرفتن لیست نوبت‌ها با فیلتر و صفحه‌بندی
    // ──────────────────────────────────────────────────────────────
    public async Task<PagedResult<AppointmentDto>> GetPagedAsync(
        AppointmentFilterDto filter, CancellationToken ct = default)
    {
        var (items, total) = await _appointmentRepo.GetPagedAsync(
            filter.DoctorId, filter.PatientId, filter.Status,
            filter.From, filter.To, filter.Page, filter.PageSize, ct);

        return new PagedResult<AppointmentDto>
        {
            Items    = items.Select(MapToDto),
            Total    = total,
            Page     = filter.Page,
            PageSize = filter.PageSize
        };
    }

    // ──────────────────────────────────────────────────────────────
    // CreateAsync: ایجاد نوبت جدید
    //
    // ۳ چک مهم انجام میده:
    // ۱. دکتر توی اون روز کار می‌کنه؟ (چک برنامه هفتگی)
    // ۲. تعطیل نیست؟ (چک DayOff)
    // ۳. اون اسلات خالیه؟ (چک نوبت‌های موجود)
    //
    // اگه همه چیز OK بود: نوبت ثبت میشه + پیامک تأیید میره
    // ──────────────────────────────────────────────────────────────
    public async Task<AppointmentDto> CreateAsync(CreateAppointmentDto dto, CancellationToken ct = default)
    {
        var endTime = await ValidateSlotAsync(
            dto.DoctorId, dto.AppointmentDate, dto.StartTime, null, ct);

        // ── ایجاد نوبت ────────────────────────────────────────────
        var appointment = new Appointment
        {
            PatientId       = dto.PatientId,
            DoctorId        = dto.DoctorId,
            BranchId        = dto.BranchId,
            AppointmentDate = dto.AppointmentDate,
            StartTime       = dto.StartTime,
            EndTime         = endTime,
            Type            = dto.Type,
            Status          = AppointmentStatus.Confirmed, // مستقیم Confirmed میشه
            ChiefComplaint  = dto.ChiefComplaint,
            Notes           = dto.Notes
        };

        // اگه آنلاین هست، لینک ویدیوکنفرانس تولید کن
        if (dto.Type == AppointmentType.Online)
        {
            var room = _telemedicineService.CreateRoom(appointment.Id);
            appointment.MeetingId = room?.RoomId;
            appointment.MeetingLink = room?.JoinUrl;
        }

        await _appointmentRepo.AddAsync(appointment, ct);
        await _appointmentRepo.SaveChangesAsync(ct);

        // ارسال پیامک/نوتیفیکیشن تأیید به بیمار
        var savedAppointment = await _appointmentRepo.GetWithDetailsAsync(appointment.Id, ct) ?? appointment;
        await _notificationService.SendAppointmentConfirmationAsync(savedAppointment, ct);

        return MapToDto(savedAppointment);
    }

    // ──────────────────────────────────────────────────────────────
    // UpdateAsync: ویرایش اطلاعات نوبت
    // فقط فیلدهایی که داده شدن آپدیت میشن (null = بدون تغییر)
    // ──────────────────────────────────────────────────────────────
    public async Task<AppointmentDto> UpdateAsync(
        Guid id, UpdateAppointmentDto dto, CancellationToken ct = default)
    {
        var appt = await _appointmentRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Appointment {id} not found.");

        var appointmentDate = dto.AppointmentDate ?? appt.AppointmentDate;
        var startTime = dto.StartTime ?? appt.StartTime;
        if (dto.AppointmentDate.HasValue || dto.StartTime.HasValue)
        {
            appt.EndTime = await ValidateSlotAsync(
                appt.DoctorId, appointmentDate, startTime, appt.Id, ct);
        }

        if (dto.AppointmentDate.HasValue) appt.AppointmentDate = dto.AppointmentDate.Value;
        if (dto.StartTime.HasValue)       appt.StartTime       = dto.StartTime.Value;
        if (dto.Type.HasValue)            appt.Type            = dto.Type.Value;
        if (dto.ChiefComplaint != null)   appt.ChiefComplaint  = dto.ChiefComplaint;
        if (dto.Notes != null)            appt.Notes           = dto.Notes;
        if (dto.MeetingLink != null)      appt.MeetingLink     = dto.MeetingLink;
        if (dto.BranchId.HasValue)        appt.BranchId        = dto.BranchId;
        if (dto.Type == AppointmentType.Online && string.IsNullOrWhiteSpace(appt.MeetingLink))
        {
            var room = _telemedicineService.CreateRoom(appt.Id);
            appt.MeetingId = room?.RoomId;
            appt.MeetingLink = room?.JoinUrl;
        }
        else if (dto.Type == AppointmentType.InPerson)
            appt.MeetingLink = null;

        appt.SetUpdated(); // زمان آخرین ویرایش رو بروز کن

        _appointmentRepo.Update(appt);
        await _appointmentRepo.SaveChangesAsync(ct);
        return MapToDto(appt);
    }

    // ──────────────────────────────────────────────────────────────
    // UpdateStatusAsync: تغییر وضعیت نوبت
    //
    // اگه وضعیت به "لغو" تغییر کرد، به بیمار اطلاع میده.
    // ──────────────────────────────────────────────────────────────
    public async Task<AppointmentDto> UpdateStatusAsync(
        Guid id, UpdateAppointmentStatusDto dto, CancellationToken ct = default)
    {
        var appt = await _appointmentRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Appointment {id} not found.");

        var oldStatus = appt.Status; // وضعیت قبلی رو نگه‌دار
        appt.Status = dto.Status;
        if (dto.Notes != null) appt.Notes = dto.Notes;
        appt.SetUpdated();

        _appointmentRepo.Update(appt);
        await _appointmentRepo.SaveChangesAsync(ct);

        // فقط اگه الان لغو شد (نه قبلاً) پیامک لغو بفرست
        if (dto.Status == AppointmentStatus.Cancelled &&
            oldStatus != AppointmentStatus.Cancelled)
        {
            var appointmentWithDetails = await _appointmentRepo.GetWithDetailsAsync(appt.Id, ct) ?? appt;
            await _notificationService.SendAppointmentCancellationAsync(appointmentWithDetails, ct);
        }

        return MapToDto(appt);
    }

    // ──────────────────────────────────────────────────────────────
    // DeleteAsync: حذف نوبت (Soft Delete)
    // MarkAsDeleted = فقط IsDeleted = true میزنه، پاک نمیکنه
    // ──────────────────────────────────────────────────────────────
    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var appt = await _appointmentRepo.GetByIdAsync(id, ct)
            ?? throw new KeyNotFoundException($"Appointment {id} not found.");

        appt.MarkAsDeleted(); // Soft Delete — رکورد میمونه ولی IsDeleted = true
        _appointmentRepo.Update(appt);
        await _appointmentRepo.SaveChangesAsync(ct);
    }

    // ──────────────────────────────────────────────────────────────
    // GetAvailableSlotsAsync: گرفتن ساعت‌های خالی دکتر
    //
    // این متد برای نمایش تقویم رزرو نوبت استفاده میشه.
    // الگوریتم:
    // ۱. برنامه هفتگی دکتر برای این روز رو بگیر
    // ۲. چک کن تعطیل نباشه
    // ۳. همه نوبت‌های موجود (غیر لغو) رو بگیر
    // ۴. ساعت به ساعت بررسی کن: آزاده یا نه؟
    // ──────────────────────────────────────────────────────────────
    public async Task<IEnumerable<AvailableSlotDto>> GetAvailableSlotsAsync(
        Guid doctorId, DateTime date, CancellationToken ct = default)
    {
        // برنامه دکتر برای این روز هفته
        var schedules = await _scheduleRepo.FindAsync(
            s => s.DoctorId == doctorId && s.DayOfWeek == date.DayOfWeek && s.IsActive, ct);
        var schedule = schedules.FirstOrDefault();

        // اگه دکتر این روز کار نمی‌کنه، لیست خالی برگردون
        if (schedule == null) return Enumerable.Empty<AvailableSlotDto>();

        // اگه تعطیله، لیست خالی برگردون
        var isDayOff = await _dayOffRepo.AnyAsync(
            d => d.DoctorId == doctorId && d.Date.Date == date.Date, ct);
        if (isDayOff) return Enumerable.Empty<AvailableSlotDto>();

        // نوبت‌های رزرو‌شده این روز (لغوشده‌ها حساب نمیشن)
        var existing = await _appointmentRepo.GetByDoctorIdAsync(doctorId, date, ct);
        var bookedSlots = existing
            .Where(a => a.Status != AppointmentStatus.Cancelled)
            .Select(a => a.StartTime)
            .ToHashSet(); // HashSet برای جستجوی سریع (O(1))

        // تولید لیست اسلات‌ها از ابتدا تا انتهای ساعت کاری
        var slots = new List<AvailableSlotDto>();
        var current  = schedule.StartTime;  // شروع از ساعت شروع کاری
        var duration = TimeSpan.FromMinutes(schedule.SlotDurationMinutes);

        while (current + duration <= schedule.EndTime) // تا قبل از پایان کاری
        {
            slots.Add(new AvailableSlotDto
            {
                StartTime   = current,
                EndTime     = current + duration,
                // اگه توی رزرو‌شده‌ها نیست → آزاده
                IsAvailable = !bookedSlots.Contains(current)
            });
            current += duration; // برو اسلات بعدی
        }

        return slots;
    }

    private async Task<TimeSpan> ValidateSlotAsync(
        Guid doctorId,
        DateTime appointmentDate,
        TimeSpan startTime,
        Guid? excludeAppointmentId,
        CancellationToken ct)
    {
        if (appointmentDate.Date < DateTime.UtcNow.Date)
            throw new InvalidOperationException("Appointments cannot be booked in the past.");

        var schedules = await _scheduleRepo.FindAsync(
            s => s.DoctorId == doctorId &&
                 s.DayOfWeek == appointmentDate.DayOfWeek &&
                 s.IsActive, ct);
        var schedule = schedules.FirstOrDefault()
            ?? throw new InvalidOperationException("Doctor is not available on this day.");

        if (schedule.SlotDurationMinutes <= 0)
            throw new InvalidOperationException("The doctor's slot duration is invalid.");

        var duration = TimeSpan.FromMinutes(schedule.SlotDurationMinutes);
        var endTime = startTime + duration;
        if (startTime < schedule.StartTime || endTime > schedule.EndTime)
            throw new InvalidOperationException("The selected time is outside the doctor's working hours.");

        if ((startTime - schedule.StartTime).Ticks % duration.Ticks != 0)
            throw new InvalidOperationException("The selected time is not a valid appointment slot.");

        var isDayOff = await _dayOffRepo.AnyAsync(
            d => d.DoctorId == doctorId && d.Date.Date == appointmentDate.Date, ct);
        if (isDayOff)
            throw new InvalidOperationException("Doctor has a day off on this date.");

        var isAvailable = await _appointmentRepo.IsSlotAvailableAsync(
            doctorId, appointmentDate, startTime, endTime, excludeAppointmentId, ct);
        if (!isAvailable)
            throw new InvalidOperationException("This time slot is already booked.");

        return endTime;
    }

    // ──────────────────────────────────────────────────────────────
    // GetTodayAppointmentsAsync: نوبت‌های امروز دکتر
    // مرتب شده بر اساس ساعت
    // ──────────────────────────────────────────────────────────────
    public async Task<IEnumerable<AppointmentDto>> GetTodayAppointmentsAsync(
        Guid doctorId, CancellationToken ct = default)
    {
        var appts = await _appointmentRepo.GetByDoctorIdAsync(doctorId, DateTime.Today, ct);
        return appts.OrderBy(a => a.StartTime).Select(MapToDto);
    }

    // ──────────────────────────────────────────────────────────────
    // GenerateMeetingLink: تولید لینک ویدیوکنفرانس
    //
    // یه کد ۸ کاراکتری تصادفی میسازه و به آدرس meet.clinic.app
    // اضافه می‌کنه.
    // مثال: https://meet.clinic.app/room/A3F2B7C9
    // ──────────────────────────────────────────────────────────────
    // ──────────────────────────────────────────────────────────────
    // MapToDto: تبدیل Entity به DTO
    //
    // کنترلر با DTO کار می‌کنه، نه Entity — پس باید تبدیل کنیم.
    // ?? string.Empty = اگه null بود، رشته خالی برگردون
    // ──────────────────────────────────────────────────────────────
    private static AppointmentDto MapToDto(Appointment a) => new()
    {
        Id              = a.Id,
        PatientId       = a.PatientId,
        PatientName     = a.Patient?.User?.FullName    ?? string.Empty,  // نام بیمار
        PatientPhone    = a.Patient?.User?.PhoneNumber ?? string.Empty,  // شماره موبایل
        DoctorId        = a.DoctorId,
        BranchId        = a.BranchId,
        DoctorName      = a.Doctor?.FullName           ?? string.Empty,  // نام دکتر
        AppointmentDate = a.AppointmentDate,
        StartTime       = a.StartTime,
        EndTime         = a.EndTime,
        Status          = a.Status,    // Pending، Confirmed، Completed و...
        Type            = a.Type,      // InPerson یا Online
        ChiefComplaint  = a.ChiefComplaint,
        Notes           = a.Notes,
        MeetingLink     = a.MeetingLink, // لینک ویدیوکنفرانس (برای آنلاین)
        CreatedAt       = a.CreatedAt
    };
}
