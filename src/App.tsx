import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";

// Auth pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import PendingApproval from "./pages/PendingApproval";
import AccountInactive from "./pages/AccountInactive";

// Client pages
import MyReceipts from "@/features/receipts/pages/MyReceipts";
import UploadReceipt from "@/features/receipts/pages/UploadReceipt";

// Admin pages
import AdminDashboard from "@/features/admin/pages/AdminDashboard";
import AdminReceipts from "@/features/admin/pages/AdminReceipts";
import AdminClients from "@/features/admin/pages/AdminClients";

// Invoicing pages
import InvoiceList   from "@/features/invoicing/pages/InvoiceList";
import CreateInvoice from "@/features/invoicing/pages/CreateInvoice";

// Other
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s antes de considerar datos desactualizados
      gcTime: 5 * 60_000,      // 5 min en caché tras desmontar el componente
      retry: 1,                // Solo 1 reintento en caso de error
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Pending/Inactive pages */}
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/account-inactive" element={<AccountInactive />} />
            
            {/* Index - redirects based on role */}
            <Route path="/" element={<Index />} />
            
            {/* Client routes */}
            <Route
              path="/my-receipts"
              element={
                <ProtectedRoute requireApproved>
                  <MyReceipts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/upload"
              element={
                <ProtectedRoute requireApproved>
                  <UploadReceipt />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/receipts"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminReceipts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/clients"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminClients />
                </ProtectedRoute>
              }
            />
            
            {/* Invoice routes */}
            <Route
              path="/invoices"
              element={
                <ProtectedRoute requireApproved>
                  <InvoiceList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices/new"
              element={
                <ProtectedRoute requireApproved>
                  <CreateInvoice />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
