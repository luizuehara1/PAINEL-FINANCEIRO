import React from "react";

interface SectionLoaderProps {
  id?: string;
  message?: string;
  rows?: number;
}

export const SectionLoader: React.FC<SectionLoaderProps> = ({
  id,
  message = "Carregando dados...",
  rows = 5,
}) => {
  return (
    <div id={id || "section-loader"} className="w-full space-y-4 py-8 animate-pulse">
      <div className="flex items-center justify-between pb-2">
        <div className="h-4 bg-zinc-800 rounded w-1/4"></div>
        <div className="h-4 bg-zinc-800 rounded w-1/12"></div>
      </div>
      
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center justify-between py-2 border-b border-zinc-900">
            <div className="h-3 bg-zinc-800 rounded w-1/3"></div>
            <div className="h-3 bg-zinc-800 rounded w-1/4"></div>
            <div className="h-3 bg-zinc-800 rounded w-1/6"></div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-zinc-500 font-mono mt-2">{message}</p>
    </div>
  );
};

export default SectionLoader;
