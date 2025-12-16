import { ReactNode } from "react";
import { AppleNav } from "./AppleNav";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppleNav />
      <main className="pt-14">
        <div className="container-apple py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
