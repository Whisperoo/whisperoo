import React from 'react';
import { useNavigate } from 'react-router-dom';

interface MarkdownTextProps {
  content: string;
  className?: string;
}

const MarkdownText: React.FC<MarkdownTextProps> = ({ content, className = "" }) => {
  const navigate = useNavigate();
  
  // Split content into lines for processing
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ordered' | 'unordered'; items: string[] } | null = null;

  const processInlineMarkdown = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Find doctor profile links [Dr. Name's profile](/experts/id)
      const doctorLinkMatch = remaining.match(/\[([^\]]*(?:profile|Dr\.|doctor)[^\]]*)\]\(\/experts\/([^)]+)\)/i);
      if (doctorLinkMatch && doctorLinkMatch.index !== undefined) {
        // Add text before link
        if (doctorLinkMatch.index > 0) {
          parts.push(remaining.substring(0, doctorLinkMatch.index));
        }
        // Add doctor profile link
        const linkText = doctorLinkMatch[1];
        const doctorId = doctorLinkMatch[2];
        parts.push(
          <button
            key={`doctor-link-${key++}`}
            onClick={() => navigate(`/experts/${doctorId}`)}
            className="text-action-primary hover:text-indigo-800 underline font-medium cursor-pointer bg-transparent border-none p-0 inline"
          >
            {linkText}
          </button>
        );
        remaining = remaining.substring(doctorLinkMatch.index + doctorLinkMatch[0].length);
      } else {
        // Find bold text (**text**)
        const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
        if (boldMatch && boldMatch.index !== undefined) {
          // Add text before bold
          if (boldMatch.index > 0) {
            parts.push(remaining.substring(0, boldMatch.index));
          }
          // Add bold text
          parts.push(
            <strong key={`bold-${key++}`} className="font-semibold">
              {boldMatch[1]}
            </strong>
          );
          remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
        } else {
          // Find italic text (*text*)
          const italicMatch = remaining.match(/\*(.*?)\*/);
          if (italicMatch && italicMatch.index !== undefined) {
            // Add text before italic
            if (italicMatch.index > 0) {
              parts.push(remaining.substring(0, italicMatch.index));
            }
            // Add italic text
            parts.push(
              <em key={`italic-${key++}`} className="italic">
                {italicMatch[1]}
              </em>
            );
            remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
          } else {
            // No more markdown, add remaining text
            parts.push(remaining);
            break;
          }
        }
      }
    }

    return parts;
  };

  const finishCurrentList = () => {
    if (currentList) {
      // Always render as bullet lists
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-2">
          {currentList.items.map((item, index) => (
            <li key={index} className="ml-2">
              {processInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      currentList = null;
    }
  };

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (trimmedLine === '') {
      finishCurrentList();
      if (elements.length > 0) {
        elements.push(<br key={`br-${lineIndex}`} />);
      }
      return;
    }

    // Check for numbered lists (1. , 2. , etc.) - convert to bullet lists or headings
    const numberedListMatch = trimmedLine.match(/^\d+\.\s+(.*)$/);
    if (numberedListMatch) {
      const content = numberedListMatch[1];

      // If the content ends with a colon, treat it as a heading (remove the colon)
      if (content.endsWith(':')) {
        finishCurrentList();
        const headingText = content.slice(0, -1); // Remove the trailing colon
        elements.push(
          <p key={`heading-${lineIndex}`} className="mb-2 mt-4 font-semibold">
            {processInlineMarkdown(headingText)}
          </p>
        );
        return;
      }

      // Otherwise, treat as bullet points
      if (currentList?.type !== 'unordered') {
        finishCurrentList();
        currentList = { type: 'unordered', items: [] };
      }
      currentList.items.push(content);
      return;
    }

    // Check for bullet lists (- or •)
    const bulletListMatch = trimmedLine.match(/^[-•]\s+(.*)$/);
    if (bulletListMatch) {
      const content = bulletListMatch[1];

      // If the content ends with a colon, treat it as a heading (remove the colon)
      if (content.endsWith(':')) {
        finishCurrentList();
        const headingText = content.slice(0, -1); // Remove the trailing colon
        elements.push(
          <p key={`heading-${lineIndex}`} className="mb-2 mt-4 font-semibold">
            {processInlineMarkdown(headingText)}
          </p>
        );
        return;
      }

      // Otherwise, treat as bullet points
      if (currentList?.type !== 'unordered') {
        finishCurrentList();
        currentList = { type: 'unordered', items: [] };
      }
      currentList.items.push(content);
      return;
    }

    // Regular paragraph text
    finishCurrentList();
    
    if (trimmedLine.length > 0) {
      elements.push(
        <p key={`p-${lineIndex}`} className="mb-2 last:mb-0">
          {processInlineMarkdown(trimmedLine)}
        </p>
      );
    }
  });

  // Finish any remaining list
  finishCurrentList();

  return (
    <div className={`${className}`}>
      {elements}
    </div>
  );
};

export default MarkdownText;