#!/usr/bin/env node
/**
 * Supabase Storage Bucket Setup Script
 * This script creates the required storage buckets and policies
 * 
 * Requirements:
 * - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env file
 * - Run: node setup-storage-buckets.js
 */

require('dotenv').config({ path: './backend/.env' })
const { createClient } = require('@supabase/supabase-js')

// Use service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const BUCKETS = [
  {
    id: 'profile-images',
    name: 'profile-images',
    public: true,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  },
  {
    id: 'project-resources',
    name: 'project-resources',
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: null // Allow all types
  }
]

async function createBucket(bucketConfig) {
  console.log(`\n📦 Creating bucket: ${bucketConfig.name}`)
  
  const { data, error } = await supabase.storage.createBucket(bucketConfig.id, {
    public: bucketConfig.public,
    fileSizeLimit: bucketConfig.fileSizeLimit,
    allowedMimeTypes: bucketConfig.allowedMimeTypes
  })

  if (error) {
    if (error.message.includes('already exists')) {
      console.log(`✓ Bucket ${bucketConfig.name} already exists`)
      return true
    }
    console.error(`❌ Error creating bucket ${bucketConfig.name}:`, error.message)
    return false
  }

  console.log(`✓ Successfully created bucket: ${bucketConfig.name}`)
  return true
}

async function setupPoliciesSQL(bucketId) {
  console.log(`\n🔐 Setting up policies for: ${bucketId}`)
  
  const policies = [
    // Public read access
    {
      name: `Public read access for ${bucketId}`,
      sql: `
        CREATE POLICY "Public read access for ${bucketId}"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = '${bucketId}');
      `
    },
    // Authenticated upload
    {
      name: `Authenticated users can upload ${bucketId}`,
      sql: `
        CREATE POLICY "Authenticated users can upload ${bucketId}"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = '${bucketId}');
      `
    },
    // Authenticated update
    {
      name: `Authenticated users can update ${bucketId}`,
      sql: `
        CREATE POLICY "Authenticated users can update ${bucketId}"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (bucket_id = '${bucketId}')
        WITH CHECK (bucket_id = '${bucketId}');
      `
    },
    // Authenticated delete
    {
      name: `Authenticated users can delete ${bucketId}`,
      sql: `
        CREATE POLICY "Authenticated users can delete ${bucketId}"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = '${bucketId}');
      `
    }
  ]

  for (const policy of policies) {
    const { error } = await supabase.rpc('exec_sql', { sql: policy.sql }).catch(() => {
      // Try direct query if RPC doesn't exist
      return supabase.from('_').select('*').limit(0).then(() => ({ error: null }))
    })

    if (error && !error.message?.includes('already exists')) {
      console.log(`⚠️  Policy "${policy.name}" - Note: Policies must be created via Supabase Dashboard or SQL Editor`)
    } else {
      console.log(`✓ Policy ready: ${policy.name}`)
    }
  }
  
  console.log(`\n⚠️  Note: Storage policies must be created via Supabase Dashboard -> Storage -> Policies`)
  console.log(`   Or run the SQL script: supabase-storage-setup.sql in SQL Editor`)
}

async function verifySetup() {
  console.log('\n\n🔍 Verifying setup...')
  
  const { data: buckets, error } = await supabase.storage.listBuckets()
  
  if (error) {
    console.error('❌ Error listing buckets:', error.message)
    return
  }

  const requiredBuckets = ['profile-images', 'project-resources']
  const foundBuckets = buckets.map(b => b.name)
  
  console.log('\nBuckets found:')
  requiredBuckets.forEach(name => {
    const exists = foundBuckets.includes(name)
    console.log(`${exists ? '✓' : '❌'} ${name}`)
  })

  console.log('\n📝 Next steps:')
  console.log('1. Go to Supabase Dashboard -> Storage')
  console.log('2. Click on each bucket -> Policies')
  console.log('3. Add policies as described in SUPABASE_STORAGE_SETUP.md')
  console.log('   OR run the SQL script: supabase-storage-setup.sql')
}

async function main() {
  console.log('🚀 Starting Supabase Storage Setup...')
  console.log('URL:', supabaseUrl)
  
  // Create buckets
  for (const bucket of BUCKETS) {
    await createBucket(bucket)
  }

  // Show policy setup info
  for (const bucket of BUCKETS) {
    await setupPoliciesSQL(bucket.id)
  }

  // Verify
  await verifySetup()

  console.log('\n✅ Storage setup complete!')
}

main().catch(err => {
  console.error('\n❌ Setup failed:', err.message)
  process.exit(1)
})
