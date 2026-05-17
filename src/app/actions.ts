"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function checkAuth() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_auth")?.value === "true";
}

export async function login(formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  
  if (email === "ashutoshprasad2427@gmail.com" && password === "@Sannu123") {
    const cookieStore = await cookies();
    cookieStore.set("admin_auth", "true", { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
    return { success: true };
  }
  return { success: false, error: "Invalid credentials" };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_auth");
  revalidatePath("/");
}

export async function getEntries(month?: number, year?: number) {
  const currentDate = new Date();
  const m = month ?? currentDate.getMonth();
  const y = year ?? currentDate.getFullYear();
  
  const startOfMonth = new Date(y, m, 1);
  const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);
  
  const entries = await prisma.dailyEntry.findMany({
    where: {
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
    include: {
      extraItems: true,
    },
    orderBy: {
      date: 'asc',
    },
  });
  
  return entries;
}

export async function addEntry(data: any) {
  const isAdmin = await checkAuth();
  if (!isAdmin) throw new Error("Unauthorized");

  const { date, milkQuantity, milkPricePerLitre, extraItems } = data;
  
  const dateObj = new Date(date);
  
  // Try to find if entry exists for this date (just same day)
  // In a real app we might want to group by day strictly, but since date is DateTime unique, we have to match exactly or just let unique constraint handle it.
  // Actually, wait, date is unique but DateTime has time component. Let's normalize to midnight UTC.
  const normalizedDate = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  
  const entry = await prisma.dailyEntry.upsert({
    where: {
      date: normalizedDate,
    },
    update: {
      milkQuantity,
      milkPricePerLitre,
      extraItems: {
        deleteMany: {},
        create: extraItems?.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })) || [],
      },
    },
    create: {
      date: normalizedDate,
      milkQuantity,
      milkPricePerLitre,
      extraItems: {
        create: extraItems?.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })) || [],
      },
    },
  });
  
  revalidatePath("/");
  return entry;
}

export async function deleteEntry(id: string) {
  const isAdmin = await checkAuth();
  if (!isAdmin) throw new Error("Unauthorized");

  await prisma.dailyEntry.delete({
    where: { id }
  });
  revalidatePath("/");
}
