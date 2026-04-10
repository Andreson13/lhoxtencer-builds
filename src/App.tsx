import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { HotelProvider } from "@/contexts/HotelContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { AppLayout } from "@/components/layout/AppLayout";
import LoginPage from "@/pages/auth/LoginPage";
import OnboardingPage from "@/pages/auth/OnboardingPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import RoomsPage from "@/pages/rooms/RoomsPage";
import AccessDeniedPage from "@/pages/AccessDeniedPage";
import NotFound from "@/pages/NotFound";
import {
  GuestsPage, ReservationsPage, CheckInOutPage, SiestesPage,
  MainCourantePage, RestaurantPage, KitchenDisplayPage, InventoryPage,
  BillingPage, CashExpensesPage, HousekeepingPage, ReportsPage,
  FeedbackPage, QRCodesPage, SettingsPage, AuditLogPage,
} from "@/pages/PlaceholderPages";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Chargement...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile?.hotel_id) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AuthProvider>
        <HotelProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/access-denied" element={<AccessDeniedPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/guests" element={<GuestsPage />} />
                  <Route path="/reservations" element={<ReservationsPage />} />
                  <Route path="/rooms" element={<RoomsPage />} />
                  <Route path="/check-in-out" element={<CheckInOutPage />} />
                  <Route path="/siestes" element={<SiestesPage />} />
                  <Route path="/main-courante" element={<MainCourantePage />} />
                  <Route path="/restaurant" element={<RestaurantPage />} />
                  <Route path="/kitchen" element={<KitchenDisplayPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/billing" element={<BillingPage />} />
                  <Route path="/cash-expenses" element={<CashExpensesPage />} />
                  <Route path="/housekeeping" element={<HousekeepingPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/feedback" element={<FeedbackPage />} />
                  <Route path="/qr-codes" element={<QRCodesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/audit" element={<AuditLogPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </HotelProvider>
      </AuthProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
