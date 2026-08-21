import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ProjectHeader } from '@/components/ProjectHeader';
import { FullPageSpinner } from '@/components/StateViews';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { ROLE_LABELS } from '@/lib/permissions';
import type { StoredProjectRole } from '@/types/database';

export default function AcceptInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, session, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<StoredProjectRole | null>(null);
  const [projectSlug, setProjectSlug] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) {
      // Not signed in -- send them to sign in/up first, then bounce back
      // here to redeem the invite once they have a session.
      navigate('/login', { state: { from: { pathname: `/invite/${token}` } } });
      return;
    }
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/accept-invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          projectSlug?: string;
          role?: StoredProjectRole;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? 'Failed to accept invite.');
          setStatus('error');
          return;
        }
        setProjectSlug(body.projectSlug ?? null);
        setRole(body.role ?? null);
        setStatus('success');
      } catch {
        if (!cancelled) {
          setError('Network error while accepting the invite.');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, session, token, navigate]);

  if (authLoading || status === 'pending') return <FullPageSpinner label="Accepting invite…" />;

  return (
    <div className="flex min-h-screen flex-col">
      <ProjectHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        {status === 'success' ? (
          <>
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <h1 className="font-display text-xl font-semibold">You're in</h1>
            <p className="text-sm text-muted-foreground">
              {role ? `You've joined the project as ${ROLE_LABELS[role]}.` : "You've joined the project."}
            </p>
            <Button onClick={() => navigate(projectSlug ? `/docs/${projectSlug}` : '/dashboard')}>
              {projectSlug ? 'Go to project' : 'Go to dashboard'}
            </Button>
          </>
        ) : (
          <>
            <XCircle className="h-10 w-10 text-destructive" />
            <h1 className="font-display text-xl font-semibold">Couldn't accept invite</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Go to dashboard
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
