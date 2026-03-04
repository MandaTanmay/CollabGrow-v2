import { createClient } from "@supabase/supabase-js"

// Initialize Supabase client for frontend
// This is used for real-time subscriptions and client-side operations
// For data operations, use the API client instead (@/lib/api)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.warn("Missing Supabase environment variables. Real-time features may not work.")
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
)

// Add global error handler for storage errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes?.('Bucket not found')) {
      console.warn('⚠️ Storage bucket not found. Please create required buckets in Supabase Dashboard:')
      console.warn('  1. profile-images (public)')
      console.warn('  2. project-resources (public)')
      event.preventDefault() // Prevent the error from crashing the app
    }
  })
}

// Helper function to execute raw SQL queries (for compatibility)
export async function executeQuery(query: string, params?: any[]) {
  try {
    const { data, error } = await supabase.rpc('execute_sql', { 
      query_text: query,
      query_params: params 
    })
    
    if (error) throw error
    return { rows: data }
  } catch (error) {
    console.error("❌ Query Error:", error)
    throw error
  }
}

