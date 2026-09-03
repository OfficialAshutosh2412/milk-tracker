"use client";

import { useEffect, useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Calendar, CalendarRange, Info } from "lucide-react";
import { addEntry, addRangeEntries, checkExistingEntries } from "@/app/actions";
import ConfirmUpdateModal from "./ConfirmUpdateModal";

const extraItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  quantity: z.number().min(0, "Quantity must be >= 0"),
  price: z.number().min(0, "Price must be >= 0"),
});

const entrySchema = z.object({
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  milkQuantity: z.number().min(0, "Milk quantity must be >= 0"),
  milkPricePerLitre: z.number().min(0, "Price must be >= 0"),
  extraItems: z.array(extraItemSchema),
});

type EntryFormValues = z.infer<typeof entrySchema>;

export default function EntryFormModal({
  isOpen,
  onClose,
  editingEntry,
  defaultDate,
  initialMode = "single",
  setGlobalLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingEntry: any;
  defaultDate: Date;
  initialMode?: "single" | "range";
  setGlobalLoading: React.Dispatch<React.SetStateAction<{ isLoading: boolean; message: string }>>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"single" | "range">(initialMode);
  const [rangeError, setRangeError] = useState("");

  // Confirmation prompt state for existing dates
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [existingEntryData, setExistingEntryData] = useState<any>(null);
  const [pendingFormData, setPendingFormData] = useState<EntryFormValues | null>(null);
  const [conflictCount, setConflictCount] = useState(0);
  const [conflictMode, setConflictMode] = useState<"single" | "range">("single");

  const formattedDefaultDate = useMemo(() => format(defaultDate, "yyyy-MM-dd"), [defaultDate]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      date: formattedDefaultDate,
      startDate: formattedDefaultDate,
      endDate: formattedDefaultDate,
      milkQuantity: 1,
      milkPricePerLitre: 60,
      extraItems: [],
    },
  });

  const watchStartDate = watch("startDate");
  const watchEndDate = watch("endDate");

  const rangeDaysCount = useMemo(() => {
    if (!watchStartDate || !watchEndDate) return 0;
    try {
      const s = parseISO(watchStartDate);
      const e = parseISO(watchEndDate);
      const diff = differenceInCalendarDays(e, s);
      return diff >= 0 ? diff + 1 : -1;
    } catch {
      return 0;
    }
  }, [watchStartDate, watchEndDate]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "extraItems",
  });

  useEffect(() => {
    if (editingEntry) {
      setMode("single");
      reset({
        date: format(new Date(editingEntry.date), "yyyy-MM-dd"),
        startDate: format(new Date(editingEntry.date), "yyyy-MM-dd"),
        endDate: format(new Date(editingEntry.date), "yyyy-MM-dd"),
        milkQuantity: editingEntry.milkQuantity,
        milkPricePerLitre: editingEntry.milkPricePerLitre,
        extraItems: editingEntry.extraItems,
      });
    } else {
      setMode(initialMode);
      reset({
        date: formattedDefaultDate,
        startDate: formattedDefaultDate,
        endDate: formattedDefaultDate,
        milkQuantity: 1,
        milkPricePerLitre: 60,
        extraItems: [],
      });
    }
    setRangeError("");
    setIsConfirmOpen(false);
    setExistingEntryData(null);
    setPendingFormData(null);
  }, [editingEntry, defaultDate, formattedDefaultDate, initialMode, reset, isOpen]);

  const executeSaveSingle = async (data: EntryFormValues) => {
    setIsSubmitting(true);
    setGlobalLoading({
      isLoading: true,
      message: editingEntry ? "Updating entry, please wait..." : "Saving entry, please wait...",
    });

    try {
      await addEntry({
        date: data.date || formattedDefaultDate,
        milkQuantity: data.milkQuantity,
        milkPricePerLitre: data.milkPricePerLitre,
        extraItems: data.extraItems,
      });
      setIsConfirmOpen(false);
      onClose();
    } catch (error: any) {
      console.error(error);
      setRangeError(error?.message || "Failed to save entry");
    } finally {
      setIsSubmitting(false);
      setGlobalLoading({ isLoading: false, message: "" });
    }
  };

  const executeSaveRange = async (data: EntryFormValues, skipExisting: boolean) => {
    setIsSubmitting(true);
    setGlobalLoading({
      isLoading: true,
      message: skipExisting
        ? "Saving new dates (preserving existing records)..."
        : `Updating entries for ${rangeDaysCount > 0 ? rangeDaysCount : ""} days...`,
    });

    try {
      await addRangeEntries({
        startDate: data.startDate!,
        endDate: data.endDate!,
        milkQuantity: data.milkQuantity,
        milkPricePerLitre: data.milkPricePerLitre,
        extraItems: data.extraItems,
        skipExisting,
      });
      setIsConfirmOpen(false);
      onClose();
    } catch (error: any) {
      console.error(error);
      setRangeError(error?.message || "Failed to save range entries");
    } finally {
      setIsSubmitting(false);
      setGlobalLoading({ isLoading: false, message: "" });
    }
  };

  const onSubmit = async (data: EntryFormValues) => {
    setRangeError("");

    // If editing existing entry directly, user intentionally clicked "Edit"
    if (editingEntry) {
      await executeSaveSingle(data);
      return;
    }

    // Range mode check
    if (mode === "range") {
      if (!data.startDate || !data.endDate) {
        setRangeError("Both Start Date and End Date are required.");
        return;
      }
      if (data.startDate > data.endDate) {
        setRangeError("Start Date cannot be after End Date.");
        return;
      }

      // Generate dates in range to check for conflicts
      const [sy, sm, sd] = data.startDate.split("-").map(Number);
      const [ey, em, ed] = data.endDate.split("-").map(Number);
      const cur = new Date(Date.UTC(sy, sm - 1, sd));
      const end = new Date(Date.UTC(ey, em - 1, ed));
      const datesInRange: string[] = [];
      while (cur.getTime() <= end.getTime()) {
        const y = cur.getUTCFullYear();
        const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
        const d = String(cur.getUTCDate()).padStart(2, "0");
        datesInRange.push(`${y}-${m}-${d}`);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      try {
        const existingList = await checkExistingEntries(datesInRange);
        if (existingList && existingList.length > 0) {
          setConflictCount(existingList.length);
          setPendingFormData(data);
          setConflictMode("range");
          setIsConfirmOpen(true);
          return;
        }
      } catch (err) {
        console.error("Error checking existing entries", err);
      }

      await executeSaveRange(data, false);
      return;
    }

    // Single mode check
    const targetDate = data.date || formattedDefaultDate;
    try {
      const existingList = await checkExistingEntries([targetDate]);
      if (existingList && existingList.length > 0) {
        setExistingEntryData(existingList[0]);
        setPendingFormData(data);
        setConflictMode("single");
        setIsConfirmOpen(true);
        return;
      }
    } catch (err) {
      console.error("Error checking existing entry", err);
    }

    await executeSaveSingle(data);
  };

  // User responses from the custom prompt
  const handleConfirmYes = () => {
    if (!pendingFormData) return;
    if (conflictMode === "single") {
      executeSaveSingle(pendingFormData);
    } else {
      executeSaveRange(pendingFormData, false); // Overwrite with new data
    }
  };

  const handleConfirmNo = () => {
    if (conflictMode === "single") {
      // Use existing data -> do not overwrite, simply close
      setIsConfirmOpen(false);
      onClose();
    } else if (pendingFormData) {
      // Range mode: skip existing entries, write only to empty dates
      executeSaveRange(pendingFormData, true);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-semibold text-slate-100">
                  {editingEntry
                    ? "Edit Entry"
                    : mode === "range"
                    ? "Add Entries Between Dates"
                    : "New Entry"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingEntry
                    ? "Modify existing daily entry"
                    : mode === "range"
                    ? "Bulk populate entries across a date range"
                    : "Add milk delivery for a specific date"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              {/* Mode Switch Tabs (Only when creating new entry) */}
              {!editingEntry && (
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("single");
                      setRangeError("");
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                      mode === "single"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Single Day</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("range");
                      setRangeError("");
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg transition-all ${
                      mode === "range"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <CalendarRange className="w-3.5 h-3.5" />
                    <span>Date Range (Between Dates)</span>
                  </button>
                </div>
              )}

              <form id="entry-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Date selection: Single Date or Date Range */}
                {mode === "single" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">Date</label>
                      <input
                        type="date"
                        {...register("date")}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      {errors.date && <p className="text-red-400 text-xs">{errors.date.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">
                        Milk (Litres)
                        <span className="ml-2 text-[10px] text-slate-500 font-normal">(0 if no milk)</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        {...register("milkQuantity", { valueAsNumber: true })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      {errors.milkQuantity && (
                        <p className="text-red-400 text-xs">{errors.milkQuantity.message}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">Start Date</label>
                        <input
                          type="date"
                          {...register("startDate")}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">End Date</label>
                        <input
                          type="date"
                          {...register("endDate")}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>
                    </div>

                    {rangeError && (
                      <p className="text-red-400 text-xs bg-red-950/40 border border-red-800/40 p-2.5 rounded-xl">
                        {rangeError}
                      </p>
                    )}

                    {rangeDaysCount > 0 && !rangeError && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs text-indigo-300">
                        <Info className="w-4 h-4 flex-shrink-0 text-indigo-400" />
                        <span>
                          Data will be added across <strong>{rangeDaysCount} days</strong> ({watchStartDate} to {watchEndDate}).
                        </span>
                      </div>
                    )}

                    {rangeDaysCount < 0 && !rangeError && (
                      <p className="text-amber-400 text-xs bg-amber-950/40 border border-amber-800/40 p-2.5 rounded-xl">
                        End date must be greater than or equal to start date.
                      </p>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">
                        Daily Milk Quantity (Litres per day)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        {...register("milkQuantity", { valueAsNumber: true })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                      {errors.milkQuantity && (
                        <p className="text-red-400 text-xs">{errors.milkQuantity.message}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Price per Litre */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">
                    Price per Litre (₹)
                    <span className="ml-2 text-[10px] text-slate-500 font-normal">(set 0 if no milk today)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    {...register("milkPricePerLitre", { valueAsNumber: true })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  {errors.milkPricePerLitre && (
                    <p className="text-red-400 text-xs">{errors.milkPricePerLitre.message}</p>
                  )}
                </div>

                {/* Extra Items */}
                <div className="pt-4 border-t border-slate-800">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-sm font-medium text-slate-300">Extra Items</h3>
                      {mode === "range" && fields.length > 0 && (
                        <p className="text-[11px] text-slate-400">
                          These items will be included for each day in the range.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => append({ name: "", quantity: 1, price: 0 })}
                      className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-full transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex gap-2 items-start bg-slate-950/50 p-3 rounded-xl border border-slate-800/50"
                      >
                        <div className="flex-1 space-y-2">
                          <div>
                            <label className="text-xs font-medium text-slate-400 mb-1 block">
                              Item Name
                            </label>
                            <select
                              {...register(`extraItems.${index}.name`)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                            >
                              <option value="" disabled>
                                Select Item
                              </option>
                              <option value="Dahi">Dahi</option>
                              <option value="Paneer">Paneer</option>
                              <option value="Masala">Masala</option>
                              <option value="Matar">Matar</option>
                              <option value="Bread">Bread</option>
                              <option value="Buns">Buns</option>
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <div className="w-1/3">
                              <label className="text-xs font-medium text-slate-400 mb-1 block">
                                Quantity (gm)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="gm"
                                {...register(`extraItems.${index}.quantity`, { valueAsNumber: true })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                              />
                            </div>
                            <div className="w-2/3">
                              <label className="text-xs font-medium text-slate-400 mb-1 block">
                                Total Price (₹)
                              </label>
                              <input
                                type="number"
                                placeholder="Total (₹)"
                                {...register(`extraItems.${index}.price`, { valueAsNumber: true })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg mt-1 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {fields.length === 0 && (
                      <p className="text-slate-500 text-xs text-center py-2">No extra items added.</p>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Footer Actions */}
            <div className="p-5 border-t border-slate-800 bg-slate-900/50">
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="entry-form"
                  disabled={isSubmitting || (mode === "range" && rangeDaysCount < 1)}
                  className={`px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center gap-2 ${
                    mode === "range"
                      ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                      : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20"
                  }`}
                >
                  {isSubmitting && (
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
                  )}
                  {editingEntry
                    ? "Save Changes"
                    : mode === "range"
                    ? `Save for ${rangeDaysCount > 0 ? rangeDaysCount + " Days" : "Date Range"}`
                    : "Save Entry"}
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
        dateStr={
          conflictMode === "single"
            ? pendingFormData?.date || formattedDefaultDate
            : `${pendingFormData?.startDate} to ${pendingFormData?.endDate}`
        }
        existingEntry={existingEntryData}
        newEntry={
          pendingFormData
            ? {
                milkQuantity: pendingFormData.milkQuantity,
                milkPricePerLitre: pendingFormData.milkPricePerLitre,
                extraItems: pendingFormData.extraItems,
              }
            : null
        }
        isMultiple={conflictMode === "range"}
        count={conflictCount}
        onConfirmYes={handleConfirmYes}
        onConfirmNo={handleConfirmNo}
      />
    </>
  );
}
