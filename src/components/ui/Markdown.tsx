'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renderiza markdown (respostas do agente) usando apenas tokens do design system,
 * de forma que funcione nos dois temas (claro/escuro) sem cores hardcoded.
 * Cor base do texto é herdada do container pai (ex.: text-bento-text da bolha).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="font-display font-semibold text-base mt-3 mb-1">{children}</h3>,
          h2: ({ children }) => <h3 className="font-display font-semibold text-sm mt-3 mb-1">{children}</h3>,
          h3: ({ children }) => <h4 className="font-display font-semibold text-sm mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-lime-fg underline underline-offset-2">{children}</a>
          ),
          hr: () => <hr className="border-bento-border my-2" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-bento-border pl-3 text-bento-muted">{children}</blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className || '')
            return isBlock
              ? <code className="font-tech text-xs">{children}</code>
              : <code className="font-tech text-[0.85em] bg-bento-border/40 px-1 py-0.5 rounded">{children}</code>
          },
          pre: ({ children }) => (
            <pre className="font-tech text-xs bg-bento-bg border border-bento-border rounded-btn p-2 overflow-x-auto my-2">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto"><table className="w-full text-xs border-collapse">{children}</table></div>
          ),
          th: ({ children }) => <th className="border border-bento-border px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-bento-border px-2 py-1">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
