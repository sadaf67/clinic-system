"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { reportApi } from "@/lib/api/axios";
import { useAppStore } from "@/store/useStore";
import { Activity, Calendar, Download, TrendingUp, Users } from "lucide-react";
import toast from "react-hot-toast";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Period = "week" | "month" | "year";
type TrendPoint = { label: string; total: number; completed: number; cancelled: number };
type Report = {
  from: string;
  to: string;
  kpis: {
    newPatients: number;
    newPatientsChange: number;
    totalVisits: number;
    totalVisitsChange: number;
    cancellationRate: number;
    cancellationRateChange: number;
    onlineConsultations: number;
    onlineConsultationsChange: number;
  };
  trend: TrendPoint[];
  visitTypes: { name: "InPerson" | "Online" | "Consultation"; value: number }[];
  topDiagnoses: { name: string; count: number }[];
  ageGroups: { name: string; count: number }[];
};

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6"];

export default function ReportsPage() {
  const { lang } = useAppStore();
  const fa = lang === "fa";
  const [period, setPeriod] = useState<Period>("month");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await reportApi.getSummary(period);
      setReport(data);
    } catch {
      setReport(null);
      toast.error(fa ? "دریافت گزارش ناموفق بود" : "Could not load report");
    } finally {
      setLoading(false);
    }
  }, [period, fa]);

  useEffect(() => { void load(); }, [load]);

  const localizedVisitTypes = useMemo(() => (report?.visitTypes ?? []).map(item => ({
    ...item,
    label: fa
      ? ({ InPerson: "حضوری", Online: "آنلاین", Consultation: "مشاوره" } as const)[item.name]
      : ({ InPerson: "In-person", Online: "Online", Consultation: "Consultation" } as const)[item.name],
  })), [report, fa]);

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ["date", "total", "completed", "cancelled"],
      ...report.trend.map(x => [x.label, x.total, x.completed, x.cancelled]),
    ];
    const csv = "\uFEFF" + rows.map(row => row.join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clinic-report-${period}-${report.to.slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const change = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString(fa ? "fa-IR" : "en-US")}%`;
  const periodLabels: Record<Period, string> = fa
    ? { week: "هفتگی", month: "ماهانه", year: "سالانه" }
    : { week: "Weekly", month: "Monthly", year: "Yearly" };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{fa ? "گزارش‌ها" : "Reports"}</h1>
            <p className="text-sm text-gray-500 mt-1">{fa ? "آمار واقعی ثبت‌شده در سامانه" : "Analytics based on recorded clinic data"}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(["week", "month", "year"] as Period[]).map(item => (
              <button key={item} onClick={() => setPeriod(item)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${period === item ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
                {periodLabels[item]}
              </button>
            ))}
            <button onClick={exportCsv} disabled={!report} className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50">
              <Download className="w-4 h-4" />
              {fa ? "خروجی CSV" : "Export CSV"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card text-center text-gray-500 py-16">{fa ? "در حال محاسبه گزارش..." : "Calculating report..."}</div>
        ) : !report ? (
          <div className="card text-center text-gray-500 py-16">{fa ? "گزارشی در دسترس نیست." : "Report is unavailable."}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Users, label: fa ? "بیماران جدید" : "New patients", value: report.kpis.newPatients, delta: report.kpis.newPatientsChange, inverse: false, color: "text-blue-600 bg-blue-50" },
                { icon: Calendar, label: fa ? "کل نوبت‌ها" : "Appointments", value: report.kpis.totalVisits, delta: report.kpis.totalVisitsChange, inverse: false, color: "text-green-600 bg-green-50" },
                { icon: Activity, label: fa ? "نرخ لغو" : "Cancellation rate", value: `${report.kpis.cancellationRate}%`, delta: report.kpis.cancellationRateChange, inverse: true, color: "text-red-600 bg-red-50" },
                { icon: TrendingUp, label: fa ? "مشاوره آنلاین" : "Online consultations", value: report.kpis.onlineConsultations, delta: report.kpis.onlineConsultationsChange, inverse: false, color: "text-purple-600 bg-purple-50" },
              ].map((item, index) => (
                <div key={index} className="card">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${item.color}`}><item.icon className="w-5 h-5" /></div>
                  <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                  <div className={`text-xs mt-1.5 font-medium ${item.delta === 0 ? "text-gray-500" : (item.delta > 0) !== item.inverse ? "text-green-600" : "text-red-500"}`}>
                    {change(item.delta)} {fa ? "نسبت به دوره قبل" : "vs previous period"}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="card xl:col-span-2">
                <h3 className="font-semibold text-gray-900 mb-4">{fa ? "روند نوبت‌ها" : "Appointment trend"}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={report.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={25} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="#dbeafe" name={fa ? "کل" : "Total"} />
                    <Area type="monotone" dataKey="completed" stroke="#10b981" fill="#d1fae5" name={fa ? "انجام‌شده" : "Completed"} />
                    <Line type="monotone" dataKey="cancelled" stroke="#ef4444" name={fa ? "لغوشده" : "Cancelled"} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">{fa ? "نوع خدمت" : "Service types"}</h3>
                {localizedVisitTypes.every(x => x.value === 0) ? (
                  <div className="h-[250px] grid place-items-center text-sm text-gray-400">{fa ? "داده‌ای ثبت نشده است" : "No data recorded"}</div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={localizedVisitTypes} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={3}>
                        {localizedVisitTypes.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">{fa ? "شایع‌ترین تشخیص‌ها" : "Top diagnoses"}</h3>
                {report.topDiagnoses.length === 0 ? <Empty fa={fa} /> : (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={report.topDiagnoses} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip /><Bar dataKey="count" fill="#6366f1" name={fa ? "تعداد" : "Count"} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">{fa ? "توزیع سنی بیماران" : "Patient age distribution"}</h3>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={report.ageGroups}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} />
                    <Tooltip /><Bar dataKey="count" fill="#f59e0b" name={fa ? "بیمار" : "Patients"} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function Empty({ fa }: { fa: boolean }) {
  return <div className="h-[230px] grid place-items-center text-sm text-gray-400">{fa ? "داده‌ای ثبت نشده است" : "No data recorded"}</div>;
}
