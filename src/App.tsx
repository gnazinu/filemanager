import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Auth pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import PendingApproval from "./pages/PendingApproval";
import AccountInactive from "./pages/AccountInactive";

// Client pages
import MyReceipts from "./pages/client/MyReceipts";
import UploadReceipt from "./pages/client/UploadReceipt";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminReceipts from "./pages/admin/AdminReceipts";
import AdminClients from "./pages/admin/AdminClients";

// Other
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";

const queryClient = new QueryClient();

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
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
