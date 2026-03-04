const { query } = require('./db');

async function getProjectById(id) {
  const result = await query(
    `SELECT * FROM projects WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

async function listProjects({ limit = 20, offset = 0 } = {}) {
  const result = await query(
    `SELECT * FROM projects ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

async function createProject({
  title,
  description,
  detailed_description,
  category,
  creator_id,
  status = 'recruiting',
  difficulty_level,
  estimated_duration,
  max_collaborators,
  project_type,
  repository_url,
  demo_url,
  is_featured = false,
  is_public = true,
  is_remote = true,
  location
}) {
  const result = await query(
    `INSERT INTO projects
      (title, description, detailed_description, category, creator_id, status, difficulty_level, estimated_duration, max_collaborators, project_type, repository_url, demo_url, is_featured, is_public, is_remote, location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING *`,
    [title, description, detailed_description, category, creator_id, status, difficulty_level, estimated_duration, max_collaborators, project_type, repository_url, demo_url, is_featured, is_public, is_remote, location]
  );
  return result.rows[0];
}

// Assign a task to a user in a project
async function assignTaskToUser({ project_id, assigned_to, title, description, due_date, priority = 'medium' }) {
  const result = await query(
    `INSERT INTO project_tasks (project_id, assigned_to, title, description, due_date, priority)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [project_id, assigned_to, title, description, due_date, priority]
  );
  return result.rows[0];
}

// Update a task's due date or description
async function updateTask({ task_id, description, due_date }) {
  const result = await query(
    `UPDATE project_tasks SET description = COALESCE($2, description), due_date = COALESCE($3, due_date), updated_at = now() WHERE id = $1 RETURNING *`,
    [task_id, description, due_date]
  );
  return result.rows[0];
}

module.exports = {
  getProjectById,
  listProjects,
  createProject,
  assignSkillsToProject,
  applyToProject,
  updateProjectApplication,
  incrementProjectViews,
  completeProject,
  assignTaskToUser,
  updateTask
};

// Apply to project (creates collaboration request)
async function applyToProject({ project_id, user_id, message }) {
  // Check if already applied
  const existing = await query(
    'SELECT id FROM collaboration_requests WHERE project_id = $1 AND requester_id = $2 AND status = $3',
    [project_id, user_id, 'pending']
  );
  if (existing.rows.length > 0) {
    throw new Error('You have already applied to this project');
  }
  
  const result = await query(
    'INSERT INTO collaboration_requests (project_id, requester_id, message, status) VALUES ($1, $2, $3, $4) RETURNING *',
    [project_id, user_id, message || null, 'pending']
  );
  return result.rows[0];
}

// Update project application status (accept or decline)
async function updateProjectApplication({ application_id, action, owner_id }) {
  const status = action === 'accept' ? 'accepted' : 'rejected';
  
  // Get the application details first
  const appResult = await query(
    'SELECT * FROM collaboration_requests WHERE id = $1',
    [application_id]
  );
  if (appResult.rows.length === 0) {
    throw new Error('Application not found');
  }
  
  const application = appResult.rows[0];
  
  // If accepting, add to project_collaborators
  if (action === 'accept') {
    await query(
      'INSERT INTO project_collaborators (project_id, user_id, status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [application.project_id, application.requester_id, 'Active']
    );
  }
  
  // Update application status
  const result = await query(
    'UPDATE collaboration_requests SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [status, application_id]
  );
  return result.rows[0];
}

// Assign skills to a project (creates skills if not exist, links in project_skills)
async function assignSkillsToProject(projectId, skillNames) {
  if (!Array.isArray(skillNames) || skillNames.length === 0) return;
  for (const name of skillNames) {
    // 1. Find or create skill
    let skillRes = await query('SELECT id FROM skills WHERE name = $1', [name]);
    let skillId;
    if (skillRes.rows.length > 0) {
      skillId = skillRes.rows[0].id;
    } else {
      const insertRes = await query('INSERT INTO skills (name) VALUES ($1) RETURNING id', [name]);
      skillId = insertRes.rows[0].id;
    }
    // 2. Link to project_skills
    await query('INSERT INTO project_skills (project_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [projectId, skillId]);
  }
}

// Increment project view count
async function incrementProjectViews(projectId) {
  const result = await query(
    'UPDATE projects SET views_count = views_count + 1 WHERE id = $1 RETURNING views_count',
    [projectId]
  );
  return result.rows[0]?.views_count || 0;
}

// Complete a project
async function completeProject({ project_id, user_id }) {
  // Verify user is the project owner
  const projectResult = await query(
    'SELECT creator_id FROM projects WHERE id = $1',
    [project_id]
  );
  if (projectResult.rows.length === 0) {
    throw new Error('Project not found');
  }
  if (projectResult.rows[0].creator_id !== user_id) {
    throw new Error('Only the project owner can complete a project');
  }
  
  const result = await query(
    'UPDATE projects SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
    ['completed', project_id]
  );
  return result.rows[0];
}
