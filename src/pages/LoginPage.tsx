import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

export default function LoginPage() {
  const { signIn, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<'signin' | 'reset'>('signin');
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  if (user) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard';
    navigate(from, { replace: true });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      navigate('/dashboard');
    }
  }

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);
    const { error } = await resetPassword(resetEmail);
    setResetLoading(false);
    if (error) {
      setResetError(error);
    } else {
      setResetSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link
          to="/"
          className="mb-8 flex flex-col items-center gap-2 text-center transition-opacity duration-150 hover:opacity-80"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-xl font-semibold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue to DOCLIX</p>
        </Link>

        {mode === 'signin' ? (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setResetEmail(email);
                      setResetError(null);
                      setResetSent(false);
                    }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={loading} className="mt-1 w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Create one
              </Link>
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            {resetSent ? (
              <div className="flex flex-col gap-4 text-center">
                <h2 className="font-display text-sm font-semibold">Check your email</h2>
                <p className="text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium text-foreground">{resetEmail}</span>,
                  we've sent a link to reset your password.
                </p>
                <Button variant="outline" size="sm" onClick={() => setMode('signin')}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} className="flex flex-col gap-4">
                <div>
                  <h2 className="font-display text-sm font-semibold">Reset your password</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your email and we'll send you a reset link.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                {resetError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {resetError}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setMode('signin')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={resetLoading} className="flex-1">
                    {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send link'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
