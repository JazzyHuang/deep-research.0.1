'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { CitationList } from '@/components/research';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft,
  Calendar,
  Copy,
  Check,
  Download,
  BookOpen
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { User } from '@supabase/supabase-js';
import type { ResearchReport } from '@/types/research';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReportPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [session, setSession] = useState<{
    query: string;
    created_at: string;
    status: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      setUser(user);

      const { data } = await supabase
        .from('research_sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      
      if (!data) {
        router.push('/history');
        return;
      }
      
      setSession({
        query: data.query,
        created_at: data.created_at,
        status: data.status,
      });
      
      setReport(JSON.parse(data.content));
      setIsLoading(false);
    };

    loadData();
  }, [id, router]);

  const handleCopy = async () => {
    if (!report) return;
    
    const content = `# ${report.title}\n\n${report.abstract}\n\n${report.sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n')}`;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!report) return;
    
    const content = `# ${report.title}\n\n${report.abstract}\n\n${report.sections.map(s => `## ${s.heading}\n\n${s.content}`).join('\n\n')}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.slice(0, 50)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="container py-8 max-w-6xl">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-[600px]" />
        </main>
      </>
    );
  }

  if (!report || !session) {
    return null;
  }

  return (
    <>
      <Header 
        user={user ? { 
          email: user.email || '', 
          name: user.user_metadata?.full_name 
        } : null}
        onLogout={handleLogout}
      />
      <main className="container py-8 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <Button variant="ghost" size="sm" asChild className="mb-4">
                <Link href="/history" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to History
                </Link>
              </Button>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={session.status === 'complete' ? 'default' : 'secondary'}>
                  {session.status}
                </Badge>
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                </span>
              </div>
              <h1 className="text-3xl font-serif mb-2">{report.title}</h1>
              <p className="text-muted-foreground">
                <span className="font-medium">Original query:</span> {session.query}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <Card className="bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Research Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[calc(100vh-350px)]">
                    <div className="prose-research">
                      {/* Abstract */}
                      {report.abstract && (
                        <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">
                            Abstract
                          </h3>
                          <p className="text-muted-foreground">{report.abstract}</p>
                        </div>
                      )}

                      {/* Sections */}
                      {report.sections.map((section, i) => (
                        <div key={i} className="mb-6">
                          {section.level === 1 && (
                            <h1>{section.heading}</h1>
                          )}
                          {section.level === 2 && (
                            <h2>{section.heading}</h2>
                          )}
                          {section.level === 3 && (
                            <h3>{section.heading}</h3>
                          )}
                          <div 
                            dangerouslySetInnerHTML={{ 
                              __html: renderMarkdown(section.content) 
                            }} 
                          />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div>
              <CitationList citations={report.citations} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// Simple markdown to HTML renderer
function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[(\d+(?:,\s*\d+)*)\]/g, '<span class="citation">$1</span>')
    .replace(/^\* (.*$)/gm, '<li>$1</li>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}



