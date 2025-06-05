import { createClient } from '@/lib/supabase/server'
import PostsPageClient from './posts-page-client'

async function getCloudPhones() {
  const supabase = await createClient()
  
  // Get all accounts with their phone details
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false })
    
  // Get phone details separately to avoid join issues
  const accountIds = accounts?.map(a => a.id) || []
  const { data: phones } = await supabase
    .from('phones')
    .select('*')
    .in('account_id', accountIds)
    
  // Merge phone data with accounts
  const accountsWithPhones = accounts?.map(account => ({
    ...account,
    phone: phones?.find(p => p.account_id === account.id)
  })) || []

  return accountsWithPhones
}

async function getRecentPosts() {
  const supabase = await createClient()
  
  // Get recent posts for display
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      *,
      account:accounts!fk_account(
        id,
        tiktok_username,
        geelark_profile_id
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  return posts || []
}

export default async function PostsPage() {
  const [cloudPhones, recentPosts] = await Promise.all([
    getCloudPhones(),
    getRecentPosts()
  ])

  return <PostsPageClient cloudPhones={cloudPhones} recentPosts={recentPosts} />
}