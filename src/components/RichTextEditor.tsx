import React, { useRef, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
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
import { Button } from './ui/button';
import { Separator } from './ui/separator';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Configure DOMPurify for safe HTML
  const purifyConfig = {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'a', 'hr'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'style'],
  };

  // Initialize editor content with sanitization
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      const sanitizedValue = value ? DOMPurify.sanitize(value, purifyConfig) : '';
      editorRef.current.innerHTML = sanitizedValue;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      // Sanitize content before passing to parent
      const sanitizedContent = DOMPurify.sanitize(content, purifyConfig);
      onChange(sanitizedContent);
    }
  };

  const executeCommand = (command: string, value: string = '') => {
    // Use modern API when available, fallback to execCommand
    if (editorRef.current) {
      try {
        // Sanitize any value input (e.g., URLs)
        const sanitizedValue = value ? DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) : '';
        document.execCommand(command, false, sanitizedValue);
        editorRef.current.focus();
        handleInput();
      } catch (error) {
        console.warn('Command execution failed:', error);
      }
    }
  };

  const insertHTML = (html: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      const div = document.createElement('div');
      div.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node;
      while ((node = div.firstChild)) {
        frag.appendChild(node);
      }
      range.insertNode(frag);
    }
    handleInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          executeCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          executeCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          executeCommand('underline');
          break;
      }
    }
  };

  const formatOptions = [
    {
      type: 'bold',
      icon: Bold,
      tooltip: 'Bold (Ctrl+B)',
      action: () => executeCommand('bold')
    },
    {
      type: 'italic',
      icon: Italic,
      tooltip: 'Italic (Ctrl+I)',
      action: () => executeCommand('italic')
    },
    {
      type: 'underline',
      icon: Underline,
      tooltip: 'Underline (Ctrl+U)',
      action: () => executeCommand('underline')
    },
    {
      type: 'separator'
    },
    {
      type: 'h1',
      icon: Heading1,
      tooltip: 'Heading 1',
      action: () => executeCommand('formatBlock', 'h1')
    },
    {
      type: 'h2',
      icon: Heading2,
      tooltip: 'Heading 2',
      action: () => executeCommand('formatBlock', 'h2')
    },
    {
      type: 'h3',
      icon: Heading3,
      tooltip: 'Heading 3',
      action: () => executeCommand('formatBlock', 'h3')
    },
    {
      type: 'separator'
    },
    {
      type: 'ul',
      icon: List,
      tooltip: 'Bullet List',
      action: () => executeCommand('insertUnorderedList')
    },
    {
      type: 'ol',
      icon: ListOrdered,
      tooltip: 'Numbered List',
      action: () => executeCommand('insertOrderedList')
    },
    {
      type: 'separator'
    },
    {
      type: 'link',
      icon: Link,
      tooltip: 'Insert Link',
      action: () => {
        const url = prompt('Enter URL:');
        if (url) {
          // Basic URL validation
          try {
            const validUrl = new URL(url);
            if (validUrl.protocol === 'http:' || validUrl.protocol === 'https:') {
              executeCommand('createLink', url);
            } else {
              console.warn('Invalid URL protocol');
            }
          } catch (error) {
            console.warn('Invalid URL format');
          }
        }
      }
    },
    {
      type: 'code',
      icon: Code,
      tooltip: 'Code Block',
      action: () => executeCommand('formatBlock', 'pre')
    },
    {
      type: 'quote',
      icon: Quote,
      tooltip: 'Quote',
      action: () => executeCommand('formatBlock', 'blockquote')
    },
    {
      type: 'separator'
    },
    {
      type: 'divider',
      icon: Minus,
      tooltip: 'Horizontal Rule',
      action: () => executeCommand('insertHorizontalRule')
    }
  ];

  return (
    <div className="rich-text-editor flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
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
              type="button"
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>

      {/* Editor */}
      <div className="relative flex-1">
        <div
          ref={editorRef}
          contentEditable
          className={`w-full h-full min-h-[400px] p-4 outline-none ${className || ''}`}
          style={{
            fontSize: '15px',
            lineHeight: '1.7',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          suppressContentEditableWarning={true}
        />
        
        {/* Placeholder */}
        {!value && !isFocused && placeholder && (
          <div 
            className="absolute top-4 left-4 text-gray-400 pointer-events-none select-none"
            style={{
              fontSize: '15px',
              lineHeight: '1.7',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            {placeholder.split('\n').map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .rich-text-editor [contenteditable="true"] h1 {
          font-size: 1.875rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem 0;
          line-height: 1.2;
        }
        
        .rich-text-editor [contenteditable="true"] h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0.875rem 0 0.5rem 0;
          line-height: 1.3;
        }
        
        .rich-text-editor [contenteditable="true"] h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.75rem 0 0.5rem 0;
          line-height: 1.4;
        }
        
        .rich-text-editor [contenteditable="true"] ul {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        
        .rich-text-editor [contenteditable="true"] ol {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }
        
        .rich-text-editor [contenteditable="true"] li {
          margin: 0.25rem 0;
        }
        
        .rich-text-editor [contenteditable="true"] blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
          color: #6b7280;
        }
        
        .rich-text-editor [contenteditable="true"] pre {
          background-color: #f3f4f6;
          padding: 1rem;
          border-radius: 0.375rem;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
          margin: 0.5rem 0;
          white-space: pre-wrap;
        }
        
        .rich-text-editor [contenteditable="true"] a {
          color: #3b82f6;
          text-decoration: underline;
        }
        
        .rich-text-editor [contenteditable="true"] hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1.5rem 0;
        }
      `}} />
    </div>
  );
}