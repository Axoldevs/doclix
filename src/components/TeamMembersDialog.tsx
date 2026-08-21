import { useState, type FormEvent } from 'react';
import { UserPlus, Trash2, Loader2, Copy, Check, Crown, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useProjectTeamProfiles } from '@/hooks/useProjectTeamProfiles';
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, canGrantAdminRole } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import type { Project, ProjectRole, StoredProjectRole } from '@/types/database';

interface TeamMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  currentUserRole: ProjectRole;
}

export function TeamMembersDialog({ open, onOpenChange, project, currentUserRole }: TeamMembersDialogProps) {
  const { user } = useAuth();
  const { members, invites, loading, inviteMember, updateMemberRole, removeMember, revokeInvite } =
    useProjectMembers(open ? project.id : undefined);
  const { profiles } = useProjectTeamProfiles(open ? project : undefined, members);
  const nameFor = (userId: string) => profiles.find((p) => p.userId === userId)?.name ?? userId;

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StoredProjectRole>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isOwner = currentUserRole === 'owner';
  const assignableForCaller = ASSIGNABLE_ROLES.filter((r) => r !== 'admin' || isOwner);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteLink(null);
    const { error, status, inviteLink: link } = await inviteMember(email.trim(), role);
    setInviting(false);
    if (error) {
      setInviteError(error);
      return;
    }
    setEmail('');
    if (status === 'invited' && link) {
      setInviteLink(link);
    }
  }

  function copyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Team members</DialogTitle>
          <DialogDescription>
            Invite people to collaborate on "{project.title}" and control what they can do.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="mb-5 flex flex-col gap-2 rounded-lg border border-border p-3">
          <Label htmlFor="invite-email" className="text-xs">
            Invite by email
          </Label>
          <div className="flex gap-2">
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StoredProjectRole)}
              className="h-10 rounded-lg border border-input bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {assignableForCaller.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <Button type="submit" size="default" loading={inviting} disabled={!email.trim()}>
              <UserPlus className="h-4 w-4" />
              Invite
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
          {inviteLink && (
            <div className="mt-1 flex items-center gap-2 rounded-md bg-secondary/50 px-2 py-1.5 text-xs">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">
                They don't have a Doclix account yet — share this link:
              </span>
              <button
                type="button"
                onClick={copyLink}
                className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-medium text-primary hover:bg-secondary"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </form>

        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between rounded-md px-2 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Crown className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Owner</span>
                  {project.owner_id === user?.id && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">Owner</span>
              </div>

              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-secondary/40">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate">
                      {nameFor(member.user_id)}
                      {member.user_id === user?.id && <span className="text-muted-foreground"> (you)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(isOwner || member.role !== 'admin') ? (
                      <select
                        value={member.role}
                        onChange={(e) => updateMemberRole(member.id, e.target.value as StoredProjectRole)}
                        disabled={member.role === 'admin' && !canGrantAdminRole(currentUserRole)}
                        className="h-8 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {ASSIGNABLE_ROLES.filter((r) => r !== 'admin' || isOwner || member.role === 'admin').map(
                          (r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          )
                        )}
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
                    )}
                    <button
                      onClick={() => removeMember(member.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Remove from project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {invites.length > 0 && (
                <>
                  <div className="mt-3 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Pending invites
                  </div>
                  {invites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between rounded-md px-2 py-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{invite.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs text-muted-foreground')}>{ROLE_LABELS[invite.role]}</span>
                        <button
                          onClick={() => revokeInvite(invite.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Revoke invite"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {members.length === 0 && invites.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No team members yet — invite someone above.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
