-- PROJECT CHAT MESSAGES
create table if not exists project_chat_messages (
  id serial primary key,
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  user_name text,
  user_logo text,
  content text not null,
  timestamp timestamptz default now(),
  is_system boolean default false
);

create index if not exists idx_project_chat_messages_project on project_chat_messages(project_id);
create index if not exists idx_project_chat_messages_system on project_chat_messages(is_system);
-- USERS
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique,
  email text unique not null,
  full_name text,
  username text unique,
  bio text,
  university text,
  major text,
  skills text[],
  profile_image_url text,
  followers_count int default 0,
  following_count int default 0,
  reputation_points int default 0,
  profile_views int default 0,
  saved_posts uuid[],
  is_active boolean default true,
  is_public boolean default true,
  created_at timestamptz default now()
);

-- PROJECTS
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references users(id) on delete set null,
  title text not null,
  description text,
  detailed_description text,
  category text,
  status text default 'recruiting', -- recruiting, active, completed
  difficulty_level text,
  estimated_duration text,
  max_collaborators int,
  project_type text,
  repository_url text,
  demo_url text,
  is_featured boolean default false,
  is_public boolean default true,
  is_remote boolean default true,
  location text,
  collaborators_count int default 0,
  likes_count int default 0,
  comments_count int default 0,
  views_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- PROJECT COLLABORATORS
create table if not exists project_collaborators (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text,
  status text default 'Active',
  joined_at timestamptz default now(),
  contribution_description text
);

-- COLLABORATION REQUESTS
create table if not exists collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  requester_id uuid references users(id) on delete cascade,
  message text,
  status text default 'pending', -- pending, accepted, rejected
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- PROJECT RESOURCES
create table if not exists project_resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  uploader_id uuid references users(id) on delete set null,
  resource_name text not null,
  resource_type text,
  resource_url text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- PROJECT TASKS
create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  assigned_to uuid references users(id) on delete set null,
  title text not null,
  description text,
  status text default 'todo', -- todo, in_progress, done
  priority text default 'medium', -- low, medium, high
  due_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- SKILLS
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  category text
);

-- PROJECT SKILLS
create table if not exists project_skills (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade
);

-- USER SKILLS
create table if not exists user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade
);

-- POSTS
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  content text,
  post_type text default 'general',
  related_project_id uuid references projects(id) on delete set null,
  media_urls text[],
  tags text[],
  likes_count int default 0,
  comments_count int default 0,
  visibility text default 'public',
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- POST LIKES
create table if not exists post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

-- POST COMMENTS
create table if not exists post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  content text,
  parent_comment_id uuid references post_comments(id) on delete cascade,
  created_at timestamptz default now()
);

-- PROJECT LIKES
create table if not exists project_likes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (project_id, user_id)
);

-- NOTIFICATIONS
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references users(id) on delete set null,
  recipient_id uuid references users(id) on delete cascade,
  type text,
  title text,
  message text,
  priority text default 'medium',
  related_project_id uuid references projects(id) on delete set null,
  related_entity_id uuid,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- USER NOTIFICATIONS SETTINGS
create table if not exists user_notifications (
  user_id uuid primary key references users(id) on delete cascade,
  email_notifications boolean default true,
  push_notifications boolean default true,
  created_at timestamptz default now()
);

-- USER PRIVACY SETTINGS
create table if not exists user_privacy (
  user_id uuid primary key references users(id) on delete cascade,
  profile_visibility text default 'public',
  searchable boolean default true,
  created_at timestamptz default now()
);

-- ACTIVITIES
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text,
  details jsonb,
  is_public boolean default true,
  created_at timestamptz default now()
);

-- CONNECTIONS (Followers/Following)
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references users(id) on delete cascade,
  following_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (follower_id, following_id)
);

-- ADD MISSING COLUMNS TO USERS TABLE (if not already present)
alter table if exists users add column if not exists github_username text unique;
alter table if exists users add column if not exists linkedin_url text;
alter table if exists users add column if not exists location text;
alter table if exists users add column if not exists portfolio_url text;
alter table if exists users add column if not exists updated_at timestamptz default now();

-- INDEXES for performance
create index if not exists idx_projects_creator on projects(creator_id);
create index if not exists idx_posts_user on posts(user_id);
create index if not exists idx_post_likes_post on post_likes(post_id);
create index if not exists idx_post_likes_user on post_likes(user_id);
create index if not exists idx_project_likes_project on project_likes(project_id);
create index if not exists idx_project_likes_user on project_likes(user_id);
create index if not exists idx_notifications_recipient on notifications(recipient_id);
create index if not exists idx_users_created_at on users(created_at);
create index if not exists idx_projects_created_at on projects(created_at);
create index if not exists idx_posts_created_at on posts(created_at);
create index if not exists idx_activities_created_at on activities(created_at);
create index if not exists idx_connections_follower on connections(follower_id);
create index if not exists idx_connections_following on connections(following_id);

-- Enable Row Level Security (RLS) for user-specific tables
alter table users enable row level security;
alter table user_notifications enable row level security;
alter table user_privacy enable row level security;

-- RLS: Allow users to access/modify their own rows (full access)
drop policy if exists "Users can access own data" on users;
create policy "Users can access own data" on users
  for select using (true);

drop policy if exists "Users can update own data" on users;
create policy "Users can update own data" on users
  for update using (true) with check (true);

drop policy if exists "Users can insert own data" on users;
create policy "Users can insert own data" on users
  for insert with check (true);

drop policy if exists "Users can access own notifications" on user_notifications;
create policy "Users can access own notifications" on user_notifications
  for all using (auth.uid()::uuid = user_id);
drop policy if exists "Users can access own privacy" on user_privacy;
create policy "Users can access own privacy" on user_privacy
  for all using (auth.uid()::uuid = user_id);

-- RLS: Only allow users to access/modify their own activities
alter table activities enable row level security;
drop policy if exists "Users can access own activities" on activities;
create policy "Users can access own activities" on activities
  for all using (auth.uid()::uuid = user_id);

-- RLS: Only allow users to access/modify their own posts
alter table posts enable row level security;
drop policy if exists "Users can access own posts" on posts;
create policy "Users can access own posts" on posts
  for all using (auth.uid()::uuid = user_id);

-- RLS: Only allow users to access/modify their own projects (if needed)
alter table projects enable row level security;
drop policy if exists "Users can access own projects" on projects;
create policy "Users can access own projects" on projects
  for all using (auth.uid()::uuid = creator_id);

-- RLS: Only allow users to access/modify their own connections
alter table connections enable row level security;
drop policy if exists "Users can access own connections" on connections;
create policy "Users can access own connections" on connections
  for all using (auth.uid()::uuid = follower_id or auth.uid()::uuid = following_id);

-- TRIGGERS & FUNCTIONS
-- Auto-update project likes_count
create or replace function update_project_likes_count() returns trigger as $$
begin
  update projects set likes_count = (select count(*) from project_likes where project_id = new.project_id)
  where id = new.project_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_project_likes on project_likes;
create trigger trg_update_project_likes
  after insert or delete on project_likes
  for each row execute procedure update_project_likes_count();

-- Auto-update post likes_count
create or replace function update_post_likes_count() returns trigger as $$
begin
  update posts set likes_count = (select count(*) from post_likes where post_id = new.post_id)
  where id = new.post_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_post_likes on post_likes;
create trigger trg_update_post_likes
  after insert or delete on post_likes
  for each row execute procedure update_post_likes_count();

-- Auto-update post comments_count
create or replace function update_post_comments_count() returns trigger as $$
begin
  update posts set comments_count = (select count(*) from post_comments where post_id = new.post_id)
  where id = new.post_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_post_comments on post_comments;
create trigger trg_update_post_comments
  after insert or delete on post_comments
  for each row execute procedure update_post_comments_count();

-- TRIGGER: Update followers_count and following_count on follow/unfollow
create or replace function update_follow_counts() returns trigger as $$
begin
  update users set followers_count = (select count(*) from connections where following_id = new.following_id)
    where id = new.following_id;
  update users set following_count = (select count(*) from connections where follower_id = new.follower_id)
    where id = new.follower_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_follow_counts on connections;
create trigger trg_update_follow_counts
  after insert or delete on connections
  for each row execute procedure update_follow_counts();

-- TRIGGER: Log activity on new post
create or replace function log_post_activity() returns trigger as $$
begin
  insert into activities(user_id, type, details, is_public)
    values (new.user_id, 'post_created', jsonb_build_object('post_id', new.id), true);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_log_post_activity on posts;
create trigger trg_log_post_activity
  after insert on posts
  for each row execute procedure log_post_activity();

-- TRIGGER: Log activity on new project
create or replace function log_project_activity() returns trigger as $$
begin
  insert into activities(user_id, type, details, is_public)
    values (new.creator_id, 'project_created', jsonb_build_object('project_id', new.id), true);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_log_project_activity on projects;
create trigger trg_log_project_activity
  after insert on projects
  for each row execute procedure log_project_activity();

-- TRIGGER: Mark notifications as read when user fetches them (optional, for advanced use)
-- You may want to do this in application code instead for more control.

-- AUTO-UPDATE TIMESTAMPS for tables with updated_at column
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_project_resources_timestamp on project_resources;
create trigger trg_update_project_resources_timestamp
  before update on project_resources
  for each row execute procedure update_updated_at_column();

drop trigger if exists trg_update_project_tasks_timestamp on project_tasks;
create trigger trg_update_project_tasks_timestamp
  before update on project_tasks
  for each row execute procedure update_updated_at_column();

drop trigger if exists trg_update_collaboration_requests_timestamp on collaboration_requests;
create trigger trg_update_collaboration_requests_timestamp
  before update on collaboration_requests
  for each row execute procedure update_updated_at_column();

drop trigger if exists trg_update_posts_timestamp on posts;
create trigger trg_update_posts_timestamp
  before update on posts
  for each row execute procedure update_updated_at_column();

-- UPDATE PROJECT COLLABORATORS COUNT
create or replace function update_project_collaborators_count() returns trigger as $$
begin
  update projects set collaborators_count = (
    select count(*) from project_collaborators 
    where project_id = coalesce(new.project_id, old.project_id)
    and status = 'Active'
  ) where id = coalesce(new.project_id, old.project_id);
  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists trg_update_project_collaborators_count on project_collaborators;
create trigger trg_update_project_collaborators_count
  after insert or delete or update on project_collaborators
  for each row execute procedure update_project_collaborators_count();

-- UPDATE PROJECT COMMENTS COUNT (from project resources)
create or replace function update_project_comments_count() returns trigger as $$
begin
  update projects set comments_count = (
    select count(*) from post_comments pc
    inner join posts p on pc.post_id = p.id
    where p.related_project_id = coalesce(new.id, old.id)
  ) where id = coalesce(new.id, old.id);
  return coalesce(new, old);
end;
$$ language plpgsql;

-- UPDATE PROFILE VIEWS COUNT
create or replace function update_profile_views() returns trigger as $$
begin
  if new.user_id is not null then
    update users set profile_views = profile_views + 1 where id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_profile_views on activities;
create trigger trg_update_profile_views
  after insert on activities
  for each row
  when (new.type = 'profile_viewed')
  execute procedure update_profile_views();

-- AUTO-INCREMENT REPUTATION POINTS based on activity
create or replace function update_user_reputation() returns trigger as $$
begin
  -- Award points for post creation
  if new.type = 'post_created' then
    update users set reputation_points = reputation_points + 5 where id = new.user_id;
  -- Award points for project creation
  elsif new.type = 'project_created' then
    update users set reputation_points = reputation_points + 20 where id = new.user_id;
  -- Award points for collaboration
  elsif new.type = 'collaboration_joined' then
    update users set reputation_points = reputation_points + 15 where id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_update_reputation on activities;
create trigger trg_update_reputation
  after insert on activities
  for each row execute procedure update_user_reputation();

-- LOG COLLABORATION REQUEST ACTIVITY
create or replace function log_collaboration_request() returns trigger as $$
begin
  if new.status = 'accepted' then
    insert into activities(user_id, type, details, is_public)
    values (new.requester_id, 'collaboration_joined', 
            jsonb_build_object('project_id', new.project_id), true);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_log_collaboration_request on collaboration_requests;
create trigger trg_log_collaboration_request
  after update on collaboration_requests
  for each row execute procedure log_collaboration_request();

-- VALIDATE COLLABORATION REQUEST BEFORE INSERT
create or replace function validate_collaboration_request() returns trigger as $$
begin
  -- Prevent duplicate pending requests
  if exists (
    select 1 from collaboration_requests 
    where project_id = new.project_id 
    and requester_id = new.requester_id 
    and status = 'pending'
  ) then
    raise exception 'Pending collaboration request already exists for this user and project';
  end if;
  
  -- Prevent self-collaboration requests
  if exists (
    select 1 from projects 
    where id = new.project_id and creator_id = new.requester_id
  ) then
    raise exception 'Cannot request collaboration on your own project';
  end if;
  
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_validate_collaboration_request on collaboration_requests;
create trigger trg_validate_collaboration_request
  before insert on collaboration_requests
  for each row execute procedure validate_collaboration_request();

-- CLEANUP FUNCTION for old notifications (call periodically)
create or replace function cleanup_old_notifications(days_old int default 90)
returns void as $$
begin
  delete from notifications 
  where is_read = true and created_at < now() - interval '1 day' * days_old;
end;
$$ language plpgsql;

-- CLEANUP FUNCTION for old activities (call periodically)
create or replace function cleanup_old_activities(days_old int default 365)
returns void as $$
begin
  delete from activities 
  where created_at < now() - interval '1 day' * days_old;
end;
$$ language plpgsql;

-- GET USER PROJECTS COUNT (cached)
create or replace function get_user_project_count(user_id uuid)
returns int as $$
  select count(*)::int from projects where creator_id = user_id;
$$ language sql stable;

-- GET USER COLLABORATIONS COUNT
create or replace function get_user_collaborations_count(user_id uuid)
returns int as $$
  select count(distinct project_id)::int from project_collaborators where user_id = user_id;
$$ language sql stable;

-- CHECK IF USER CAN COLLABORATE ON PROJECT
create or replace function can_user_collaborate(p_user_id uuid, p_project_id uuid)
returns boolean as $$
declare
  max_collaborators int;
  current_collaborators int;
begin
  select projects.max_collaborators into max_collaborators 
  from projects where id = p_project_id;
  
  if max_collaborators is null then
    return true;
  end if;
  
  select count(*) into current_collaborators 
  from project_collaborators where project_id = p_project_id;
  
  return current_collaborators < max_collaborators;
end;
$$ language plpgsql stable;

-- ADDITIONAL INDEXES for optimization
create index if not exists idx_project_collaborators_project on project_collaborators(project_id);
create index if not exists idx_project_collaborators_user on project_collaborators(user_id);
create index if not exists idx_collaboration_requests_status on collaboration_requests(status);
create index if not exists idx_project_tasks_status on project_tasks(status);
create index if not exists idx_project_tasks_due_date on project_tasks(due_date);
create index if not exists idx_user_skills_user on user_skills(user_id);
create index if not exists idx_project_skills_project on project_skills(project_id);
create index if not exists idx_post_comments_parent on post_comments(parent_comment_id);
create index if not exists idx_projects_status on projects(status);
create index if not exists idx_notifications_is_read on notifications(is_read);
create index if not exists idx_activities_type on activities(type);

-- Remove or restrict execute_sql RPC in production
-- Recommended: drop function if not needed
-- drop function if exists execute_sql(text, jsonb);
-- Or restrict with RLS or admin-only role

-- Reminder: Never expose your Supabase service role key to the frontend. Use anon key for frontend, service key for backend only.