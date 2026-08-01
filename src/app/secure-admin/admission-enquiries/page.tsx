"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Filter,
  LayoutDashboard,
  Plus,
  Search,
  X,
} from "lucide-react";
import PageTransition from "@/components/admin/PageTransition";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { subscribeToCourses } from "@/lib/courseService";
import type { Course } from "@/types/course";
import {
  EDUCATION_OPTIONS,
  INQUIRY_PRIORITIES,
  INQUIRY_SOURCES,
  INQUIRY_STATUS_STYLES,
  INQUIRY_STATUSES,
  OCCUPATION_OPTIONS,
  type Inquiry,
  type InquiryFormInput,
  type InquiryPriority,
  type InquiryStatus,
} from "@/types/inquiry";
import {
  addFollowUp,
  computeInquiryStats,
  createInquiry,
  filterInquiries,
  formatInquiryDateTime,
  isFollowUpOverdue,
  subscribeToInquiries,
  updateInquiry,
  updateInquiryStatus,
} from "@/lib/inquiryService";
import {
  btnPrimaryBlock,
  btnSecondary,
  inputClass,
  labelClass,
  modalBody,
  modalFooter,
  modalHeader,
  modalOverlay,
  modalPanelSm,
  pageHeader,
  pageHeaderActions,
  pageSubtitle,
  pageTitle,
} from "@/lib/theme";
import InquiryFormModal from "@/components/admin/inquiries/InquiryFormModal";
import FollowUpModal from "@/components/admin/inquiries/FollowUpModal";
import InquiryDetailPanel, {
  PriorityBadge,
} from "@/components/admin/inquiries/InquiryDetailPanel";
import InquiryOverview from "@/components/admin/inquiries/InquiryOverview";

type Tab = "list" | "dashboard" | "reports";

export default function InquiryManagementPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [occupationFilter, setOccupationFilter] = useState("all");
  const [educationFilter, setEducationFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Inquiry | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState("");

  useEffect(() => {
    const unsub = subscribeToInquiries(
      (list) => {
        setInquiries(list);
        setLoading(false);
      },
      () => {
        showToast("error", "Failed to load inquiries.");
        setLoading(false);
      }
    );
    const unsubCourses = subscribeToCourses(setCourses);
    return () => {
      unsub();
      unsubCourses();
    };
  }, [showToast]);

  const selected = useMemo(
    () => inquiries.find((i) => i.id === selectedId) || null,
    [inquiries, selectedId]
  );

  const filtered = useMemo(
    () =>
      filterInquiries(inquiries, {
        search,
        status: statusFilter,
        priority: priorityFilter,
        source: sourceFilter,
        course: courseFilter,
        occupation: occupationFilter,
        educationStatus: educationFilter,
        dateFrom,
        dateTo,
      }),
    [
      inquiries,
      search,
      statusFilter,
      priorityFilter,
      sourceFilter,
      courseFilter,
      occupationFilter,
      educationFilter,
      dateFrom,
      dateTo,
    ]
  );

  const stats = useMemo(() => computeInquiryStats(inquiries), [inquiries]);
  const { page, setPage, totalPages, paginated, pageSize } = usePagination(filtered, 10);

  const actor = {
    uid: user?.uid || "unknown",
    name: user?.fullName || user?.email || "Staff",
  };

  const handleCreate = async (data: InquiryFormInput) => {
    const result = await createInquiry(data, actor);
    showToast("success", `Inquiry ${result.inquiryId} created.`);
    setSelectedId(result.id);
    setTab("list");
  };

  const handleUpdate = async (data: InquiryFormInput) => {
    if (!editing) return;
    await updateInquiry(editing.id, data);
    showToast("success", "Inquiry updated.");
  };

  const handleFollowUp = async (data: {
    note: string;
    nextFollowUpDate?: string;
    nextAction?: string;
    contactDate?: string;
    status?: InquiryStatus;
  }) => {
    if (!selected) return;
    await addFollowUp(selected.id, data, actor);
    showToast("success", "Follow-up saved.");
  };

  const handleStatus = async (status: InquiryStatus) => {
    if (!selected) return;
    await updateInquiryStatus(selected.id, status);
    showToast("success", `Status set to ${status}.`);
  };

  const handlePriority = async (priority: InquiryPriority) => {
    if (!selected) return;
    await updateInquiry(selected.id, { priority });
    showToast("success", `Priority set to ${priority}.`);
  };

  const handleConvert = () => {
    if (!selected) return;
    router.push(`/secure-admin/admissions?fromInquiry=${selected.id}`);
  };

  const handleSetReminder = async () => {
    if (!selected || !reminderDate) return;
    await updateInquiry(selected.id, { nextFollowUpDate: reminderDate });
    showToast("success", "Reminder / next follow-up date set.");
    setShowReminder(false);
    setReminderDate("");
  };

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of courses) {
      map.set(c.courseId || c.id, c.title);
    }
    for (const i of inquiries) {
      if (i.courseId && i.courseTitle) map.set(i.courseId, i.courseTitle);
    }
    return [...map.entries()];
  }, [courses, inquiries]);

  return (
    <PageTransition>
      <div className={pageHeader}>
        <div>
          <h1 className={pageTitle}>Inquiry Management</h1>
          <p className={pageSubtitle}>
            Track institute inquiries, follow-ups, reminders, and convert to admission in one click.
          </p>
        </div>
        <div className={pageHeaderActions}>
          <button
            type="button"
            className={btnPrimaryBlock}
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <Plus size={18} /> New Inquiry
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {(
          [
            { id: "list", label: "Inquiries", icon: Search },
            { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
            { id: "reports", label: "Reports", icon: BarChart3 },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
              tab === t.id
                ? "bg-[#6C3CE9] text-white border-[#6C3CE9]"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "dashboard" || tab === "reports") && (
        <InquiryOverview
          stats={stats}
          inquiries={inquiries}
          onSelectInquiry={(id) => {
            setSelectedId(id);
            setTab("list");
          }}
        />
      )}

      {tab === "list" && (
        <>
          <div className="glass-card rounded-2xl p-4 mb-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  className={inputClass + " pl-10"}
                  placeholder="Search by Inquiry ID, name, or mobile..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter size={16} /> Filters
              </button>
            </div>

            {showFilters ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <select
                  className={inputClass}
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All statuses</option>
                  {INQUIRY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All priorities</option>
                  {INQUIRY_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All sources</option>
                  {INQUIRY_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={courseFilter}
                  onChange={(e) => {
                    setCourseFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All courses</option>
                  {courseOptions.map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={occupationFilter}
                  onChange={(e) => {
                    setOccupationFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All occupations</option>
                  {OCCUPATION_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={educationFilter}
                  onChange={(e) => {
                    setEducationFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All education</option>
                  {EDUCATION_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <div>
                  <label className="text-xs text-slate-400">From</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">To</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden">
              <div className="admin-table-scroll">
                <table className="w-full text-left min-w-[720px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Inquiry</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Course</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Follow-up</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                          Loading...
                        </td>
                      </tr>
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                          No inquiries found. Create one to get started.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((inq) => {
                        const overdue = isFollowUpOverdue(inq);
                        return (
                          <tr
                            key={inq.id}
                            onClick={() => setSelectedId(inq.id)}
                            className={`border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer ${
                              selectedId === inq.id ? "bg-violet-50/50" : ""
                            } ${overdue ? "bg-red-50/40" : ""}`}
                          >
                            <td className="px-4 py-3">
                              <p className="text-xs font-mono text-[#6C3CE9]">{inq.inquiryId}</p>
                              <p className="font-medium text-slate-900">{inq.fullName}</p>
                              <p className="text-xs text-slate-400">{inq.phone}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {inq.courseTitle || "—"}
                              <p className="text-xs text-slate-400">{formatInquiryDateTime(inq)}</p>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={overdue ? "text-red-600 font-medium" : "text-slate-600"}>
                                {inq.nextFollowUpDate || "—"}
                              </span>
                              {inq.nextAction ? (
                                <p className="text-xs text-slate-400">{inq.nextAction}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded-full ${INQUIRY_STATUS_STYLES[inq.status]}`}
                              >
                                {inq.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <PriorityBadge priority={inq.priority} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100">
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    pageSize={pageSize}
                    totalItems={filtered.length}
                  />
                </div>
              )}
            </div>

            <InquiryDetailPanel
              inquiry={selected}
              onEdit={() => {
                if (!selected) return;
                setEditing(selected);
                setShowForm(true);
              }}
              onFollowUp={() => setShowFollowUp(true)}
              onStatusChange={handleStatus}
              onPriorityChange={handlePriority}
              onConvert={handleConvert}
              onSetReminder={() => {
                setReminderDate(selected?.nextFollowUpDate || "");
                setShowReminder(true);
              }}
            />
          </div>
        </>
      )}

      {tab === "reports" && (
        <div className="glass-card rounded-2xl p-5 mt-2">
          <h3 className="font-semibold text-slate-900 mb-2">Available Reports</h3>
          <p className="text-sm text-slate-500 mb-4">
            Charts above cover daily/monthly trends, course-wise, source-wise, status-wise, conversion, and cancelled inquiries.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {[
              { label: "Daily Inquiry Report", value: stats.today },
              { label: "Monthly Inquiry Report", value: stats.thisMonth },
              { label: "Admission Conversion", value: stats.admissionConfirmed },
              { label: "Cancelled Inquiries", value: stats.cancelled },
              { label: "Interested Students", value: stats.interested },
              { label: "Overdue Follow-ups", value: stats.overdueFollowUps },
            ].map((r) => (
              <div key={r.label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-slate-500 text-xs">{r.label}</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{r.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <InquiryFormModal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditing(null);
        }}
        onSubmit={editing ? handleUpdate : handleCreate}
        courses={courses}
        initial={editing}
      />

      <FollowUpModal
        open={showFollowUp}
        inquiry={selected}
        onClose={() => setShowFollowUp(false)}
        onSubmit={handleFollowUp}
      />

      {showReminder && selected ? (
        <div className={modalOverlay}>
          <div className={modalPanelSm}>
            <div className={modalHeader}>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Set Reminder</h2>
                <p className="text-xs text-slate-500">{selected.inquiryId}</p>
              </div>
              <button type="button" onClick={() => setShowReminder(false)}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className={modalBody}>
              <label className={labelClass}>Next Follow-up Date</label>
              <input
                type="date"
                className={inputClass}
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
              />
            </div>
            <div className={modalFooter}>
              <button type="button" className={btnSecondary} onClick={() => setShowReminder(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimaryBlock}
                disabled={!reminderDate}
                onClick={() => void handleSetReminder()}
              >
                Save Reminder
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageTransition>
  );
}
