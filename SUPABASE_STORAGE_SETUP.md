# Supabase Storage Setup Guide

If you're seeing "Bucket not found" errors, you need to create the required storage buckets in your Supabase project.

## Required Buckets

This application requires two storage buckets:

1. **profile-images** - For user profile pictures
2. **project-resources** - For project files and resources

## Setup Instructions

### 1. Access Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in to your account
3. Select your project

### 2. Create Storage Buckets

#### Create `profile-images` bucket:

1. Click on **Storage** in the left sidebar
2. Click **New bucket**
3. Enter bucket name: `profile-images`
4. **Enable "Public bucket"** (important!)
5. Click **Create bucket**
6. Click on the bucket, then go to **Policies**
7. Add TWO policies:

   **Policy 1: Public Read Access**
   - Click **New policy**
   - Select **For full customization**
   - Policy name: `Public Read Access`
   - Allowed operations: Check **SELECT** only
   - Target roles: Select **public**
   - USING expression: `true`
   - Click **Review** then **Save policy**

   **Policy 2: Authenticated Upload Access**
   - Click **New policy** again
   - Select **For full customization**
   - Policy name: `Authenticated Upload`
   - Allowed operations: Check **INSERT** and **UPDATE**
   - Target roles: Select **authenticated**
   - WITH CHECK expression: `true`
   - Click **Review** then **Save policy**

   **Policy 3: Authenticated Delete Access** (optional, for cleanup)
   - Click **New policy**
   - Select **For full customization**
   - Policy name: `Authenticated Delete`
   - Allowed operations: Check **DELETE**
   - Target roles: Select **authenticated**
   - USING expression: `true`
   - Click **Review** then **Save policy**

#### Create `project-resources` bucket:

1. Click **New bucket** again
2. Enter bucket name: `project-resources`
3. **Enable "Public bucket"** (important!)
4. Click **Create bucket**
5. Click on the bucket, then go to **Policies**
6. Add the same THREE policies as above (Public Read, Authenticated Upload, Authenticated Delete)

### 3. Verify Setup

After creating the buckets:

1. Refresh your application
2. Try uploading a profile picture
3. Try uploading a file in a project workspace

## Troubleshooting

### "Bucket not found" error persists

- Make sure both buckets are created with exact names: `profile-images` and `project-resources`
- Verify your Supabase credentials in `.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
  ```
- Restart your development server after creating buckets

### Images not loading

- Ensure buckets are marked as **Public**
- Check the policies allow public `SELECT` operations
- Verify the URLs are being generated correctly in browser console

### Upload fails with "unauthorized" or "violates row-level security policy"

This means your bucket exists but doesn't have the correct upload policies:

1. Go to **Storage** > Select your bucket > **Policies**
2. Make sure you have these policies:
   - **Public Read**: Operation `SELECT`, Role `public`, Expression `true`
   - **Authenticated Upload**: Operations `INSERT` + `UPDATE`, Role `authenticated`, Expression `true`
   - **Authenticated Delete**: Operation `DELETE`, Role `authenticated`, Expression `true`
3. If policies are missing, add them using the instructions above
4. **Important**: Make sure to select the **authenticated** role (not public) for upload/insert operations
5. The WITH CHECK expression should be `true` for INSERT and UPDATE operations

### Quick Fix for RLS Policy Errors

If you see "violates row-level security policy":
1. Delete the bucket's existing policies
2. Click **New Policy** > **Get started quickly**
3. Select "Allow public read access" template
4. Click **New Policy** again > **For full customization**
5. Add authenticated insert/update policy as shown above

### Advanced: Using SQL to Create Policies

Run this SQL in your Supabase SQL Editor:

```sql
-- Profile Images Bucket Policies
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profile-images');

CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-images');

CREATE POLICY "Authenticated users can update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-images');

CREATE POLICY "Authenticated users can delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile-images');

-- Project Resources Bucket Policies
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'project-resources');

CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-resources');

CREATE POLICY "Authenticated users can update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'project-resources');

CREATE POLICY "Authenticated users can delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-resources');
```

## Alternative: Quick Setup Script

If you have Supabase CLI installed, you can run:

```bash
# Create buckets via CLI
supabase storage create profile-images --public
supabase storage create project-resources --public
```

## Need Help?

If you continue experiencing issues:
1. Check Supabase Dashboard > Storage > Policies
2. Verify bucket names match exactly
3. Ensure public access is enabled
4. Check browser console for detailed error messages
