'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { BookMarked, ChevronDown, Check } from 'lucide-react';
import { type CitationStyle, CITATION_STYLES } from '@/lib/citation';

interface CitationStyleSelectorProps {
  value: CitationStyle;
  onChange: (style: CitationStyle) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function CitationStyleSelector({
  value,
  onChange,
  disabled = false,
  compact = false,
}: CitationStyleSelectorProps) {
  const currentStyle = CITATION_STYLES[value];
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button 
          variant="outline" 
          size={compact ? 'sm' : 'default'}
          className="gap-2"
        >
          <BookMarked className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          {compact ? currentStyle.style.toUpperCase() : currentStyle.name}
          <ChevronDown className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Citation Style</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as CitationStyle)}>
          {Object.entries(CITATION_STYLES).map(([key, style]) => (
            <DropdownMenuRadioItem
              key={key}
              value={key}
              className="flex flex-col items-start gap-1 py-2.5"
            >
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium">{style.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {style.inTextFormat === 'numeric' ? '[1]' : '(Author, Year)'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-normal">
                {style.description}
              </p>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Inline citation style badge
interface CitationStyleBadgeProps {
  style: CitationStyle;
  onClick?: () => void;
}

export function CitationStyleBadge({ style, onClick }: CitationStyleBadgeProps) {
  const styleInfo = CITATION_STYLES[style];
  
  return (
    <Badge 
      variant="outline" 
      className="gap-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <BookMarked className="w-3 h-3" />
      {styleInfo.name}
    </Badge>
  );
}

// Style preview component
interface CitationStylePreviewProps {
  style: CitationStyle;
}

export function CitationStylePreview({ style }: CitationStylePreviewProps) {
  const styleInfo = CITATION_STYLES[style];
  
  const getExampleCitation = () => {
    switch (style) {
      case 'apa':
        return {
          inText: '(Smith & Jones, 2023)',
          reference: 'Smith, J. A., & Jones, B. C. (2023). Article title here. *Journal Name*, *45*(2), 123–145. https://doi.org/10.xxxx/xxxxx',
        };
      case 'mla':
        return {
          inText: '(Smith and Jones)',
          reference: 'Smith, John A., and Bob C. Jones. "Article Title Here." *Journal Name*, vol. 45, no. 2, 2023, pp. 123-145.',
        };
      case 'chicago':
        return {
          inText: '(Smith and Jones 2023)',
          reference: 'Smith, John A., and Bob C. Jones. 2023. "Article Title Here." *Journal Name* 45, no. 2: 123–145.',
        };
      case 'ieee':
        return {
          inText: '[1]',
          reference: '[1] J. A. Smith and B. C. Jones, "Article Title Here," *Journal Name*, vol. 45, no. 2, pp. 123–145, 2023.',
        };
      case 'gbt7714':
        return {
          inText: '[1]',
          reference: '[1] SMITH J A, JONES B C. Article title here[J]. Journal Name, 2023, 45(2): 123-145.',
        };
    }
  };
  
  const example = getExampleCitation();
  
  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{styleInfo.name}</Badge>
        <span className="text-xs text-muted-foreground">{styleInfo.description}</span>
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-xs text-muted-foreground block mb-1">In-text citation:</span>
          <code className="bg-background px-2 py-1 rounded text-primary">
            {example.inText}
          </code>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block mb-1">Reference:</span>
          <div 
            className="bg-background p-2 rounded text-xs"
            dangerouslySetInnerHTML={{ 
              __html: example.reference.replace(/\*([^*]+)\*/g, '<em>$1</em>') 
            }}
          />
        </div>
      </div>
    </div>
  );
}









