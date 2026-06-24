import { useState, useEffect } from "react";
import LoginCard from "@/components/ui/login-card";
import DashboardLayout from "@/components/dashboard/dashboard-layout";

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Simple client-side routing fallback redirection
  useEffect(() => {
    if (window.location.pathname === "/" || window.location.pathname === "") {
      window.history.pushState({}, "", "/login");
      setCurrentPath("/login");
    }
  }, []);

  if (currentPath === "/dashboard") {
    return <DashboardLayout />;
  }

  return <LoginCard />;
}
