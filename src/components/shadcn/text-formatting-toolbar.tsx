import React from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Heading1, 
  Heading2, 
  Heading3,
  List, 
  ListOrdered, 
  Link, 
  Code, 
  Quote,
  Minus
} from 'lucide-react';
import { Button } from './button';
import { Separator } from './separator';

interface TextFormattingToolbarProps {
  onFormat: (type: string, value?: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function TextFormattingToolbar({ onFormat, textareaRef }: TextFormattingToolbarProps) {
  const insertText = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const textToInsert = selectedText || placeholder;
    
    const newText = before + textToInsert + after;
    const newValue = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
    
    // Update the textarea value
    textarea.value = newValue;
    
    // Set cursor position
    const newCursorPos = start + before.length + textToInsert.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    
    // Trigger change event
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
    
    // Focus back on textarea
    textarea.focus();
  };

  const insertAtLineStart = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const value = textarea.value;
    
    // Find the start of the current line
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    
    const newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart);
    textarea.value = newValue;
    
    // Position cursor after the inserted prefix
    const newCursorPos = start + prefix.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    
    // Trigger change event
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
    
    textarea.focus();
  };

  const formatOptions = [
    {
      type: 'bold',
      icon: Bold,
      tooltip: 'Bold',
      action: () => insertText('**', '**', 'bold text')
    },
    {
      type: 'italic',
      icon: Italic,
      tooltip: 'Italic',
      action: () => insertText('*', '*', 'italic text')
    },
    {
      type: 'underline',
      icon: Underline,
      tooltip: 'Underline',
      action: () => insertText('<u>', '</u>', 'underlined text')
    },
    {
      type: 'separator'
    },
    {
      type: 'h1',
      icon: Heading1,
      tooltip: 'Heading 1',
      action: () => insertAtLineStart('# ')
    },
    {
      type: 'h2',
      icon: Heading2,
      tooltip: 'Heading 2',
      action: () => insertAtLineStart('## ')
    },
    {
      type: 'h3',
      icon: Heading3,
      tooltip: 'Heading 3',
      action: () => insertAtLineStart('### ')
    },
    {
      type: 'separator'
    },
    {
      type: 'ul',
      icon: List,
      tooltip: 'Bullet List',
      action: () => insertAtLineStart('• ')
    },
    {
      type: 'ol',
      icon: ListOrdered,
      tooltip: 'Numbered List',
      action: () => insertAtLineStart('1. ')
    },
    {
      type: 'separator'
    },
    {
      type: 'link',
      icon: Link,
      tooltip: 'Insert Link',
      action: () => insertText('[', '](url)', 'link text')
    },
    {
      type: 'code',
      icon: Code,
      tooltip: 'Code Block',
      action: () => insertText('```\n', '\n```', 'code here')
    },
    {
      type: 'quote',
      icon: Quote,
      tooltip: 'Quote',
      action: () => insertAtLineStart('> ')
    },
    {
      type: 'separator'
    },
    {
      type: 'divider',
      icon: Minus,
      tooltip: 'Horizontal Rule',
      action: () => insertText('\n---\n', '', '')
    }
  ];

  return (
    <div className="flex items-center gap-1 p-3 bg-gray-50 border-b border-gray-200">
      {formatOptions.map((option, index) => {
        if (option.type === 'separator') {
          return (
            <Separator 
              key={`separator-${index}`} 
              orientation="vertical" 
              className="h-6 mx-1" 
            />
          );
        }

        const Icon = option.icon;
        return (
          <Button
            key={option.type}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-gray-200"
            onClick={option.action}
            title={option.tooltip}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
