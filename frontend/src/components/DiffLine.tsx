/**
 * Component for displaying unified diff lines with colour coding.
 *
 * Part of EP0010: Configuration Management - US0118 Configuration Diff View.
 */

import { cn } from '../lib/utils';

interface DiffLineProps {
  line: string;
}

function getLineType(line: string): 'add' | 'remove' | 'context' | 'header' {
  if (line.startsWith('+++') || line.startsWith('---')) {
    return 'header';
  }
  if (line.startsWith('@@')) {
    return 'header';
  }
  if (line.startsWith('+')) {
    return 'add';
  }
  if (line.startsWith('-')) {
    return 'remove';
  }
  return 'context';
}

export function DiffLine({ line }: DiffLineProps) {
  const lineType = getLineType(line);

  const lineStyles = {
    add: 'bg-status-success/20 text-status-success',
    remove: 'bg-status-error/20 text-status-error',
    context: 'text-text-secondary',
    header: 'text-text-tertiary bg-bg-tertiary',
  };

  return (
    <div
      className={cn(
        'font-mono text-sm px-2 py-0.5 whitespace-pre-wrap break-all',
        lineStyles[lineType]
      )}
      data-testid={`diff-line-${lineType}`}
    >
      {line}
    </div>
  );
}

interface DiffBlockProps {
  diff: string;
}

/**
 * Renders a complete unified diff block with colour-coded lines.
 */
export function DiffBlock({ diff }: DiffBlockProps) {
  const lines = diff.split('\n');

  return (
    <div
      className="rounded border border-border-default overflow-hidden"
      data-testid="diff-block"
    >
      {lines.map((line, index) => (
        <DiffLine key={index} line={line} />
      ))}
    </div>
  );
}
