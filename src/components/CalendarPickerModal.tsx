"use client";

import { useState, useMemo, useEffect } from "react";
import { format, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, CalendarCheck, Check, RotateCcw, Milk, Sparkles, AlertCircle } from "lucide-react";
import { addMultiDateMilkEntries, checkExistingEntries } from "@/app/actions";
import ConfirmUpdateModal from "./ConfirmUpdateModal";

interface CalendarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMonth: number;
  initialYear: number;
  existingEntries?: Array<{
    id: string;
    date: Date;
    milkQuantity: number;
    milkPricePerLitre: number;
  }>;
  setGlobalLoading: React.Dispatch<React.SetStateAction<{ isLoading: boolean; message: string }>>;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type MilkUnit = "L" | "ml";

export default function CalendarPickerModal({
  isOpen,
  onClose,
  initialMonth,
  initialYear,
  existingEntries = [],
  setGlobalLoading,
}: CalendarPickerModalProps) {
  const [currentViewDate, setCurrentViewDate] = useState<Date>(
    new Date(initialYear, initialMonth, 1)
  );
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  
  // Unit & input state (using string for smooth decimal typing without reset bugs)
  const [milkUnit, setMilkUnit] = useState<MilkUnit>("L");
  const [quantityInput, setQuantityInput] = useState<string>("1");
  const [priceInput, setPriceInput] = useState<string>("60");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [conflictCount, setConflictCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentViewDate(new Date(initialYear, initialMonth, 1));
      setSelectedDates(new Set());
      setMilkUnit("L");
      setQuantityInput("1");
      setPriceInput("60");
      setErrorMessage("");
    }
  }, [isOpen, initialMonth, initialYear]);

  // Normalize existing entries to YYYY-MM-DD using UTC to prevent timezone offsets
  const existingEntriesMap = useMemo(() => {
    const map = new Map<string, number>();
    existingEntries.forEach((entry) => {
      const d = new Date(entry.date);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      map.set(`${year}-${month}-${day}`, entry.milkQuantity);
    });
    return map;
  }, [existingEntries]);

  const viewYear = currentViewDate.getFullYear();
  const viewMonth = currentViewDate.getMonth();
  const daysInViewMonth = getDaysInMonth(currentViewDate);
  const startDayOfWeek = getDay(startOfMonth(currentViewDate));

  const handlePrevMonth = () => {
    setCurrentViewDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentViewDate((prev) => addMonths(prev, 1));
  };

  // Convert quantity when toggling between L and ml
  const handleUnitChange = (newUnit: MilkUnit) => {
    if (newUnit === milkUnit) return;
    const num = parseFloat(quantityInput);
    if (!isNaN(num) && num > 0) {
      if (newUnit === "ml") {
        // L -> ml (e.g. 1.5 L -> 1500 ml)
        setQuantityInput(String(Math.round(num * 1000)));
      } else {
        // ml -> L (e.g. 500 ml -> 0.5 L)
        setQuantityInput(String(num / 1000));
      }
    } else {
      setQuantityInput(newUnit === "ml" ? "1000" : "1");
    }
    setMilkUnit(newUnit);
  };

  // Calculate normalized quantity in Litres for database & calculations
  const parsedQuantityInLitres = useMemo(() => {
    const rawNum = parseFloat(quantityInput);
    if (isNaN(rawNum) || rawNum <= 0) return 0;
    return milkUnit === "ml" ? rawNum / 1000 : rawNum;
  }, [quantityInput, milkUnit]);

  const parsedPricePerLitre = useMemo(() => {
    const rawNum = parseFloat(priceInput);
    return isNaN(rawNum) || rawNum <= 0 ? 0 : rawNum;
  }, [priceInput]);

  const totalCalculatedCost = useMemo(() => {
    return selectedDates.size * parsedQuantityInLitres * parsedPricePerLitre;
  }, [selectedDates.size, parsedQuantityInLitres, parsedPricePerLitre]);

  const totalVolumeLitres = useMemo(() => {
    return selectedDates.size * parsedQuantityInLitres;
  }, [selectedDates.size, parsedQuantityInLitres]);

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const selectAllInCurrentMonth = () => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      for (let day = 1; day <= daysInViewMonth; day++) {
        const monthStr = String(viewMonth + 1).padStart(2, "0");
        const dayStr = String(day).padStart(2, "0");
        next.add(`${viewYear}-${monthStr}-${dayStr}`);
      }
      return next;
    });
  };

  const selectWeekdaysInMonth = () => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      for (let day = 1; day <= daysInViewMonth; day++) {
        const d = new Date(viewYear, viewMonth, day);
        const dayOfWeek = getDay(d);
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const monthStr = String(viewMonth + 1).padStart(2, "0");
          const dayStr = String(day).padStart(2, "0");
          next.add(`${viewYear}-${monthStr}-${dayStr}`);
        }
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedDates(new Set());
  };

  const selectedDatesArray = useMemo(() => {
    return Array.from(selectedDates).sort();
  }, [selectedDates]);

  const handlePresetSelect = (litres: number) => {
    if (milkUnit === "ml") {
      setQuantityInput(String(Math.round(litres * 1000)));
    } else {
      setQuantityInput(String(litres));
    }
  };

  const executeSave = async (skipExisting: boolean) => {
    setIsSubmitting(true);
    setGlobalLoading({
      isLoading: true,
      message: skipExisting
        ? "Saving milk for new dates (keeping existing data)..."
        : `Recording ${parsedQuantityInLitres}L milk for ${selectedDates.size} dates...`,
    });

    try {
      await addMultiDateMilkEntries({
        dates: selectedDatesArray,
        milkQuantity: parsedQuantityInLitres,
        milkPricePerLitre: parsedPricePerLitre,
        skipExisting,
      });
      setIsConfirmOpen(false);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || "Failed to record entries");
    } finally {
      setIsSubmitting(false);
      setGlobalLoading({ isLoading: false, message: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (selectedDates.size === 0) {
      setErrorMessage("Please select at least one date on the calendar.");
      return;
    }

    if (parsedQuantityInLitres <= 0) {
      setErrorMessage(`Please enter a valid milk quantity in ${milkUnit === "L" ? "Litres" : "ml"}.`);
      return;
    }

    if (parsedPricePerLitre <= 0) {
      setErrorMessage("Price per litre must be greater than 0.");
      return;
    }

    // Check if any of the selected dates already exist in database
    try {
      const existingList = await checkExistingEntries(selectedDatesArray);
      if (existingList && existingList.length > 0) {
        setConflictCount(existingList.length);
        setIsConfirmOpen(true);
        return;
      }
    } catch (err) {
      console.error("Error checking existing entries", err);
    }

    await executeSave(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[94vh]"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-slate-100 flex items-center gap-2">
                  Pick Dates (Milk Only)
                </h2>
                <p className="text-xs text-slate-400">
                  Select dates randomly on the calendar to log milk delivery
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
            {/* Calendar View Card */}
            <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 shadow-inner">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-center font-semibold text-slate-200 text-base">
                  {format(currentViewDate, "MMMM yyyy")}
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Select Actions */}
              <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-slate-800/70 text-xs">
                <span className="text-slate-400 font-medium">Quick Select:</span>
                <button
                  type="button"
                  onClick={selectAllInCurrentMonth}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  All Month
                </button>
                <button
                  type="button"
                  onClick={selectWeekdaysInMonth}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                >
                  Mon-Fri
                </button>
                {selectedDates.size > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="flex items-center gap-1 px-2.5 py-1 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors ml-auto"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear ({selectedDates.size})</span>
                  </button>
                )}
              </div>

              {/* Weekdays */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400 mb-2">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-10 sm:h-11" />
                ))}

                {Array.from({ length: daysInViewMonth }).map((_, index) => {
                  const dayNum = index + 1;
                  const monthStr = String(viewMonth + 1).padStart(2, "0");
                  const dayStr = String(dayNum).padStart(2, "0");
                  const dateKey = `${viewYear}-${monthStr}-${dayStr}`;
                  const isSelected = selectedDates.has(dateKey);
                  const existingQty = existingEntriesMap.get(dateKey);

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => toggleDate(dateKey)}
                      className={`h-10 sm:h-11 rounded-xl relative flex flex-col items-center justify-center text-xs font-medium transition-all select-none ${
                        isSelected
                          ? "bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30 scale-105 border border-purple-400/60 ring-2 ring-purple-500/20"
                          : "bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:border-slate-700 border border-slate-800/70"
                      }`}
                    >
                      <span className="leading-none text-xs sm:text-sm">{dayNum}</span>
                      {isSelected ? (
                        <span className="text-[9px] leading-none text-purple-200 mt-0.5 font-bold">
                          {parsedQuantityInLitres > 0 ? `${parsedQuantityInLitres}L` : "✓"}
                        </span>
                      ) : existingQty !== undefined ? (
                        <span className="text-[9px] leading-none text-blue-400/90 mt-0.5">
                          {existingQty}L
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selection Overview Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Selected:</span>
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 font-semibold rounded-md">
                  {selectedDates.size} {selectedDates.size === 1 ? "date" : "dates"}
                </span>
                {selectedDates.size > 0 && parsedQuantityInLitres > 0 && (
                  <span className="text-slate-400 hidden sm:inline">
                    • Total: <strong className="text-slate-200">{totalVolumeLitres.toFixed(1)} L</strong>
                  </span>
                )}
              </div>

              {selectedDates.size > 0 && (
                <div className="text-slate-400">
                  Est. Cost:{" "}
                  <strong className="text-emerald-400 font-semibold text-sm">
                    ₹{Math.round(totalCalculatedCost).toLocaleString("en-IN")}
                  </strong>
                </div>
              )}
            </div>

            {/* Milk Unit & Quantity Configuration */}
            <form id="calendar-milk-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div className="bg-slate-950/50 p-4 border border-slate-800/80 rounded-2xl space-y-3">
                {/* Unit Switcher & Label */}
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <Milk className="w-4 h-4 text-blue-400" />
                    <span>Daily Milk Quantity</span>
                  </label>

                  {/* Unit Selector: Litres (L) vs Millilitres (ml) */}
                  <div className="inline-flex p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => handleUnitChange("L")}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        milkUnit === "L"
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Litres (L)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnitChange("ml")}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        milkUnit === "ml"
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Millilitres (ml)
                    </button>
                  </div>
                </div>

                {/* Preset Quick Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
                  {[0.5, 1, 1.5, 2, 2.5].map((amt) => {
                    const label = milkUnit === "ml" ? `${Math.round(amt * 1000)} ml` : `${amt} L`;
                    const isActive = parsedQuantityInLitres === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handlePresetSelect(amt)}
                        className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                          isActive
                            ? "bg-purple-600/20 border-purple-500/50 text-purple-300 font-semibold"
                            : "bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Input Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Quantity Input with Suffix */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400">
                      Amount ({milkUnit === "L" ? "Litres per day" : "ml per day"})
                    </span>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={quantityInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Allow numbers, decimal point, or empty
                          if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                            setQuantityInput(val);
                          }
                        }}
                        placeholder={milkUnit === "L" ? "e.g. 1.5" : "e.g. 1500"}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3.5 pr-12 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                      <span className="absolute right-3 text-xs font-semibold text-purple-400 pointer-events-none">
                        {milkUnit}
                      </span>
                    </div>
                    {milkUnit === "ml" && parsedQuantityInLitres > 0 && (
                      <p className="text-[11px] text-slate-400">
                        = {parsedQuantityInLitres} Litres / day
                      </p>
                    )}
                  </div>

                  {/* Price Input with Prefix */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400">Rate (₹ per Litre)</span>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-sm text-slate-400 pointer-events-none">
                        ₹
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={priceInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                            setPriceInput(val);
                          }
                        }}
                        placeholder="60"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Informative Note */}
              <div className="flex items-start gap-2 p-3 bg-purple-950/20 border border-purple-800/30 rounded-xl text-xs text-purple-300/90">
                <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <span>
                  Updates milk only ({parsedQuantityInLitres > 0 ? `${parsedQuantityInLitres}L` : "amount"} @ ₹{parsedPricePerLitre}/L). Existing extra items on selected dates will not be touched.
                </span>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/50">
            <div className="flex gap-3 justify-end items-center">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="calendar-milk-form"
                disabled={isSubmitting || selectedDates.size === 0 || parsedQuantityInLitres <= 0}
                className="px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>
                      Add Milk ({parsedQuantityInLitres}L) to {selectedDates.size} {selectedDates.size === 1 ? "Date" : "Dates"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>

    {/* Custom Confirmation Prompt for Existing Date(s) */}
    <ConfirmUpdateModal
      isOpen={isConfirmOpen}
      onClose={() => setIsConfirmOpen(false)}
      isMultiple={true}
      count={conflictCount}
      onConfirmYes={() => executeSave(false)}
      onConfirmNo={() => executeSave(true)}
    />
    </>
  );
}
