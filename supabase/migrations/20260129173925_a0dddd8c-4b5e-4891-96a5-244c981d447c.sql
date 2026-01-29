-- =============================================================================
-- GESTOR DE RECIBOS - DATABASE SCHEMA
-- =============================================================================

-- 1. ENUMS
-- =============================================================================

-- Account status enum
CREATE TYPE public.account_status AS ENUM ('pending', 'approved', 'inactive');

-- Receipt status enum
CREATE TYPE public.receipt_status AS ENUM ('new', 'reviewed', 'invoiced', 'archived');

-- App role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'client');

-- 2. TABLES
-- =============================================================================

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    account_status public.account_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (separated from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL DEFAULT 'client',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Receipts table
CREATE TABLE public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    expense_date DATE NOT NULL,
    status public.receipt_status NOT NULL DEFAULT 'new',
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. INDEXES
-- =============================================================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_account_status ON public.profiles(account_status);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX idx_receipts_status ON public.receipts(status);
CREATE INDEX idx_receipts_expense_date ON public.receipts(expense_date);
CREATE INDEX idx_receipts_created_at ON public.receipts(created_at);

-- 4. HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================================================

-- Check if user has admin role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = 'admin'
    )
$$;

-- Check if user is an approved client
CREATE OR REPLACE FUNCTION public.is_approved(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = _user_id
          AND account_status = 'approved'
    )
$$;

-- Check if current user can access resource (is owner or admin)
CREATE OR REPLACE FUNCTION public.can_access_receipt(_receipt_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        public.is_admin(auth.uid()) 
        OR (
            auth.uid() = _receipt_user_id 
            AND public.is_approved(auth.uid())
        )
$$;

-- 5. ENABLE RLS
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES FOR PROFILES
-- =============================================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Admins can update any profile (for approval/deactivation)
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- 7. RLS POLICIES FOR USER_ROLES
-- =============================================================================

-- Only admins can read roles
CREATE POLICY "Admins can read roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Only admins can insert roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Only admins can update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Only admins can delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 8. RLS POLICIES FOR RECEIPTS
-- =============================================================================

-- Approved clients can read their own receipts
CREATE POLICY "Approved clients can read own receipts"
ON public.receipts
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id 
    AND public.is_approved(auth.uid())
);

-- Admins can read all receipts
CREATE POLICY "Admins can read all receipts"
ON public.receipts
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Approved clients can insert their own receipts
CREATE POLICY "Approved clients can insert own receipts"
ON public.receipts
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id 
    AND public.is_approved(auth.uid())
);

-- Admins can insert receipts for any user
CREATE POLICY "Admins can insert receipts"
ON public.receipts
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Approved clients can update their own receipts (limited fields via app logic)
CREATE POLICY "Approved clients can update own receipts"
ON public.receipts
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id 
    AND public.is_approved(auth.uid())
)
WITH CHECK (
    auth.uid() = user_id 
    AND public.is_approved(auth.uid())
);

-- Admins can update any receipt
CREATE POLICY "Admins can update receipts"
ON public.receipts
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Approved clients can delete their own receipts
CREATE POLICY "Approved clients can delete own receipts"
ON public.receipts
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id 
    AND public.is_approved(auth.uid())
);

-- Admins can delete any receipt
CREATE POLICY "Admins can delete receipts"
ON public.receipts
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- 9. STORAGE BUCKET
-- =============================================================================

-- Create private bucket for receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    false,
    20971520, -- 20MB limit
    ARRAY['application/pdf']
);

-- Storage policies for receipts bucket
-- Approved clients can upload to their own folder
CREATE POLICY "Approved clients can upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'receipts'
    AND public.is_approved(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can upload to any folder
CREATE POLICY "Admins can upload any receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'receipts'
    AND public.is_admin(auth.uid())
);

-- Approved clients can read their own files
CREATE POLICY "Approved clients can read own receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'receipts'
    AND public.is_approved(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can read all files
CREATE POLICY "Admins can read all receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'receipts'
    AND public.is_admin(auth.uid())
);

-- Approved clients can delete their own files
CREATE POLICY "Approved clients can delete own receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'receipts'
    AND public.is_approved(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can delete any file
CREATE POLICY "Admins can delete any receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'receipts'
    AND public.is_admin(auth.uid())
);

-- 10. TRIGGERS FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at
    BEFORE UPDATE ON public.receipts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 11. TRIGGER TO AUTO-CREATE PROFILE ON SIGNUP
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, account_status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'pending'
    );
    
    -- Assign default client role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'client');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();