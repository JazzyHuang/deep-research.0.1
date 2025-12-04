-- Session Persistence and Embeddings Migration
-- Adds support for:
-- 1. Full session state persistence for resume/checkpoint
-- 2. Vector embeddings for semantic paper search
-- 3. Research memory snapshots

-- Enable pgvector extension for embeddings
create extension if not exists vector;

-- ============================================
-- Session State Persistence
-- ============================================

-- Add columns to research_sessions for full state persistence
alter table public.research_sessions add column if not exists
  workflow_state text default 'initializing' check (workflow_state in (
    'initializing', 'planning', 'searching', 'analyzing', 
    'writing', 'reviewing', 'iterating', 'validating', 'complete', 'error'
  ));

alter table public.research_sessions add column if not exists
  iteration_count integer default 0;

alter table public.research_sessions add column if not exists
  plan jsonb; -- Full research plan

alter table public.research_sessions add column if not exists
  search_rounds jsonb default '[]'::jsonb; -- Array of search rounds

alter table public.research_sessions add column if not exists
  collected_papers jsonb default '[]'::jsonb; -- Array of paper IDs

alter table public.research_sessions add column if not exists
  report_versions jsonb default '[]'::jsonb; -- Array of report version content

alter table public.research_sessions add column if not exists
  citations jsonb default '[]'::jsonb; -- Array of citations

alter table public.research_sessions add column if not exists
  quality_metrics jsonb; -- Latest quality metrics

alter table public.research_sessions add column if not exists
  checklist jsonb; -- Verifiable checklist state

alter table public.research_sessions add column if not exists
  evidence_audit jsonb; -- Latest evidence audit result

alter table public.research_sessions add column if not exists
  gaps jsonb default '[]'::jsonb; -- Identified gaps

alter table public.research_sessions add column if not exists
  is_resumable boolean default false; -- Whether session can be resumed

alter table public.research_sessions add column if not exists
  last_checkpoint jsonb; -- Last checkpoint data for resume

alter table public.research_sessions add column if not exists
  final_report text; -- Final report markdown content

-- ============================================
-- Paper Embeddings Table
-- ============================================

create table if not exists public.paper_embeddings (
  id uuid default uuid_generate_v4() primary key,
  paper_id text not null references public.papers_cache(id) on delete cascade,
  embedding vector(1536) not null, -- OpenAI text-embedding-3-small dimension
  embedding_model text default 'text-embedding-3-small',
  text_hash text not null, -- Hash of embedded text for cache invalidation
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(paper_id)
);

-- Index for vector similarity search
create index if not exists idx_paper_embeddings_vector 
  on public.paper_embeddings 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Index for paper lookups
create index if not exists idx_paper_embeddings_paper_id 
  on public.paper_embeddings(paper_id);

-- ============================================
-- Session Memory Snapshots
-- ============================================

create table if not exists public.session_snapshots (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.research_sessions(id) on delete cascade not null,
  snapshot_type text not null check (snapshot_type in (
    'checkpoint', 'iteration_complete', 'search_complete', 'manual'
  )),
  workflow_state text not null,
  iteration integer not null,
  memory_state jsonb not null, -- Full ResearchMemory state
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_session_snapshots_session_id 
  on public.session_snapshots(session_id);

create index if not exists idx_session_snapshots_created_at 
  on public.session_snapshots(created_at desc);

-- ============================================
-- Embedding Functions
-- ============================================

-- Function to find similar papers by embedding
create or replace function public.find_similar_papers(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 10
)
returns table (
  paper_id text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    pe.paper_id,
    1 - (pe.embedding <=> query_embedding) as similarity
  from public.paper_embeddings pe
  where 1 - (pe.embedding <=> query_embedding) > match_threshold
  order by pe.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Function to find papers similar to another paper
create or replace function public.find_related_papers(
  source_paper_id text,
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  paper_id text,
  similarity float
)
language plpgsql
as $$
declare
  source_embedding vector(1536);
begin
  -- Get the source paper's embedding
  select embedding into source_embedding
  from public.paper_embeddings
  where paper_id = source_paper_id;
  
  if source_embedding is null then
    return;
  end if;
  
  return query
  select
    pe.paper_id,
    1 - (pe.embedding <=> source_embedding) as similarity
  from public.paper_embeddings pe
  where pe.paper_id != source_paper_id
    and 1 - (pe.embedding <=> source_embedding) > match_threshold
  order by pe.embedding <=> source_embedding
  limit match_count;
end;
$$;

-- ============================================
-- Session Resume Functions
-- ============================================

-- Function to create a session snapshot
create or replace function public.create_session_snapshot(
  p_session_id uuid,
  p_snapshot_type text,
  p_workflow_state text,
  p_iteration integer,
  p_memory_state jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  snapshot_id uuid;
begin
  insert into public.session_snapshots (
    session_id, snapshot_type, workflow_state, iteration, memory_state
  ) values (
    p_session_id, p_snapshot_type, p_workflow_state, p_iteration, p_memory_state
  )
  returning id into snapshot_id;
  
  -- Update session's resumable flag
  update public.research_sessions
  set is_resumable = true,
      last_checkpoint = jsonb_build_object(
        'snapshot_id', snapshot_id,
        'snapshot_type', p_snapshot_type,
        'workflow_state', p_workflow_state,
        'iteration', p_iteration,
        'created_at', now()
      )
  where id = p_session_id;
  
  return snapshot_id;
end;
$$;

-- Function to get the latest snapshot for a session
create or replace function public.get_latest_snapshot(
  p_session_id uuid
)
returns table (
  id uuid,
  snapshot_type text,
  workflow_state text,
  iteration integer,
  memory_state jsonb,
  created_at timestamp with time zone
)
language plpgsql
as $$
begin
  return query
  select 
    ss.id,
    ss.snapshot_type,
    ss.workflow_state,
    ss.iteration,
    ss.memory_state,
    ss.created_at
  from public.session_snapshots ss
  where ss.session_id = p_session_id
  order by ss.created_at desc
  limit 1;
end;
$$;

-- ============================================
-- RLS Policies for new tables
-- ============================================

-- Paper embeddings: Authenticated users can read
alter table public.paper_embeddings enable row level security;

create policy "Authenticated users can read paper embeddings"
  on public.paper_embeddings for select
  to authenticated
  using (true);

create policy "Service role can manage paper embeddings"
  on public.paper_embeddings for all
  to service_role
  using (true);

-- Session snapshots: Users can only access their own session snapshots
alter table public.session_snapshots enable row level security;

create policy "Users can view own session snapshots"
  on public.session_snapshots for select
  using (
    exists (
      select 1 from public.research_sessions
      where research_sessions.id = session_snapshots.session_id
      and research_sessions.user_id = auth.uid()
    )
  );

create policy "Users can create snapshots for own sessions"
  on public.session_snapshots for insert
  with check (
    exists (
      select 1 from public.research_sessions
      where research_sessions.id = session_snapshots.session_id
      and research_sessions.user_id = auth.uid()
    )
  );

-- ============================================
-- Add comments for documentation
-- ============================================

comment on table public.paper_embeddings is 'Vector embeddings for semantic paper search using pgvector';
comment on table public.session_snapshots is 'Snapshots of research session state for resume/checkpoint functionality';

comment on column public.research_sessions.workflow_state is 'Current state in the research workflow';
comment on column public.research_sessions.is_resumable is 'Whether the session can be resumed from a checkpoint';
comment on column public.research_sessions.last_checkpoint is 'Metadata about the last checkpoint for resume';
comment on column public.research_sessions.checklist is 'Verifiable checklist state (RhinoInsight-style)';
comment on column public.research_sessions.evidence_audit is 'Latest evidence grounding audit result';





