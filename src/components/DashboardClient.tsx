"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { format, getDaysInMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Download, FileText, ChevronLeft, ChevronRight, Edit2, Trash2, Milk, Filter, CalendarRange, CalendarDays, LogOut } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useRouter } from "next/navigation";
import EntryFormModal from "./EntryFormModal";
import CalendarPickerModal from "./CalendarPickerModal";
import { deleteEntry, logout } from "@/app/actions";
import LoginFormModal from "./LoginFormModal";

type ExtraItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
};

type DailyEntry = {
  id: string;
  date: Date;
  milkQuantity: number;
  milkPricePerLitre: number;
  extraItems: ExtraItem[];
};

export default function DashboardClient({
  initialEntries,
  month,
  year,
  isAdmin,
}: {
  initialEntries: DailyEntry[];
  month: number;
  year: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCalendarPickerOpen, setIsCalendarPickerOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"single" | "range">("single");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DailyEntry | null>(null);
  const [filter, setFilter] = useState("All");
  const [globalLoading, setGlobalLoading] = useState({ isLoading: false, message: "" });
  const [isPending, startTransition] = useTransition();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (filter === "All") return initialEntries;
    if (filter === "Milk") return initialEntries.filter(e => e.milkQuantity > 0);

    return initialEntries.filter(e =>
      e.extraItems.some(item => item.name.toLowerCase().includes(filter.toLowerCase()))
    );
  }, [initialEntries, filter]);

  // Stats calculation
  const stats = useMemo(() => {
    let totalMilkQuantity = 0;
    let totalMilkCost = 0;
    let totalExtrasCost = 0;

    initialEntries.forEach((entry) => {
      totalMilkQuantity += entry.milkQuantity;
      totalMilkCost += entry.milkQuantity * entry.milkPricePerLitre;
      entry.extraItems.forEach((item) => {
        totalExtrasCost += item.price;
      });
    });

    return {
      totalMilkQuantity,
      totalMilkCost,
      totalExtrasCost,
      grandTotal: totalMilkCost + totalExtrasCost,
      daysTracked: initialEntries.length,
      daysInMonth: getDaysInMonth(new Date(year, month)),
    };
  }, [initialEntries, month, year]);

  const handlePrevMonth = () => {
    const newDate = new Date(year, month - 1);
    router.push(`/?month=${newDate.getMonth()}&year=${newDate.getFullYear()}`);
  };

  const handleNextMonth = () => {
    const newDate = new Date(year, month + 1);
    router.push(`/?month=${newDate.getMonth()}&year=${newDate.getFullYear()}`);
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Milk Tracker");

    worksheet.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "Date", key: "date", width: 18 },
      { header: "Milk Qty (L)", key: "milk", width: 15 },
      { header: "Milk Rate", key: "rate", width: 15 },
      { header: "Milk Total", key: "milkTotal", width: 15 },
      { header: "Extra Items", key: "extras", width: 45 },
      { header: "Extras Total", key: "extrasTotal", width: 15 },
      { header: "Grand Total", key: "grandTotal", width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF3B82F6" },
      };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    filteredEntries.forEach((e, index) => {
      const extraItemsStr = e.extraItems.map(item => `${item.name}(${item.quantity}gm : ₹${item.price})`).join(", ");
      const milkTotal = e.milkQuantity * e.milkPricePerLitre;
      const extrasTotal = e.extraItems.reduce((sum, item) => sum + item.price, 0);

      const hasExtras = e.extraItems && e.extraItems.length > 0;

      const row = worksheet.addRow({
        sno: index + 1,
        date: format(new Date(e.date), 'dd MMM yyyy'),
        milk: e.milkQuantity,
        rate: `₹${e.milkPricePerLitre}`,
        milkTotal: `₹${milkTotal}`,
        extras: extraItemsStr || "-",
        extrasTotal: `₹${extrasTotal}`,
        grandTotal: `₹${milkTotal + extrasTotal}`
      });

      if (hasExtras) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" }, // Soft warm amber highlight for rows with extra items
          };
          cell.font = { color: { argb: "FF78350F" }, bold: cell.col === "8" };
        });
      } else if (row.number % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        });
      }
    });

    const totalRow = worksheet.addRow({
      sno: "",
      date: `TOTAL (${filter})`,
      milk: stats.totalMilkQuantity,
      rate: "",
      milkTotal: `₹${stats.totalMilkCost}`,
      extras: "",
      extrasTotal: `₹${stats.totalExtrasCost}`,
      grandTotal: `₹${stats.grandTotal}`
    });

    totalRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" },
      };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Milk_Tracker_${format(new Date(year, month), 'MMM_yyyy')}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Document Title & Metadata
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text("Milk Tracker - Monthly Report", 14, 14);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Period: ${format(new Date(year, month), "MMMM yyyy")}  |  Filter: ${filter}  |  Grand Total: Rs. ${stats.grandTotal}`,
      14,
      20
    );

    const tableData = filteredEntries.map((e, index) => {
      const milkTotal = e.milkQuantity * e.milkPricePerLitre;
      const extrasTotal = e.extraItems.reduce((sum, item) => sum + item.price, 0);

      // Detailed other items list with quantity and price
      const extraItemsDetailed = e.extraItems && e.extraItems.length > 0
        ? e.extraItems
          .map((item) => `${item.name} (${item.quantity}gm - Rs. ${item.price})`)
          .join("\n")
        : "-";

      return [
        (index + 1).toString(),
        format(new Date(e.date), "dd MMM yyyy"),
        `${e.milkQuantity} L`,
        `Rs. ${milkTotal}`,
        extraItemsDetailed,
        `Rs. ${extrasTotal}`,
        `Rs. ${milkTotal + extrasTotal}`,
      ];
    });

    const footData = [
      [
        "",
        `TOTAL (${filteredEntries.length} entries)`,
        `${stats.totalMilkQuantity} L`,
        `Rs. ${stats.totalMilkCost}`,
        "",
        `Rs. ${stats.totalExtrasCost}`,
        `Rs. ${stats.grandTotal}`,
      ],
    ];

    autoTable(doc, {
      head: [["#", "Date", "Milk (L)", "Milk Total", "Other Items (Item, Qty & Price)", "Extras Total", "Grand Total"]],
      body: tableData,
      foot: footData,
      startY: 25,
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [37, 99, 235], // Blue-600
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      footStyles: {
        fillColor: [15, 23, 42], // Slate-900
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "center", cellWidth: 24 },
        2: { halign: "center", cellWidth: 16 },
        3: { halign: "right", cellWidth: 22 },
        4: { halign: "left", cellWidth: 70 }, // Extra items & prices column
        5: { halign: "right", cellWidth: 22 },
        6: { halign: "right", cellWidth: 26, fontStyle: "bold" },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didParseCell: (data) => {
        if (data.section === "body") {
          const entry = filteredEntries[data.row.index];
          if (entry && entry.extraItems && entry.extraItems.length > 0) {
            // Warm amber highlight for rows where other items were bought
            data.cell.styles.fillColor = [254, 243, 199]; // Amber-100
            data.cell.styles.textColor = [120, 53, 15];   // Amber-900
          }
        }
      },
      margin: { top: 25, left: 10, right: 10 },
    });

    doc.save(`Milk_Tracker_${format(new Date(year, month), "MMM_yyyy")}.pdf`);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      setGlobalLoading({ isLoading: true, message: "Deleting entry, please wait..." });
      try {
        await deleteEntry(id);
      } finally {
        setGlobalLoading({ isLoading: false, message: "" });
      }
    }
  };

  const filterOptions = ["All", "Milk", "Paneer", "Dahi", "Masala", "Matar", "Bread", "Buns"];

  return (
    <div className="space-y-6">
      {/* Sticky Header with Centered Month Navigator & Actions in New Line */}
      <header
        className={`sticky top-2 md:top-4 z-50 rounded-2xl p-3 md:p-4 space-y-3 transition-all duration-300 ${isScrolled
          ? "bg-slate-950/95 border border-slate-700/60 backdrop-blur-2xl shadow-2xl shadow-black/60 ring-1 ring-white/5"
          : "bg-slate-900/85 border border-slate-800/60 backdrop-blur-xl shadow-lg shadow-black/20"
          }`}
      >
        {/* Top Row: Centered Month Navigator */}
        <div className="flex items-center justify-between gap-3">

          {/* Left: Branding */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 flex-shrink-0">
              <Milk className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold tracking-tight text-slate-100">MilkTracker</h2>
              <p className="text-[10px] text-slate-400">Daily Diary & Expense</p>
            </div>
          </div>

          {/* Center: Month & Year Navigator (Prominently Centered at Top) */}
          <div className="flex items-center justify-center gap-2 md:gap-3">
            <button
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 hover:border-indigo-500 transition-all shadow-sm hover:shadow-indigo-500/20"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            <div className="text-center px-2">
              <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent whitespace-nowrap">
                {format(new Date(year, month), 'MMMM yyyy')}
              </h1>
            </div>

            <button
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 hover:border-indigo-500 transition-all shadow-sm hover:shadow-indigo-500/20"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>

          {/* Right: Export Tools & Login (if guest) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleExportExcel}
              title="Export to Excel"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl transition-all border border-slate-700/50 text-xs font-medium"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              title="Export to PDF"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl transition-all border border-slate-700/50 text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            {!isAdmin && (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs font-medium"
              >
                Admin Login
              </button>
            )}
          </div>

        </div>

        {/* Second Row: Action Buttons & Red Logout Button (in new line in header) */}
        {isAdmin && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setEditingEntry(null); setModalMode("single"); setIsModalOpen(true); }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Add Entry</span>
              </button>
              <button
                onClick={() => { setEditingEntry(null); setModalMode("range"); setIsModalOpen(true); }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-md shadow-indigo-500/20 text-xs font-medium"
              >
                <CalendarRange className="w-4 h-4" />
                <span>Date Range</span>
              </button>
              <button
                onClick={() => setIsCalendarPickerOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all shadow-md shadow-purple-500/20 text-xs font-medium"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Pick Dates</span>
              </button>
            </div>

            {/* Red Solid Filled Logout Button with Logout Icon */}
            <button
              onClick={async () => {
                if (confirm("Are you sure you want to log out?")) {
                  setGlobalLoading({ isLoading: true, message: "Logging out, please wait..." });
                  await logout();
                  startTransition(() => {
                    router.refresh();
                  });
                  setGlobalLoading({ isLoading: false, message: "" });
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all shadow-md shadow-red-500/20 text-xs font-medium ml-auto"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </header>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Milk className="w-16 h-16" />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Total Milk</p>
          <h3 className="text-3xl font-bold text-slate-100">{stats.totalMilkQuantity} L</h3>
          <p className="text-blue-400 text-xs mt-2">{stats.daysTracked} / {stats.daysInMonth} days tracked</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
          <p className="text-slate-400 text-sm font-medium mb-1">Milk Cost</p>
          <h3 className="text-3xl font-bold text-slate-100">₹{stats.totalMilkCost}</h3>
          <p className="text-slate-500 text-xs mt-2">@ ₹60/L average</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800">
          <p className="text-slate-400 text-sm font-medium mb-1">Extra Items Cost</p>
          <h3 className="text-3xl font-bold text-slate-100">₹{stats.totalExtrasCost}</h3>
          <p className="text-slate-500 text-xs mt-2">Paneer, dahi, etc.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-gradient-to-br from-blue-900/50 to-indigo-900/50 p-6 rounded-2xl border border-blue-500/20">
          <p className="text-blue-200/80 text-sm font-medium mb-1">Grand Total</p>
          <h3 className="text-3xl font-bold text-white">₹{stats.grandTotal}</h3>
          <p className="text-blue-300/60 text-xs mt-2">For {format(new Date(year, month), 'MMMM yyyy')}</p>
        </motion.div>
      </div>

      {/* History Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">

          {/* Header */}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              Daily Entries
              <span className="text-xs font-medium text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700/50">
                {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"}
              </span>
            </h2>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 hide-scrollbar">
            <Filter className="w-4 h-4 text-slate-500 flex-shrink-0" />
            {filterOptions.map(opt => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${filter === opt
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto table-scroll">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-950/50 text-slate-400 text-sm">
                <th className="p-4 font-medium w-16">S.No</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Milk (L)</th>
                <th className="p-4 font-medium">Rate</th>
                <th className="p-4 font-medium">Extras</th>
                <th className="p-4 font-medium">Total</th>
                {isAdmin && <th className="p-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredEntries.map((entry, index) => {
                  const milkTotal = entry.milkQuantity * entry.milkPricePerLitre;
                  const extrasTotal = entry.extraItems.reduce((sum, item) => sum + item.price, 0);
                  const dailyTotal = milkTotal + extrasTotal;
                  const hasExtras = entry.extraItems && entry.extraItems.length > 0;

                  return (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`border-b transition-colors group ${hasExtras
                        ? "bg-amber-500/[0.08] hover:bg-amber-500/[0.14] border-amber-500/30"
                        : "border-slate-800/50 hover:bg-slate-800/20"
                        }`}
                    >
                      <td className="p-4 text-slate-400 text-sm font-medium">
                        <span className="flex items-center gap-1.5">
                          {index + 1}
                          {hasExtras && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Extra items bought" />
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">
                        {format(new Date(entry.date), 'dd MMM yyyy')}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-sm font-medium">
                          {entry.milkQuantity} L
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">₹{entry.milkPricePerLitre}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {entry.extraItems.length === 0 ? (
                            <span className="text-slate-500 text-sm">-</span>
                          ) : (
                            entry.extraItems.map(item => (
                              <span
                                key={item.id}
                                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border font-medium ${filter !== "All" && item.name.toLowerCase().includes(filter.toLowerCase())
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm"
                                  : "bg-amber-500/20 text-amber-200 border-amber-500/30"
                                  }`}
                              >
                                <span>{item.name}</span>
                                <span className="text-amber-400/80 text-[10px]">({item.quantity}gm)</span>
                                <span className="text-amber-300 font-semibold">₹{item.price}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-medium text-slate-200">
                        <span className={hasExtras ? "text-amber-300 font-semibold" : "text-slate-200"}>
                          ₹{dailyTotal}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => { setEditingEntry(entry); setIsModalOpen(true); }}
                              className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No entries found for this filter.
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      <EntryFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingEntry={editingEntry}
        initialMode={modalMode}
        defaultDate={new Date(year, month, new Date().getDate())}
        setGlobalLoading={setGlobalLoading}
      />
      <CalendarPickerModal
        isOpen={isCalendarPickerOpen}
        onClose={() => setIsCalendarPickerOpen(false)}
        initialMonth={month}
        initialYear={year}
        existingEntries={initialEntries}
        setGlobalLoading={setGlobalLoading}
      />
      <LoginFormModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        setGlobalLoading={setGlobalLoading}
        startTransition={startTransition}
      />
      {(globalLoading.isLoading || isPending) && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-200 font-medium">
            {globalLoading.isLoading ? globalLoading.message : "Refreshing page, please wait..."}
          </p>
        </div>
      )}
    </div>
  );
}
