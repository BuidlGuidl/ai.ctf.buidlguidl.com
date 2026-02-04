import { Suspense } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

export const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col min-h-screen bg-black">
      <Suspense>
        <Header />
      </Suspense>
      <main className="relative flex flex-col flex-1">{children}</main>
      <Suspense>
        <Footer />
      </Suspense>
    </div>
  );
};
