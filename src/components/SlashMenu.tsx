import { useEffect, useRef } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Table2,
  Code2,
  Minus,
  Link2,
  ImagePlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SlashCommand {
  id: string;
  label: string;
  hint: string;
  icon: typeof Heading1;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'h1', label: 'Heading 1', hint: 'Big section heading', icon: Heading1 },
  { id: 'h2', label: 'Heading 2', hint: 'Medium section heading', icon: Heading2 },
  { id: 'h3', label: 'Heading 3', hint: 'Small section heading', icon: Heading3 },
  { id: 'bullet', label: 'Bullet list', hint: 'Simple unordered list', icon: List },
  { id: 'numbered', label: 'Numbered list', hint: 'List with numbering', icon: ListOrdered },
  { id: 'quote', label: 'Quote', hint: 'Blockquote callout', icon: Quote },
  { id: 'table', label: 'Table', hint: 'Insert a table', icon: Table2 },
  { id: 'code', label: 'Code block', hint: 'Fenced code with a language', icon: Code2 },
  { id: 'divider', label: 'Divider', hint: 'Horizontal rule', icon: Minus },
  { id: 'link', label: 'Link', hint: 'Insert a hyperlink', icon: Link2 },
  { id: 'image', label: 'Image', hint: 'Upload or link an image', icon: ImagePlus },
];

interface SlashMenuProps {
  top: number;
  left: number;
  query: string;
  activeIndex: number;
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
}

export function filterSlashCommands(query: string): SlashCommand[] {
  if (!query) return SLASH_COMMANDS;
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter((c) => c.id.includes(q) || c.label.toLowerCase().includes(q));
}

export function SlashMenu({ top, left, query, activeIndex, onSelect, onHover }: SlashMenuProps) {
  const results = filterSlashCommands(query);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = containerRef.current?.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (results.length === 0) return null;

  return (
    <div
      style={{ top, left }}
      className="absolute z-30 max-h-64 w-64 overflow-y-auto scrollbar-thin rounded-lg border border-border bg-card py-1 shadow-2xl"
    >
      <div ref={containerRef}>
        {results.map((command, idx) => {
          const Icon = command.icon;
          return (
            <button
              key={command.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(command);
              }}
              onMouseEnter={() => onHover(idx)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors duration-100',
                idx === activeIndex ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex flex-col">
                <span className="font-medium text-foreground">{command.label}</span>
                <span className="text-xs text-muted-foreground">{command.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
