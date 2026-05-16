"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { login } from "@/app/actions";
import { useRouter } from "next/navigation";

export default function LoginFormModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const res = await login(formData);
      
      if (res?.success) {
        onClose();
        router.refresh();
      } else {
        setError(res?.error || "Invalid credentials");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setIsLoading(false);
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
          className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
        >
          <div className="flex justify-between items-center p-5 border-b border-slate-800">
            <h2 className="text-xl font-semibold text-slate-100">Admin Login</h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <p className="text-red-400 text-sm">{error}</p>}
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-4 px-5 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? "Logging in..." : "Login"}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
