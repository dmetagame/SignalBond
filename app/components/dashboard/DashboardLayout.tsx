"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type MobileNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const MobileNavContext = createContext<MobileNavContextValue>({
  open: false,
  setOpen: () => {},
});

export function useMobileNav(): MobileNavContextValue {
  return useContext(MobileNavContext);
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <MobileNavContext.Provider value={{ open, setOpen }}>
      <div className="flex min-h-screen bg-bg text-text">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}
