import { useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { projectUnlockKey } from '@/lib/projectAccess';
import type { Project } from '@/types/database';
import type { SectionsGate } from '@/hooks/useSections';

interface ProjectAccessGateProps {
  project: Project;
  /** Which gate the server told us to show; null means no gate is needed. */
  gate: SectionsGate;
  onUnlocked: () => void;
}

/**
 * Shown when useSections reports a `gate` -- i.e. /api/project-sections
 * refused to return content for the current viewer. This is a real
 * server-enforced gate, not a client-side convenience: the underlying
 * section content was never sent to the browser in the first place (see
 * functions/api/project-sections.ts), so there's nothing here for a
 * curious visitor to bypass by inspecting the page or the network tab.
 *
 * For "private" there's nothing the visitor can do -- only the owner can
 * ever pass that gate, and they'd never see this component since their
 * own request already succeeds. For "password", submitting sends the
 * plaintext password to /api/unlock-project, which verifies it
 * server-side against the PBKDF2 hash (with a server-only pepper) and,
 * on success, returns a signed unlock token -- never the hash, and the
 * password itself never gets stored anywhere client-side.
 */
export function ProjectAccessGate({ project, gate, onUnlocked }: ProjectAccessGateProps) {
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (gate === 'private') {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="font-display text-lg font-semibold">This project is private</h2>
          <p className="text-sm text-muted-foreground">
            Only the owner of this documentation can view it.
          </p>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setChecking(true);
    setError(null);

    try {
      const res = await fetch('/api/unlock-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug: project.slug, password }),
      });
      const body = (await res.json()) as { unlockToken?: string; error?: string };

      if (!res.ok || !body.unlockToken) {
        setError(body.error ?? 'Incorrect password.');
        setChecking(false);
        return;
      }

      try {
        sessionStorage.setItem(projectUnlockKey(project.id), body.unlockToken);
      } catch {
        // sessionStorage can throw in locked-down/private-browsing
        // contexts; unlocking still works for the rest of this render
        // via onUnlocked, just won't persist across a reload.
      }
      setChecking(false);
      onUnlocked();
    } catch {
      setError('Something went wrong. Please try again.');
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-display text-lg font-semibold">This project is password-protected</h2>
        <p className="text-sm text-muted-foreground">Enter the password to view this documentation.</p>

        <div className="mt-2 flex w-full flex-col gap-1.5 text-left">
          <Label htmlFor="gate-password">Password</Label>
          <Input
            id="gate-password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button type="submit" className="mt-1 w-full" loading={checking} disabled={!password}>
          Unlock
        </Button>
      </form>
    </div>
  );
}
