import React from 'react';
import { DataRow } from '../types';

interface DataGridProps {
  data: DataRow[];
  highlight?: boolean;
}

export const DataGrid: React.FC<DataGridProps> = ({ data, highlight }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
        No data to display
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 font-semibold border-b border-slate-200 w-16 text-center">#</th>
              {columns.map((col) => (
                <th key={col} className="px-6 py-3 font-semibold border-b border-slate-200 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, idx) => (
              <tr 
                key={idx} 
                className={`
                  group transition-colors
                  ${highlight && idx % 2 === 0 ? 'bg-blue-50/30' : 'bg-white'} 
                  hover:bg-slate-50
                `}
              >
                <td className="px-6 py-3 text-slate-400 font-mono text-xs text-center border-r border-slate-100">
                  {idx + 1}
                </td>
                {columns.map((col) => (
                  <td key={`${idx}-${col}`} className="px-6 py-3 text-slate-700 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis">
                    {row[col]?.toString() || <span className="text-slate-300 italic">null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-50 px-4 py-2 text-xs text-slate-500 border-t border-slate-200 flex justify-between">
        <span>Showing {data.length} rows</span>
        <span>{columns.length} columns</span>
      </div>
    </div>
  );
};
