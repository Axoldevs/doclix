import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

interface TableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (markdown: string) => void;
}

export function buildTableMarkdown(rows: number, cols: number): string {
  const clampedRows = Math.max(1, Math.min(rows, 20));
  const clampedCols = Math.max(1, Math.min(cols, 10));

  const header = Array.from({ length: clampedCols }, (_, c) => `Column ${c + 1}`);
  const separator = Array.from({ length: clampedCols }, () => '---');
  const body = Array.from({ length: clampedRows }, () =>
    Array.from({ length: clampedCols }, () => ' ')
  );

  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;

  return [line(header), line(separator), ...body.map((row) => line(row))].join('\n');
}

export function TableDialog({ open, onOpenChange, onConfirm }: TableDialogProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onConfirm(buildTableMarkdown(rows, cols));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert table</DialogTitle>
          <DialogDescription>Choose a size. You can add or remove rows and columns later.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="table-rows">Rows</Label>
              <Input
                id="table-rows"
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(Number(e.target.value) || 1)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="table-cols">Columns</Label>
              <Input
                id="table-cols"
                type="number"
                min={1}
                max={10}
                value={cols}
                onChange={(e) => setCols(Number(e.target.value) || 1)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Insert table</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
