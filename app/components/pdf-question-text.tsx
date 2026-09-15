"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { Streamdown, type Components as StreamdownComponents, type PluginConfig as StreamdownPluginConfig } from "streamdown";
import "streamdown/styles.css";
import "katex/dist/katex.min.css";

const STREAMDOWN_MATH_PLUGIN = createMathPlugin({
  singleDollarTextMath: true,
});
const STREAMDOWN_PLUGINS = {
  cjk,
  code,
  math: STREAMDOWN_MATH_PLUGIN,
  mermaid,
} satisfies StreamdownPluginConfig;


const MARKDOWN_COMPONENTS: StreamdownComponents = {
  h1: ({ children }) => (
    <h1 className="mt-0 border-b border-black/10 pb-2 text-xl font-bold leading-tight text-gray-950 dark:border-white/10 dark:text-gray-50">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-7 text-lg font-bold leading-snug text-gray-950 dark:text-gray-50">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 text-base font-bold leading-snug text-gray-950 dark:text-gray-50">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-4 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="my-3 text-sm leading-7 text-gray-800 dark:text-gray-200">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-5 text-sm leading-7 text-gray-800 dark:text-gray-200">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-5 text-sm leading-7 text-gray-800 dark:text-gray-200">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-gray-300 pl-4 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto border border-black/10 dark:border-white/10">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-r border-black/10 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-900 last:border-r-0 dark:border-white/10 dark:bg-gray-800 dark:text-gray-100">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-r border-black/10 px-3 py-2 align-top text-gray-800 last:border-r-0 dark:border-white/10 dark:text-gray-200">
      {children}
    </td>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto bg-gray-950 p-4 text-xs leading-6 text-gray-100">
      {children}
    </pre>
  ),
  inlineCode: ({ children }) => (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.85em] font-semibold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
      {children}
    </code>
  ),
};


const PAPER_TEXT_COMPONENTS: StreamdownComponents = {
  ...MARKDOWN_COMPONENTS,
  h1: ({ children }) => (
    <h3 className="my-2 text-xl font-semibold leading-snug text-inherit">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h4 className="my-2 text-lg font-semibold leading-snug text-inherit">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h5 className="my-2 text-base font-semibold leading-snug text-inherit">
      {children}
    </h5>
  ),
  p: ({ children }) => (
    <p className="my-2 text-[17px] leading-8 text-inherit">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5 text-[17px] leading-8 text-inherit">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5 text-[17px] leading-8 text-inherit">
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-current/20 pl-4 text-[16px] leading-7 text-inherit">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto border border-current/15">
      <table className="w-full min-w-[480px] border-collapse text-[15px]">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-r border-current/15 bg-current/5 px-3 py-2 text-left font-semibold text-inherit last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-r border-current/15 px-3 py-2 align-top text-inherit last:border-r-0">
      {children}
    </td>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto border border-current/15 bg-current/5 p-4 font-mono text-xs leading-6 text-inherit">
      {children}
    </pre>
  ),
  inlineCode: ({ children }) => (
    <code className="border border-current/15 bg-current/5 px-1 py-0.5 font-mono text-[0.85em] text-inherit">
      {children}
    </code>
  ),
};


export default function PdfQuestionText({ children }: { children: string }) {
  return (
    <Streamdown components={PAPER_TEXT_COMPONENTS} controls mode="static" plugins={STREAMDOWN_PLUGINS}>
      {children}
    </Streamdown>
  );
}
