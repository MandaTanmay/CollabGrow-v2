-- =====================================================
-- Supabase Storage Buckets Setup Script
-- =====================================================
-- Run this in your Supabase SQL Editor to create storage buckets and policies
-- Dashboard -> SQL Editor -> New Query -> Paste this script -> Run

-- 1. Create profile-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create project-resources bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-resources', 'project-resources', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Storage Policies for profile-images bucket
-- =====================================================

-- Allow public read access for profile images
CREATE POLICY "Public read access for profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- Allow authenticated users to upload profile images
CREATE POLICY "Authenticated users can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-images');

-- Allow authenticated users to update their profile images
CREATE POLICY "Authenticated users can update profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-images')
WITH CHECK (bucket_id = 'profile-images');

-- Allow authenticated users to delete their profile images
CREATE POLICY "Authenticated users can delete profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-images');

-- =====================================================
-- Storage Policies for project-resources bucket
-- =====================================================

-- Allow public read access for project resources
CREATE POLICY "Public read access for project resources"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'project-resources');

-- Allow authenticated users to upload project resources
CREATE POLICY "Authenticated users can upload project resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-resources');

-- Allow authenticated users to update project resources
CREATE POLICY "Authenticated users can update project resources"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-resources')
WITH CHECK (bucket_id = 'project-resources');

-- Allow authenticated users to delete project resources
CREATE POLICY "Authenticated users can delete project resources"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-resources');

-- =====================================================
-- Verify Setup
-- =====================================================

-- Check if buckets are created
SELECT id, name, public, created_at
FROM storage.buckets
WHERE id IN ('profile-images', 'project-resources');

-- Check policies
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
ORDER BY policyname;
