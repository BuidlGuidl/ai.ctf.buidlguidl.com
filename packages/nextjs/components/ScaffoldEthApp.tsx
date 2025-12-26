import { Suspense } from "react";
import { Header } from "./Header";

export const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Suspense>
        <Header />
      </Suspense>
      <main className="relative flex flex-col flex-1">{children}</main>
      <Suspense>
        <Header />
      </Suspense>
    </div>
  );
};
