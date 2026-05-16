"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { addEntry } from "@/app/actions";

const extraItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  quantity: z.number().min(0.1, "Quantity must be > 0"),
  price: z.number().min(1, "Price must be > 0"),
});

const entrySchema = z.object({
  date: z.string(),
  milkQuantity: z.number().min(0, "Milk quantity must be >= 0"),
  milkPricePerLitre: z.number().min(1, "Price must be >= 1"),
  extraItems: z.array(extraItemSchema),
});

type EntryFormValues = z.infer<typeof entrySchema>;

export default function EntryFormModal({
  isOpen,
  onClose,
  editingEntry,
  defaultDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingEntry: any;
  defaultDate: Date;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      date: format(defaultDate, "yyyy-MM-dd"),
      milkQuantity: 1,
      milkPricePerLitre: 60,
      extraItems: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "extraItems",
  });

  useEffect(() => {
    if (editingEntry) {
      reset({
        date: format(new Date(editingEntry.date), "yyyy-MM-dd"),
        milkQuantity: editingEntry.milkQuantity,
        milkPricePerLitre: editingEntry.milkPricePerLitre,
        extraItems: editingEntry.extraItems,
      });
    } else {
      reset({
        date: format(defaultDate, "yyyy-MM-dd"),
        milkQuantity: 1,
        milkPricePerLitre: 60,
        extraItems: [],
      });
    }
  }, [editingEntry, defaultDate, reset, isOpen]);

  const onSubmit = async (data: EntryFormValues) => {
    setIsSubmitting(true);
    try {
      await addEntry(data);
      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to save entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-5 border-b border-slate-800">
            <h2 className="text-xl font-semibold text-slate-100">
              {editingEntry ? "Edit Entry" : "New Entry"}
            </h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
            <form id="entry-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
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
                  <label className="text-sm font-medium text-slate-300">Milk (Litres)</label>
                  <input
                    type="number"
                    step="0.5"
                    {...register("milkQuantity", { valueAsNumber: true })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  {errors.milkQuantity && <p className="text-red-400 text-xs">{errors.milkQuantity.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Price per Litre (₹)</label>
                <input
                  type="number"
                  {...register("milkPricePerLitre", { valueAsNumber: true })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-slate-300">Extra Items</h3>
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
                    <div key={field.id} className="flex gap-2 items-start bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">
                      <div className="flex-1 space-y-2">
                        <div>
                          <label className="text-xs font-medium text-slate-400 mb-1 block">Item Name</label>
                          <select
                            {...register(`extraItems.${index}.name`)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                          >
                            <option value="" disabled>Select Item</option>
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
                            <label className="text-xs font-medium text-slate-400 mb-1 block">Quantity (gm)</label>
                            <input
                              type="number"
                              step="0.1"
                              placeholder="gm"
                              {...register(`extraItems.${index}.quantity`, { valueAsNumber: true })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
                            />
                          </div>
                          <div className="w-2/3">
                            <label className="text-xs font-medium text-slate-400 mb-1 block">Total Price (₹)</label>
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
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                )}
                Save Entry
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
