# Deep Research

AI-powered academic research platform that generates comprehensive research reports with verified citations from peer-reviewed papers.

## ✨ Features

### 🤖 Advanced Multi-Agent System
- **Coordinator** - Dynamic workflow orchestrator with intelligent decision-making
- **Planner** - Analyzes research questions and generates strategic search plans
- **Researcher** - Executes multi-round literature searches across multiple databases
- **Writer** - Synthesizes findings into comprehensive reports with inline citations
- **Critic** - Reviews reports for quality, coverage, and potential hallucinations
- **Quality Gate** - Evaluates metrics and triggers iterative improvements
- **Validator** - Verifies citation accuracy and DOI authenticity via Crossref

### 📚 Multi-Source Academic Database Integration
- **CORE** - 200M+ open access papers
- **Semantic Scholar** - AI-powered academic search
- **OpenAlex** - Open catalog of scholarly works
- **arXiv** - Physics, mathematics, and computer science preprints
- **PubMed** - Biomedical and life sciences literature

Features intelligent aggregation with deduplication, retry logic, and fallback support.

### 📝 Comprehensive Citation System
Five professional citation styles:
- **APA** (American Psychological Association)
- **MLA** (Modern Language Association)
- **Chicago** (Chicago Manual of Style)
- **IEEE** (Institute of Electrical and Electronics Engineers)
- **GB/T 7714** (Chinese national standard)

### 🔄 Quality Control Pipeline
- Multi-iteration report refinement (up to 3 iterations by default)
- Quality metrics: coverage score, citation density, recency score
- Hallucination detection and flagging
- Citation validation with DOI verification
- Gap analysis with automatic search suggestions

### 🎯 Real-Time Research Experience
- Server-Sent Events (SSE) for live streaming updates
- Agent execution timeline visualization
- Step-by-step progress tracking
- Interactive research session management

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **AI** | Vercel AI SDK + OpenRouter (Grok 4.1 Fast, Gemini 2.5 Flash, Gemini 2.5 Flash-Lite) |
| **Database** | Supabase (PostgreSQL + Auth + Row Level Security) |
| **APIs** | CORE API, Semantic Scholar, OpenAlex, arXiv, PubMed, Crossref |

### AI Model Strategy

| Model | Role | Key Capabilities |
|-------|------|------------------|
| **Grok 4.1 Fast** | Orchestration & Planning | 2M context window, fast reasoning, tool calling |
| **Gemini 2.5 Flash** | Writing & Analysis | Strong reasoning, reliable streaming |
| **Gemini 2.5 Flash-Lite** | Bulk Tasks | Fastest, cost-efficient, high throughput |

- **Grok 4.1 Fast**: Powers research planning, workflow decisions, and search coordination. Features automatic fallback from free to paid tier.
- **Gemini 2.5 Flash**: Handles report generation and critical analysis with strong reasoning capabilities.
- **Gemini 2.5 Flash-Lite**: Processes paper extraction, citation validation, and other repetitive tasks efficiently.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Coordinator                               │
│        (Grok 4.1 Fast - Workflow Orchestration)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Planner    │   │  Researcher   │   │    Writer     │
│  (Grok 4.1)   │   │ (Mixed)       │   │ (Gemini 2.5   │
│               │   │               │   │  Flash+Think) │
│ • Parse query │   │ • Multi-round │   │ • Generate    │
│ • Sub-questions│   │   search      │   │   report      │
│ • Search      │   │ • Gap analysis│   │ • Citations   │
│   strategies  │   │ • Enrichment  │   │ • Sections    │
└───────────────┘   └───────────────┘   └───────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌───────────────┐                       ┌───────────────┐
│    Critic     │◄─────────────────────►│ Quality Gate  │
│ (Gemini 2.5   │                       │               │
│  Flash+Think) │                       │ • Metrics     │
│ • Review      │                       │ • Pass/Fail   │
│ • Score       │                       │ • Iterate     │
│ • Hallucinate │                       │   decision    │
│   detection   │                       │               │
└───────────────┘                       └───────────────┘
        │
        ▼
┌───────────────┐
│   Validator   │
│ (Flash-Lite)  │
│ • DOI verify  │
│ • Citation    │
│   support     │
└───────────────┘
```

### Data Source Aggregation

```
┌─────────────────────────────────────────────────────────┐
│              DataSourceAggregator                        │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐   │
│  │  CORE   │Semantic │OpenAlex │  arXiv  │ PubMed  │   │
│  │         │Scholar  │         │         │         │   │
│  └────┬────┴────┬────┴────┬────┴────┬────┴────┬────┘   │
│       │         │         │         │         │        │
│       └─────────┴─────────┴─────────┴─────────┘        │
│                         │                               │
│                    Deduplicate                          │
│                    Sort & Filter                        │
│                    Retry & Fallback                     │
└─────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
src/
├── app/
│   ├── (auth)/                    # Authentication pages
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/               # Protected dashboard
│   │   ├── dashboard/
│   │   ├── history/
│   │   └── report/[id]/
│   ├── api/
│   │   ├── core/route.ts          # CORE API proxy
│   │   └── research/              # Research API endpoints
│   │       ├── route.ts           # Main research streaming API
│   │       └── sessions/          # Session management
│   ├── research/[sessionId]/      # Research session page
│   ├── page.tsx                   # Home page
│   └── globals.css
├── components/
│   ├── cards/                     # Card components
│   ├── execution/                 # Agent execution visualization
│   ├── history-sidebar/           # Research history
│   ├── layout/                    # Layout components
│   ├── providers/                 # Context providers
│   ├── research/                  # Research UI components
│   ├── research-chat/             # Chat interface components
│   ├── sidebar/                   # Side panel components
│   └── ui/                        # shadcn/ui components
├── hooks/
│   └── useResearchSession.ts      # Research session hook
├── lib/
│   ├── agents/                    # AI Agent implementations
│   │   ├── coordinator.ts         # Main workflow coordinator
│   │   ├── planner.ts             # Research planning
│   │   ├── researcher.ts          # Literature search
│   │   ├── writer.ts              # Report generation
│   │   ├── critic.ts              # Quality review
│   │   ├── quality-gate.ts        # Quality evaluation
│   │   └── validator.ts           # Citation validation
│   ├── citation/                  # Citation formatting system
│   │   ├── formatter.ts           # Main formatter
│   │   └── styles/                # Style implementations
│   │       ├── apa.ts
│   │       ├── mla.ts
│   │       ├── chicago.ts
│   │       ├── ieee.ts
│   │       └── gbt7714.ts
│   ├── context/                   # Context management
│   │   ├── compressor.ts          # Token compression
│   │   └── memory.ts              # Research memory
│   ├── data-sources/              # Academic database clients
│   │   ├── index.ts               # Aggregator
│   │   ├── core.ts
│   │   ├── semantic-scholar.ts
│   │   ├── openalex.ts
│   │   ├── arxiv.ts
│   │   └── pubmed.ts
│   ├── supabase/                  # Supabase clients
│   └── utils.ts
├── types/                         # TypeScript definitions
│   ├── paper.ts                   # Paper & citation types
│   ├── research.ts                # Research session types
│   ├── agent.ts                   # Agent state types
│   └── conversation.ts            # Chat types
└── middleware.ts                  # Auth middleware
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- Supabase account (optional, for persistence)
- OpenRouter API key
- CORE API key (optional but recommended)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/JazzyHuang/deep-research.0.1.git
cd deep-research.0.1
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Required
OPENROUTER_API_KEY=your_openrouter_key

# Optional - Academic APIs (enhances search coverage)
CORE_API_KEY=your_core_api_key
SEMANTIC_SCHOLAR_API_KEY=your_s2_api_key

# Optional - Supabase (for user auth & persistence)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key
```

4. **Set up the database (optional):**

Run the migration in your Supabase SQL editor:
```sql
-- Copy contents from supabase/migrations/001_initial_schema.sql
```

5. **Start the development server:**
```bash
npm run dev
```

6. **Open [http://localhost:3000](http://localhost:3000)**

## 🔑 API Keys

| Service | Description | Link |
|---------|-------------|------|
| **OpenRouter** | AI model access (required) | [Get API Key](https://openrouter.ai/keys) |
| **CORE API** | 200M+ academic papers | [Register](https://core.ac.uk/services/api) |
| **Semantic Scholar** | AI-powered paper search | [Get API Key](https://www.semanticscholar.org/product/api) |

> **Note:** The system works without CORE/Semantic Scholar keys using free tier APIs (OpenAlex, arXiv, PubMed), but API keys provide better rate limits and coverage.

## 📖 Usage

1. **Enter your research question** - Be specific about what you want to investigate

2. **Select citation style** - Choose from APA, MLA, Chicago, IEEE, or GB/T 7714

3. **Watch the research unfold** - See real-time progress:
   - Planning phase: Query analysis and strategy generation
   - Search phase: Multi-round literature search across databases
   - Analysis phase: Paper prioritization and context compression
   - Writing phase: Report generation with inline citations
   - Review phase: Quality evaluation and iterative improvement
   - Validation phase: Citation verification

4. **Review the report** - Read through the generated report with verified citations

5. **Verify sources** - Click on any citation to view the original paper

6. **Export or save** - Download as Markdown or save to your history

## ⚙️ Configuration

The research API accepts configuration options:

```typescript
{
  maxSearchRounds: 5,          // Maximum search iterations
  maxIterations: 3,            // Maximum report revision iterations
  minPapersRequired: 8,        // Minimum papers before writing
  enableMultiSource: true,     // Use multiple academic databases
  enableCitationValidation: true,  // Validate citations via Crossref
  enableContextCompression: true,  // Compress paper context for efficiency
  citationStyle: 'ieee',       // 'apa' | 'mla' | 'chicago' | 'ieee' | 'gbt7714'
  qualityGate: {
    minOverallScore: 70,       // Minimum quality score to pass
    maxIterations: 3,          // Max iterations before force-pass
  }
}
```

## 🧪 Quality Metrics

The system evaluates reports on:

| Metric | Description |
|--------|-------------|
| **Coverage Score** | How well sub-questions are addressed (0-100) |
| **Citation Density** | Citations per 500 words |
| **Unique Sources** | Number of distinct papers cited |
| **Recency Score** | How recent the cited sources are (0-100) |
| **Coherence Score** | Logical flow and structure quality (0-100) |
| **Depth Score** | Analysis depth beyond summarization (0-100) |

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [CORE](https://core.ac.uk/) - Open access academic papers
- [Semantic Scholar](https://www.semanticscholar.org/) - AI-powered research tools
- [OpenAlex](https://openalex.org/) - Open catalog of scholarly works
- [arXiv](https://arxiv.org/) - Open access archive
- [PubMed](https://pubmed.ncbi.nlm.nih.gov/) - Biomedical literature
- [OpenRouter](https://openrouter.ai/) - AI model access
- [Vercel](https://vercel.com/) - AI SDK and hosting
- [Supabase](https://supabase.com/) - Backend services
- [Crossref](https://www.crossref.org/) - DOI verification

---

<p align="center">
  Built with ❤️ for researchers everywhere
</p>
