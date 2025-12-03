# Deep Research

AI-powered academic research platform that generates comprehensive reports with real citations from peer-reviewed papers.

## Features

- **Multi-Agent Research System**: Three specialized AI agents (Planner, Researcher, Writer) work together to conduct deep research
- **CORE Database Integration**: Access to 200M+ open access academic papers
- **Real-time Streaming**: Watch as your research unfolds with live updates
- **Authentic Citations**: Every claim is backed by real, verifiable papers
- **User Authentication**: Save and manage your research history
- **Export Options**: Download reports in Markdown format

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **UI**: Tailwind CSS v4 + Shadcn/UI
- **AI**: Vercel AI SDK + OpenRouter (GPT-4o)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Papers API**: CORE API v3

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- OpenRouter API key
- CORE API key

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd deepresearch.0.1
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
OPENROUTER_API_KEY=your_openrouter_key
CORE_API_KEY=your_core_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
```

4. Set up the database:

Run the migration in your Supabase SQL editor:
```sql
-- Copy contents from supabase/migrations/001_initial_schema.sql
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## API Keys

### OpenRouter
Get your API key from [OpenRouter](https://openrouter.ai/keys)

### CORE API
Register for a free API key at [CORE](https://core.ac.uk/services/api)

### Supabase
Create a project at [Supabase](https://supabase.com) and get your keys from Project Settings > API

## Architecture

```
┌─────────────────────────────────────────┐
│  Deep Research Agent (Multi-Agent)      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Planner │→│Researcher│→│ Writer  │ │
│  │ Agent   │  │ Agent   │  │ Agent   │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│       ↓            ↓            ↓      │
│  Parse query   Multi-round   Generate  │
│  & plan        CORE search   report    │
└─────────────────────────────────────────┘
```

### Planner Agent
- Analyzes the research question
- Generates search strategies
- Plans report structure

### Researcher Agent
- Executes multi-round searches on CORE
- Analyzes paper relevance
- Identifies literature gaps
- Decides when enough data is collected

### Writer Agent
- Synthesizes findings
- Generates comprehensive report
- Inserts proper citations
- Creates reference list

## Project Structure

```
/src
  /app
    /api
      /research/route.ts    # Main research API
      /core/route.ts        # CORE API proxy
    /(auth)
      /login/page.tsx
      /register/page.tsx
    /(dashboard)
      /dashboard/page.tsx   # Main research interface
      /history/page.tsx     # Research history
      /report/[id]/page.tsx # Report detail
  /components
    /research               # Research-specific components
    /ui                     # Shadcn components
    /layout                 # Layout components
  /lib
    /agents                 # AI agent implementations
    /supabase              # Supabase clients
    core-api.ts            # CORE API client
  /types                    # TypeScript types
```

## Usage

1. **Enter your research question** - Be specific about what you want to learn
2. **Watch the research unfold** - See real-time updates as the AI searches and analyzes papers
3. **Review the report** - Read through the generated report with citations
4. **Verify sources** - Click on any citation to view the original paper
5. **Export or save** - Download as Markdown or save to your history

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [CORE](https://core.ac.uk/) for providing access to academic papers
- [OpenRouter](https://openrouter.ai/) for AI model access
- [Vercel](https://vercel.com/) for the AI SDK
- [Supabase](https://supabase.com/) for backend services
