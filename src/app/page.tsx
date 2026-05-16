import { getEntries, checkAuth } from "./actions";
import DashboardClient from "@/components/DashboardClient";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const resolvedParams = await searchParams;
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const month = resolvedParams?.month ? parseInt(resolvedParams.month) : currentMonth;
  const year = resolvedParams?.year ? parseInt(resolvedParams.year) : currentYear;
  
  const entries = await getEntries(month, year);

  const isAdmin = await checkAuth();

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <DashboardClient 
        initialEntries={entries} 
        month={month} 
        year={year} 
        isAdmin={isAdmin}
      />
    </main>
  );
}
