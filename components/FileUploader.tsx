import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { parseExcelFile } from '../utils/excelUtils';
import { SheetData } from '../types';

interface FileUploaderProps {
  onDataLoaded: (data: SheetData) => void;
  label?: string;
  className?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onDataLoaded, label = "นำเข้าไฟล์ Excel", className = "" }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      // @ts-ignore
      const data = await parseExcelFile(file);
      onDataLoaded(data);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการอ่านไฟล์");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer h-full flex flex-col items-center justify-center
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 shadow-lg scale-[1.02]' 
            : 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 shadow-sm'
          }
        `}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className={`p-3 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
            {isLoading ? (
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            ) : (
              <FileSpreadsheet className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
            )}
          </div>
          
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-800">
              {isLoading ? "กำลังประมวลผล..." : label}
            </h3>
            <p className="text-sm text-slate-500">
              {isLoading ? "กำลังอ่านข้อมูล..." : "ลากไฟล์มาวาง หรือคลิกเพื่อเลือก"}
            </p>
          </div>

          {error && (
            <div className="text-red-500 bg-red-50 px-3 py-1 rounded text-xs font-medium mt-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
