'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Search, ShieldCheck, ShieldAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  getAuditLogs,
  verifyAuditLogIntegrity,
  type AuditIntegrityReport,
  type AuditLogFilters,
  type AuditLogRow,
} from '@/lib/audit-log-actions';

const SEVERITY_VARIANT: Record<string, 'secondary' | 'outline' | 'destructive'> = {
  info: 'secondary',
  warning: 'outline',
  critical: 'destructive',
};

const OUTCOME_VARIANT: Record<string, 'secondary' | 'outline' | 'destructive'> = {
  success: 'secondary',
  failure: 'outline',
  denied: 'destructive',
};

const ACTOR_TYPE_LABEL: Record<string, string> = {
  superAdmin: 'Super Admin',
  user: 'User',
  system: 'System',
  anonymous: 'Anonymous',
};

export default function AuditLogsPageContent() {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<NonNullable<AuditLogFilters['severity']>>('all');
  const [outcome, setOutcome] = useState<NonNullable<AuditLogFilters['outcome']>>('all');
  const [actorType, setActorType] = useState<NonNullable<AuditLogFilters['actorType']>>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [verifying, setVerifying] = useState(false);
  const [integrity, setIntegrity] = useState<AuditIntegrityReport | null>(null);

  const verify = async () => {
    setVerifying(true);
    try {
      setIntegrity(await verifyAuditLogIntegrity());
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not verify the audit log.' });
    } finally {
      setVerifying(false);
    }
  };

  const load = useCallback(
    async (cursor?: string) => {
      const append = !!cursor;
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const result = await getAuditLogs({ search, severity, outcome, actorType, from, to, cursor });
        setRows((prev) => (append ? [...prev, ...result.rows] : result.rows));
        setNextCursor(result.nextCursor);
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load the audit log.' });
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [search, severity, outcome, actorType, from, to, toast],
  );

  useEffect(() => {
    load();
    // Filters are applied explicitly via the form; only load once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">
            Who performed each administrative and security-relevant action, when, from where, and whether it succeeded.
            Read-only and tamper-evident.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Integrity</CardTitle>
            <CardDescription>
              Every entry is sealed into a SHA-256 hash chain by the database, which also rejects edits and deletions.
              Verify the chain to detect any tampering.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={verify} disabled={verifying}>
            {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Verify integrity
          </Button>
        </CardHeader>
        {integrity && (
          <CardContent className="text-sm">
            {integrity.ok ? (
              <div className="flex items-start gap-2 text-green-700 dark:text-green-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Chain intact: {integrity.checkedRows} entries verified
                  {integrity.firstSeq && integrity.lastSeq ? ` (#${integrity.firstSeq}–#${integrity.lastSeq})` : ''}.
                </span>
              </div>
            ) : (
              <div className="space-y-2 text-destructive">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Tampering detected: {integrity.problems.length} problem(s) found in {integrity.checkedRows} entries.</span>
                </div>
                <ul className="ml-6 list-disc font-mono text-xs">
                  {integrity.problems.map((p) => (
                    <li key={`${p.id}-${p.problem}`}>
                      {p.seq ? `#${p.seq}` : '(no seq)'} {p.id}: {p.problem.replace('_', ' ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {integrity.headHash && (
              <div className="mt-2 break-all text-xs text-muted-foreground">
                Latest hash: <span className="font-mono">{integrity.headHash}</span>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search by action (e.g. &quot;event.status&quot;), administrator name or phone, or a record ID.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-7"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
              <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
              <SelectTrigger><SelectValue placeholder="Result" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actorType} onValueChange={(v) => setActorType(v as typeof actorType)}>
              <SelectTrigger><SelectValue placeholder="Actor type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                <SelectItem value="superAdmin">Super Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="anonymous">Anonymous</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
            <div className="lg:col-span-7 flex justify-end">
              <Button type="submit" disabled={loading} style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">No audit entries match these filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Performed by</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>IP address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isOpen = expanded === row.id;
                  return (
                    <Fragment key={row.id}>
                      <TableRow className="cursor-pointer" onClick={() => setExpanded(isOpen ? null : row.id)}>
                        <TableCell>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{format(new Date(row.createdAt), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
                        <TableCell className="font-mono text-xs">{row.action}</TableCell>
                        <TableCell>
                          <Badge variant={OUTCOME_VARIANT[row.outcome] ?? 'secondary'}>{row.outcome}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={SEVERITY_VARIANT[row.severity] ?? 'secondary'}>{row.severity}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>{row.actorLabel || row.actorId || '—'}</div>
                          {row.actorType && (
                            <div className="text-xs text-muted-foreground">{ACTOR_TYPE_LABEL[row.actorType] ?? row.actorType}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.targetType ? `${row.targetType}${row.targetId ? ` #${row.targetId}` : ''}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs">{row.ip || '—'}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={7}>
                            <div className="space-y-2 text-xs">
                              <div><span className="font-semibold">Entry:</span> {row.seq ? `#${row.seq}` : '—'} ({row.id})</div>
                              <div><span className="font-semibold">Actor ID:</span> {row.actorId || '—'}</div>
                              <div><span className="font-semibold">User agent:</span> {row.userAgent || '—'}</div>
                              <div className="break-all"><span className="font-semibold">Hash:</span> <span className="font-mono">{row.hash || '—'}</span></div>
                              <pre className="max-h-64 overflow-auto rounded bg-muted p-3 whitespace-pre-wrap break-all">
                                {row.detail ? JSON.stringify(row.detail, null, 2) : 'No additional detail.'}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {nextCursor && !loading && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" disabled={loadingMore} onClick={() => load(nextCursor)}>
                {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
