'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { ResearchInput } from '@/components/research';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BookOpen, 
  History, 
  FileText, 
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import type { CitationStyle } from '@/lib/citation';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recentCount, setRecentCount] = useState(0);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login?redirectTo=/dashboard');
        return;
      }
      
      setUser(user);
      
      // Get recent research count
      const { count } = await supabase
        .from('research_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      setRecentCount(count || 0);
      setIsLoading(false);
    };

    checkUser();
  }, [router]);

  const handleStartResearch = (q: string, style: CitationStyle) => {
    // Create a new session and redirect to the new chat UI
    const sessionId = `session-${Date.now()}`;
    
    // Store query in sessionStorage for the research page to pick up
    sessionStorage.setItem(`research_query_${sessionId}`, JSON.stringify({
      query: q,
      citationStyle: style,
    }));
    
    // Navigate to the new research chat page
    router.push(`/research/${sessionId}`);
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
        <main className="container py-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-[400px]" />
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
      <main className="container py-8 md:py-12">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif mb-2">
              Welcome back, {user?.user_metadata?.full_name?.split(' ')[0] || 'Researcher'}
            </h1>
            <p className="text-muted-foreground">
              Start a new research or continue from your history
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
            <Card className="bg-card/50 backdrop-blur">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{recentCount}</p>
                    <p className="text-sm text-muted-foreground">Research Reports</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-accent/10">
                    <BookOpen className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">200M+</p>
                    <p className="text-sm text-muted-foreground">Papers Available</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-green-500/10">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">Real-time</p>
                    <p className="text-sm text-muted-foreground">AI Analysis</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Research Input */}
          <ResearchInput 
            onSubmit={handleStartResearch} 
            isLoading={false}
          />

          {/* Quick Actions */}
          {recentCount > 0 && (
            <div className="flex justify-center mt-8">
              <Button variant="outline" asChild>
                <Link href="/history" className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  View Research History
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
