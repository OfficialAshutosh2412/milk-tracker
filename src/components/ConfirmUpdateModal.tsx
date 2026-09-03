"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Milk, ShoppingBag, ArrowRight, X, Check, RotateCcw } from "lucide-react";

export interface ExistingEntryData {
  id?: string;
  date: string | Date;
  milkQuantity: number;
  milkPricePerLitre: number;
  extraItems?: Array<{ name: string; quantity: number; price: number }>;
}

export interface NewEntryData {
  date?: string;
  milkQuantity: number;
  milkPricePerLitre: number;
  extraItems?: Array<{ name: string; quantity: number; price: number }>;
}

interface ConfirmUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr?: string;
  existingEntry?: ExistingEntryData | null;
  newEntry?: NewEntryData | null;
  count?: number; // When multiple dates are involved
  isMultiple?: boolean;
  onConfirmYes: () => void; // Update with current data
  onConfirmNo: () => void;  // Use existing data
}

export default function ConfirmUpdateModal({
  isOpen,
  onClose,
  dateStr,
  existingEntry,
  newEntry,
  count = 1,
  isMultiple = false,
  onConfirmYes,
  onConfirmNo,
}: ConfirmUpdateModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 15 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  {isMultiple ? "Existing Entries Detected" : "Entry Already Exists"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isMultiple
                    ? `${count} selected date(s) already have data`
                    : dateStr ? `An entry is already recorded for ${dateStr}` : "Date already has an existing entry"}
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

          {/* Body */}
          <div className="p-5 space-y-4">
            {!isMultiple && existingEntry && newEntry ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-300">
                  You already have an entry for this date. Compare the values below:
                </p>

                {/* Comparison Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Existing Data */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Existing Data
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                        In Database
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Milk className="w-3 h-3 text-blue-400" /> Milk:
                        </span>
                        <span className="font-semibold text-slate-200">
                          {existingEntry.milkQuantity} L @ ₹{existingEntry.milkPricePerLitre}
                        </span>
                      </div>

                      <div className="flex items-start justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3 text-emerald-400" /> Extras:
                        </span>
                        <span className="text-right text-slate-300 max-w-[140px] truncate">
                          {existingEntry.extraItems && existingEntry.extraItems.length > 0
                            ? existingEntry.extraItems.map((i) => i.name).join(", ")
                            : "None"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* New Data */}
                  <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-blue-800/30">
                      <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">
                        New Data
                      </span>
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                        Current Input
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Milk className="w-3 h-3 text-blue-400" /> Milk:
                        </span>
                        <span className="font-semibold text-blue-200">
                          {newEntry.milkQuantity} L @ ₹{newEntry.milkPricePerLitre}
                        </span>
                      </div>

                      <div className="flex items-start justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3 text-emerald-400" /> Extras:
                        </span>
                        <span className="text-right text-blue-200 max-w-[140px] truncate">
                          {newEntry.extraItems && newEntry.extraItems.length > 0
                            ? newEntry.extraItems.map((i) => i.name).join(", ")
                            : "None"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                <p className="text-slate-200">
                  <strong className="text-amber-400">{count}</strong> of the selected dates already contain existing records.
                </p>
                <p className="text-slate-400">
                  Select <strong>&quot;Yes, Update&quot;</strong> to overwrite existing entries with your new data, or <strong>&quot;No, Use Existing Data&quot;</strong> to keep the existing entries untouched.
                </p>
              </div>
            )}

            <div className="p-3 bg-amber-950/20 border border-amber-800/30 rounded-xl text-xs text-amber-300">
              Do you want to update with current data or keep the existing data?
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row gap-2.5 justify-end">
            {/* NO: Use existing data */}
            <button
              type="button"
              onClick={onConfirmNo}
              className="px-4 py-2.5 text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              <span>No, Use Existing Data</span>
            </button>

            {/* YES: Update with current data */}
            <button
              type="button"
              onClick={onConfirmYes}
              className="px-4 py-2.5 text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Yes, Update with Current Data</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
