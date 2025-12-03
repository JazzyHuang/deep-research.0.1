'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Search, 
  Calendar,
  ChevronRight,
  Trash2,
  Download,
  Plus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { User } from '@supabase/supabase-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ResearchSession {
  id: string;
  query: string;
  title: string;
  abstract: string;
  status: string;
  created_at: string;
  content: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login?redirectTo=/history');
        return;
      }
      
      setUser(user);

      const { data } = await supabase
        .from('research_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      setSessions(data || []);
      setIsLoading(false);
    };

    loadData();
  }, [router]);

  const handleDelete = async () => {
    if (!deleteId) return;
    
    const supabase = createClient();
    await supabase
      .from('research_sessions')
      .delete()
      .eq('id', deleteId);
    
    setSessions(prev => prev.filter(s => s.id !== deleteId));
    setDeleteId(null);
  };

  const handleDownload = (session: ResearchSession) => {
    const content = JSON.parse(session.content);
    const markdown = `# ${session.title}\n\n${session.abstract}\n\n${content.sections?.map((s: { heading: string; content: string }) => `## ${s.heading}\n\n${s.content}`).join('\n\n') || ''}`;
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title.slice(0, 50)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.query.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="container py-8">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </main>
      </>
    );
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
      <main className="container py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif">Research History</h1>
              <p className="text-muted-foreground">
                {sessions.length} research {sessions.length === 1 ? 'report' : 'reports'}
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Research
              </Link>
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search your research..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sessions List */}
          {filteredSessions.length === 0 ? (
            <Card className="bg-card/50 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">
                  {searchQuery ? 'No results found' : 'No research yet'}
                </h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchQuery 
                    ? 'Try a different search term'
                    : 'Start your first research to see it here'
                  }
                </p>
                {!searchQuery && (
                  <Button asChild>
                    <Link href="/dashboard">Start Research</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredSessions.map((session) => (
                <Card 
                  key={session.id} 
                  className="bg-card/50 backdrop-blur research-card group"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge 
                            variant={session.status === 'complete' ? 'default' : 'secondary'}
                            className="shrink-0"
                          >
                            {session.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <h3 className="font-serif text-lg font-medium mb-1 line-clamp-1">
                          {session.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {session.abstract || session.query}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Query:</span> {session.query}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(session)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(session.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/report/${session.id}`}>
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Research</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this research? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}



