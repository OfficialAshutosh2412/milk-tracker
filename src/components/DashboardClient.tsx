"use client";

import { useState, useMemo, useTransition } from "react";
import { format, getDaysInMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Download, FileText, ChevronLeft, ChevronRight, Edit2, Trash2, Milk, Filter } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useRouter } from "next/navigation";
import EntryFormModal from "./EntryFormModal";
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DailyEntry | null>(null);
  const [filter, setFilter] = useState("All");
  const [globalLoading, setGlobalLoading] = useState({ isLoading: false, message: "" });
  const [isPending, startTransition] = useTransition();
  
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
      
      const row = worksheet.addRow({
        sno: index + 1,
        date: format(new Date(e.date), 'dd MMM yyyy'),
        milk: e.milkQuantity,
        rate: `₹${e.milkPricePerLitre}`,
        milkTotal: `₹${milkTotal}`,
        extras: extraItemsStr,
        extrasTotal: `₹${extrasTotal}`,
        grandTotal: `₹${milkTotal + extrasTotal}`
      });

      if (row.number % 2 === 0) {
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
    doc.text(`Milk Tracker - ${format(new Date(year, month), 'MMMM yyyy')} (${filter})`, 14, 15);
    
    const tableData = filteredEntries.map((e, index) => {
      const milkTotal = e.milkQuantity * e.milkPricePerLitre;
      const extrasTotal = e.extraItems.reduce((sum, item) => sum + item.price, 0);
      return [
        (index + 1).toString(),
        format(new Date(e.date), 'dd MMM yyyy'),
        e.milkQuantity.toString(),
        `Rs. ${milkTotal}`,
        `Rs. ${extrasTotal}`,
        `Rs. ${milkTotal + extrasTotal}`
      ];
    });

    autoTable(doc, {
      head: [['S.No', 'Date', 'Milk (L)', 'Milk Total', 'Extras Total', 'Grand Total']],
      body: tableData,
      startY: 20,
    });
    
    doc.save(`Milk_Tracker_${format(new Date(year, month), 'MMM_yyyy')}.pdf`);
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
      {/* Header & Controls */}
      <div className="sticky top-2 md:top-4 z-50 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800/50 backdrop-blur-xl shadow-lg shadow-black/20">
        <div className="flex items-center gap-4">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-400" />
          </button>
          <h1 className="text-2xl font-semibold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent w-40 text-center">
            {format(new Date(year, month), 'MMMM yyyy')}
          </h1>
          <button onClick={handleNextMonth} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 justify-center">
          <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all shadow-sm">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all shadow-sm">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          {isAdmin ? (
            <>
              <button 
                onClick={() => { setEditingEntry(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Add Entry</span>
              </button>
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
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-500 hover:text-white text-slate-200 rounded-xl transition-all shadow-sm"
              >
                <span>Logout</span>
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20"
            >
              <span>Admin Login</span>
            </button>
          )}
        </div>
      </div>

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
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-slate-200">Daily Entries</h2>
          
          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
            <Filter className="w-4 h-4 text-slate-500" />
            {filterOptions.map(opt => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
                  filter === opt 
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" 
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
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

                  return (
                    <motion.tr 
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors group"
                    >
                      <td className="p-4 text-slate-400 text-sm font-medium">
                        {index + 1}
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
                        <div className="flex flex-wrap gap-1">
                          {entry.extraItems.length === 0 ? (
                            <span className="text-slate-500 text-sm">-</span>
                          ) : (
                            entry.extraItems.map(item => (
                              <span 
                                key={item.id} 
                                className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${
                                  filter !== "All" && item.name.toLowerCase().includes(filter.toLowerCase())
                                    ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                    : "bg-slate-800 text-slate-300 border-slate-700"
                                }`}
                              >
                                {item.name}({item.quantity}gm : ₹{item.price})
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-medium text-slate-200">
                        ₹{dailyTotal}
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
        defaultDate={new Date(year, month, new Date().getDate())}
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
