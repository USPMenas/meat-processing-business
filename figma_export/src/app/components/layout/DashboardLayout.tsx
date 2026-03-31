import { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Snowflake,
  Thermometer,
  TrendingUp,
} from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
  variant?: "operational" | "logistics" | "business";
}

export function DashboardLayout({
  children,
  variant = "operational",
}: DashboardLayoutProps) {
  const location = useLocation();

  const navItems = [
    {
      path: "/",
      label: "Operacional",
      icon: LayoutDashboard,
    },
    {
      path: "/logistics",
      label: "Logistica",
      icon: Thermometer,
    },
    {
      path: "/business",
      label: "Negocios",
      icon: TrendingUp,
    },
  ];

  const isBusinessVariant = variant === "business";

  return (
    <div
      className={`min-h-screen ${
        isBusinessVariant
          ? "bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100"
          : "bg-gray-50"
      }`}
    >
      <header
        className={`border-b ${
          isBusinessVariant
            ? "border-blue-200 bg-white/90 shadow-sm backdrop-blur-md"
            : "border-gray-200 bg-white"
        }`}
      >
        <div className="mx-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${
                  isBusinessVariant
                    ? "bg-blue-600"
                    : "bg-blue-500"
                }`}
              >
                <Snowflake className="size-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Frigorifico - Monitoramento
                </h1>
                <p className="text-sm text-gray-500">
                  {variant === "operational" &&
                    "Dashboard Operacional"}
                  {variant === "logistics" &&
                    "Dashboard de Logistica"}
                  {variant === "business" &&
                    "Dashboard Executivo"}
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.path;
                const isBusinessNav =
                  item.path === "/business";

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                      isActive
                        ? isBusinessNav
                          ? "bg-blue-600 text-white"
                          : "bg-blue-500 text-white"
                        : isBusinessNav
                          ? "text-gray-600 hover:bg-blue-50"
                          : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span className="text-sm font-medium">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
