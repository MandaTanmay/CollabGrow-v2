const { supabase } = require('../database.js');

async function getUserById(id) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, username, full_name, bio, profile_image_url, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function listUsers({ limit = 20, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, username, full_name, bio, profile_image_url, created_at, updated_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data;
}

async function createUser({ firebaseUid, email, fullName, username, bio, university }) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      firebase_uid: firebaseUid,
      email,
      full_name: fullName,
      username,
      bio,
      university
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getUserByFirebaseUid(firebaseUid) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getUserStats(id) {
  const [activeResult, completedResult, totalResult, collaboratorsResult] = await Promise.all([
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', id)
      .in('status', ['recruiting', 'active']),
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', id)
      .eq('status', 'completed'),
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', id),
    supabase
      .from('project_collaborators')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id),
  ]);
  return {
    active_projects: activeResult.count || 0,
    completed_projects: completedResult.count || 0,
    total_projects: totalResult.count || 0,
    collaborators_count: collaboratorsResult.count || 0,
  };
}

module.exports = {
  getUserById,
  listUsers,
  createUser,
  getUserByFirebaseUid,
  getUserStats
};
