// Custom types for the application

export type AccountStatus = 'pending' | 'approved' | 'inactive';
export type ReceiptStatus = 'new' | 'reviewed' | 'invoiced' | 'archived';
export type AppRole = 'admin' | 'client';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  original_filename: string;
  storage_path: string;
  expense_date: string;
  status: ReceiptStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Extended receipt with profile info for admin views
export interface ReceiptWithProfile extends Receipt {
  profiles?: {
    full_name: string;
  };
}

// Profile with user info for admin views
export interface ProfileWithEmail extends Profile {
  email?: string;
}
