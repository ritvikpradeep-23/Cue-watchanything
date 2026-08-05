import { useAuth } from "../lib/auth-context";
import { LandingPage } from "./LandingPage";
import { DashboardPage } from "./DashboardPage";

export function HomeRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <DashboardPage /> : <LandingPage />;
}
