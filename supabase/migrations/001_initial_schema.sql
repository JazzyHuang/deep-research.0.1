-- Deep Research Database Schema
-- Run this migration after setting up Supabase

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Research Sessions Table
create table if not exists public.research_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  query text not null,
  title text,
  abstract text,
  content jsonb,
  status text default 'pending' check (status in ('pending', 'planning', 'searching', 'analyzing', 'writing', 'complete', 'error')),
  papers_count integer default 0,
  citations_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Search Results Cache Table (optional, for faster re-searches)
create table if not exists public.search_results (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.research_sessions(id) on delete cascade not null,
  query text not null,
  round_number integer not null,
  papers jsonb not null,
  analysis jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Papers Cache Table (optional, for storing paper metadata)
create table if not exists public.papers_cache (
  id text primary key, -- CORE paper ID
  title text not null,
  authors jsonb,
  abstract text,
  year integer,
  doi text,
  download_url text,
  source_url text,
  journal text,
  subjects jsonb,
  open_access boolean default false,
  cached_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User Preferences Table
create table if not exists public.user_preferences (
  user_id uuid references auth.users(id) on delete cascade primary key,
  default_year_from integer,
  default_year_to integer,
  prefer_open_access boolean default true,
  max_search_rounds integer default 5,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for better query performance
create index if not exists idx_research_sessions_user_id on public.research_sessions(user_id);
create index if not exists idx_research_sessions_created_at on public.research_sessions(created_at desc);
create index if not exists idx_research_sessions_status on public.research_sessions(status);
create index if not exists idx_search_results_session_id on public.search_results(session_id);
create index if not exists idx_papers_cache_doi on public.papers_cache(doi) where doi is not null;

-- Row Level Security (RLS) Policies
alter table public.research_sessions enable row level security;
alter table public.search_results enable row level security;
alter table public.user_preferences enable row level security;

-- Research Sessions: Users can only access their own sessions
create policy "Users can view own sessions"
  on public.research_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create own sessions"
  on public.research_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.research_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.research_sessions for delete
  using (auth.uid() = user_id);

-- Search Results: Users can only access results from their sessions
create policy "Users can view own search results"
  on public.search_results for select
  using (
    exists (
      select 1 from public.research_sessions
      where research_sessions.id = search_results.session_id
      and research_sessions.user_id = auth.uid()
    )
  );

create policy "Users can create search results for own sessions"
  on public.search_results for insert
  with check (
    exists (
      select 1 from public.research_sessions
      where research_sessions.id = search_results.session_id
      and research_sessions.user_id = auth.uid()
    )
  );

-- User Preferences: Users can only access their own preferences
create policy "Users can view own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can create own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);

-- Papers Cache: Public read access (cached papers are shared)
alter table public.papers_cache enable row level security;

create policy "Anyone can read cached papers"
  on public.papers_cache for select
  to authenticated
  using (true);

create policy "Service role can manage papers cache"
  on public.papers_cache for all
  to service_role
  using (true);

-- Functions
-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers
create trigger handle_research_sessions_updated_at
  before update on public.research_sessions
  for each row execute procedure public.handle_updated_at();

create trigger handle_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute procedure public.handle_updated_at();

-- Create default preferences for new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();









