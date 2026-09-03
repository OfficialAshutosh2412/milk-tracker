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
  
  let normalizedDate: Date;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-").map(Number);
    normalizedDate = new Date(Date.UTC(y, m - 1, d));
  } else {
    const dateObj = new Date(date);
    normalizedDate = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
  }
  
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

export async function checkExistingEntries(dates: string[]) {
  const normalizedDates: Date[] = [];
  for (const dateStr of dates) {
    if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      normalizedDates.push(new Date(Date.UTC(y, m - 1, d)));
    } else {
      const dateObj = new Date(dateStr);
      normalizedDates.push(new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())));
    }
  }

  const existing = await prisma.dailyEntry.findMany({
    where: {
      date: { in: normalizedDates },
    },
    include: {
      extraItems: true,
    },
  });

  return existing;
}

export async function addRangeEntries(data: {
  startDate: string;
  endDate: string;
  milkQuantity: number;
  milkPricePerLitre: number;
  extraItems?: Array<{ name: string; quantity: number; price: number }>;
  skipExisting?: boolean;
}) {
  const isAdmin = await checkAuth();
  if (!isAdmin) throw new Error("Unauthorized");

  const { startDate, endDate, milkQuantity, milkPricePerLitre, extraItems, skipExisting } = data;

  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  if (start.getTime() > end.getTime()) {
    throw new Error("Start date must be before or equal to end date");
  }

  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    const normalizedDate = new Date(cur);

    if (skipExisting) {
      const existing = await prisma.dailyEntry.findUnique({
        where: { date: normalizedDate },
      });
      if (existing) {
        cur.setUTCDate(cur.getUTCDate() + 1);
        continue;
      }
    }

    await prisma.dailyEntry.upsert({
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

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  revalidatePath("/");
  return { success: true };
}

export async function addMultiDateMilkEntries(data: {
  dates: string[];
  milkQuantity: number;
  milkPricePerLitre: number;
  skipExisting?: boolean;
}) {
  const isAdmin = await checkAuth();
  if (!isAdmin) throw new Error("Unauthorized");

  const { dates, milkQuantity, milkPricePerLitre, skipExisting } = data;

  if (!dates || dates.length === 0) {
    throw new Error("Please select at least one date");
  }

  for (const dateStr of dates) {
    let normalizedDate: Date;
    if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      normalizedDate = new Date(Date.UTC(y, m - 1, d));
    } else {
      const dateObj = new Date(dateStr);
      normalizedDate = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    }

    if (skipExisting) {
      const existing = await prisma.dailyEntry.findUnique({
        where: { date: normalizedDate },
      });
      if (existing) {
        continue;
      }
    }

    await prisma.dailyEntry.upsert({
      where: {
        date: normalizedDate,
      },
      update: {
        milkQuantity,
        milkPricePerLitre,
      },
      create: {
        date: normalizedDate,
        milkQuantity,
        milkPricePerLitre,
      },
    });
  }

  revalidatePath("/");
  return { success: true, count: dates.length };
}

export async function deleteEntry(id: string) {
  const isAdmin = await checkAuth();
  if (!isAdmin) throw new Error("Unauthorized");

  await prisma.dailyEntry.delete({
    where: { id }
  });
  revalidatePath("/");
}
