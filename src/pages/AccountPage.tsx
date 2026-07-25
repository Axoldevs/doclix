import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { User, Mail, KeyRound, AlertTriangle } from 'lucide-react';
import { ProjectHeader } from '@/components/ProjectHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof User;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AccountPage() {
  const { user, loading, updateDisplayName, updateEmail, updatePassword, deleteAccount, signOut } =
    useAuth();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(
    (user?.user_metadata?.display_name as string | undefined) ?? ''
  );
  const [savingName, setSavingName] = useState(false);

  const [email, setEmail] = useState(user?.email ?? '');
  const [savingEmail, setSavingEmail] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    const { error } = await updateDisplayName(displayName.trim());
    setSavingName(false);
    showToast(error ?? 'Display name updated', error ? 'error' : 'success');
  }

  async function handleSaveEmail(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || email === user?.email) return;
    setSavingEmail(true);
    const { error } = await updateEmail(email.trim());
    setSavingEmail(false);
    showToast(
      error ?? 'Confirmation email sent — check your inbox to finish the change',
      error ? 'error' : 'success'
    );
  }

  async function handleSavePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setSavingPassword(true);
    const { error } = await updatePassword(newPassword);
    setSavingPassword(false);
    if (error) {
      showToast(error, 'error');
    } else {
      showToast('Password updated', 'success');
      setNewPassword('');
      setConfirmPassword('');
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const { error } = await deleteAccount();
    setDeleting(false);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Account deleted', 'success');
    setDeleteOpen(false);
  }

  const canDelete = confirmText === 'DELETE';

  return (
    <div className="flex min-h-screen flex-col">
      <ProjectHeader title="Account" />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your profile, sign-in details, and account.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <SettingsCard icon={User} title="Profile" description="How your name appears in DOCLIX">
            <form onSubmit={handleSaveName} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  maxLength={80}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={savingName}>
                  Save
                </Button>
              </div>
            </form>
          </SettingsCard>

          <SettingsCard
            icon={Mail}
            title="Email address"
            description="Used to sign in and receive account notifications"
          >
            <form onSubmit={handleSaveEmail} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  loading={savingEmail}
                  disabled={!email.trim() || email === user?.email}
                >
                  Update email
                </Button>
              </div>
            </form>
          </SettingsCard>

          <SettingsCard
            icon={KeyRound}
            title="Password"
            description="Set a new password for your account"
          >
            <form onSubmit={handleSavePassword} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  loading={savingPassword}
                  disabled={!newPassword || !confirmPassword}
                >
                  Update password
                </Button>
              </div>
            </form>
          </SettingsCard>

          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <h2 className="font-medium text-destructive">Danger zone</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Irreversible actions — proceed with caution
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
              <div>
                <p className="text-sm font-medium">Delete account</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Permanently deletes your account and every project you own. This cannot be
                  undone.
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete account
              </Button>
            </div>
          </section>

          <div className="flex justify-start">
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={deleteOpen} onOpenChange={(open) => {
        setDeleteOpen(open);
        if (!open) setConfirmText('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and all projects and sections you own. Anyone
              you've shared docs with will lose access. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-delete">
              Type <span className="font-semibold text-foreground">DELETE</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!canDelete}
              loading={deleting}
              onClick={handleDeleteAccount}
            >
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
