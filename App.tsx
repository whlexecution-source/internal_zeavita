import React, { useState, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { DataGrid } from './components/DataGrid';
import { runZeavitaETL, runCustomerETL } from './services/etlService';
import { syncToGoogleSheets, fetchFromGoogleSheets } from './services/syncService';
import { detectAnomalies, Anomaly } from './services/anomalyService';
import { exportToCSV, copyToClipboardForSheets } from './utils/excelUtils';
import { SheetData, AppState, DataRow } from './types';
import { 
  Download, 
  Copy, 
  RotateCcw, 
  LayoutTemplate, 
  CheckCircle2,
  DatabaseZap,
  Sheet,
  Play,
  ExternalLink,
  CloudUpload,
  Settings,
  X,
  Users,
  ShoppingCart,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';

// Default Sheet provided
const TARGET_SHEET_URL = "https://docs.google.com/spreadsheets/d/11loA9lb22W__409KQPT1dUfhzjdy0CqNzCMjtc0t-T0";

// Hardcoded Script URLs
const SCRIPT_URLS = {
  main: "https://script.google.com/macros/s/AKfycbz0VglarAhSxnksngV5bqShi-jPzGHUPcoSTDCowK2nsOEgkStZwDVoZ4nE_g7rrSAP/exec",
  reference: "https://script.google.com/macros/s/AKfycbw84OFPaSJ0gJPNGO_M2TbASZFzRXLj0Oz1PtWBEkqgGjDbrISostczAymSfns0CcjAug/exec",
  anomalies: "https://script.google.com/macros/s/AKfycbyXPxEKGysvhyvn3rmIu0vBrNysRWRoERAlLEU-pCyGUlCQlBpKUQyMZPAs6s--FIKutA/exec"
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [rawSheet, setRawSheet] = useState<SheetData | null>(null);
  
  // Datasets
  const [salesData, setSalesData] = useState<DataRow[] | null>(null);
  const [customerData, setCustomerData] = useState<DataRow[] | null>(null);
  const [activeTab, setActiveTab] = useState<'sales' | 'customer'>('sales');

  const [isProcessing, setIsProcessing] = useState(false);
  const [processSummarySales, setProcessSummarySales] = useState<string | null>(null);
  const [processSummaryCustomer, setProcessSummaryCustomer] = useState<string | null>(null);
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  
  const [sheetNames] = useState({
    sales: "sales",
    customer: "customer",
    anomalies: "anomalies",
    logs: "anomaly_logs",
    reference: "reference_data"
  });

  // Anomaly Detection State
  const [showAnomalyModal, setShowAnomalyModal] = useState(false);
  const [refSheet, setRefSheet] = useState<SheetData | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[] | null>(null);
  const [isFetchingRef, setIsFetchingRef] = useState(false);
  const [isCheckingAnomalies, setIsCheckingAnomalies] = useState(false);

  const handleDataLoaded = (data: SheetData) => {
    setRawSheet(data);
    // On load, initially just show raw rows in preview
    setSalesData(data.rows); 
    setCustomerData(null);
    setAppState(AppState.PREVIEW);
    setProcessSummarySales(null);
    setProcessSummaryCustomer(null);
    setSyncResult(null);
    setActiveTab('sales');
  };

  const handleRunETL = () => {
    if (!rawSheet) return;
    setIsProcessing(true);
    setProcessSummarySales(null);
    setProcessSummaryCustomer(null);
    setSyncResult(null);
    
    setTimeout(() => {
        try {
          // Run Sales ETL
          const salesRes = runZeavitaETL(rawSheet.rows);
          setSalesData(salesRes.cleanedData);
          setProcessSummarySales(salesRes.summary);

          // Run Customer ETL
          const customerRes = runCustomerETL(rawSheet.rows);
          setCustomerData(customerRes.cleanedData);
          setProcessSummaryCustomer(customerRes.summary);

          setAppState(AppState.PROCESSED);
        } catch (error: any) {
          alert("ETL Error: " + error.message);
        } finally {
          setIsProcessing(false);
        }
    }, 100);
  };

  const handleSyncToCloud = async () => {
    if (!salesData || !customerData) {
        return;
    }

    setIsSyncing(true);
    setSyncResult(null);
    let log = "";

    try {
        // 1. Sync Sales
        log += "Syncing Sales... ";
        const salesRes = await syncToGoogleSheets(
            salesData, 
            SCRIPT_URLS.main, 
            sheetNames.sales, 
            ['record_id', 'item_label', 'item_product_name']
        );
        
        if (!salesRes.success) throw new Error("Sales Sync Failed: " + salesRes.message);
        log += `Done (+${salesRes.added}, ^${salesRes.updated}).\n`;

        // 2. Sync Customer
        if (customerData.length > 0) {
            log += "Syncing Customer... ";
            
            const custRes = await syncToGoogleSheets(
                customerData, 
                SCRIPT_URLS.main, 
                sheetNames.customer, 
                ['record_id']
            );

            if (!custRes.success) throw new Error("Customer Sync Failed: " + custRes.message);
            log += `Done (+${custRes.added}, ^${custRes.updated}).`;
        } else {
            log += "No Customer data to sync.";
        }

        setSyncResult({ msg: log, type: 'success' });

    } catch (e: any) {
        setSyncResult({ msg: `Error: ${e.message}`, type: 'error' });
    } finally {
        setIsSyncing(false);
    }
  };

  const handleReset = () => {
    if (rawSheet) {
      setSalesData(rawSheet.rows);
      setCustomerData(null);
      setProcessSummarySales(null);
      setProcessSummaryCustomer(null);
      setSyncResult(null);
      setAppState(AppState.PREVIEW);
      setActiveTab('sales');
    }
  };

  const handleExportCSV = () => {
    const dataToExport = activeTab === 'sales' ? salesData : customerData;
    if (dataToExport && rawSheet) {
      exportToCSV(dataToExport, `${rawSheet.name}_${activeTab}`);
    }
  };

  const handleCopyToClipboard = () => {
    const dataToCopy = activeTab === 'sales' ? salesData : customerData;
    if (dataToCopy) {
        copyToClipboardForSheets(dataToCopy);
        alert(`Copied ${activeTab} data to clipboard!`);
    }
  };

  const handleRefDataLoaded = (data: SheetData) => {
    setRefSheet(data);
  };

  const handleFetchRefData = async () => {
    setIsFetchingRef(true);
    try {
        const res = await fetchFromGoogleSheets(SCRIPT_URLS.reference, sheetNames.reference);
        if (res.success && res.data) {
            setRefSheet({
                name: sheetNames.reference,
                rows: res.data,
                columns: Object.keys(res.data[0] || {})
            });
            alert(`Successfully fetched ${res.data.length} rows from '${sheetNames.reference}'.`);
        } else {
            throw new Error(res.message || "No data returned");
        }
    } catch (e: any) {
        alert(`Fetch Failed: ${e.message}`);
    } finally {
        setIsFetchingRef(false);
    }
  };

  const handleAutoAnomalyCheck = async () => {
    const refUrl = SCRIPT_URLS.reference;
    const refSheetName = sheetNames.reference;
    const anomaliesUrl = SCRIPT_URLS.anomalies;
    const anomaliesSheetName = sheetNames.anomalies;

    setIsCheckingAnomalies(true);
    
    try {
        // 2. Fetch Reference Data
        const refRes = await fetchFromGoogleSheets(refUrl, refSheetName);
        if (!refRes.success || !refRes.data) {
            throw new Error("Failed to fetch reference data: " + refRes.message);
        }
        
        const refData: SheetData = {
            name: refSheetName,
            rows: refRes.data,
            columns: Object.keys(refRes.data[0] || {})
        };
        setRefSheet(refData);

        // 3. Detect Anomalies
        if (!rawSheet) throw new Error("No raw data found.");
        const results = detectAnomalies(rawSheet.rows, refData.rows);
        setAnomalies(results);

        // 4. Sync Anomalies (Overwrite)
        const syncRes = await syncToGoogleSheets(
            results as any,
            anomaliesUrl,
            anomaliesSheetName,
            ['key'],
            'overwrite'
        );
        
        if (!syncRes.success) throw new Error("Failed to sync anomalies: " + syncRes.message);
        
        // Success
        if (results.length > 0) {
            alert(`ตรวจสอบเสร็จสิ้น: พบ ${results.length} รายการผิดปกติ และอัปเดตลง Sheet '${anomaliesSheetName}' เรียบร้อยแล้ว`);
        } else {
            alert(`ตรวจสอบเสร็จสิ้น: ไม่พบความผิดปกติ (Sheet '${anomaliesSheetName}' ถูกล้างเรียบร้อยแล้ว)`);
        }

        // 5. Open Modal to show results
        setShowAnomalyModal(true);

    } catch (e: any) {
        alert("Error: " + e.message);
    } finally {
        setIsCheckingAnomalies(false);
    }
  };

  const handleRunAnomalyDetection = () => {
    if (!rawSheet || !refSheet) return;
    const results = detectAnomalies(rawSheet.rows, refSheet.rows);
    setAnomalies(results);
  };

  const handleSyncAnomalies = async () => {
    if (!anomalies || anomalies.length === 0) return;

    setIsSyncing(true);
    
    try {
        // 1. Sync Anomalies (Current State - Overwrite)
        const res = await syncToGoogleSheets(
            anomalies as any, // Cast to DataRow[]
            SCRIPT_URLS.anomalies, 
            sheetNames.anomalies,
            ['key'], // Unique key for anomaly
            'overwrite' // Use overwrite mode
        );

        if (res.success) {
            alert(`Synced ${res.added} anomalies to '${sheetNames.anomalies}'.`);
        } else {
            throw new Error(res.message);
        }

    } catch (e: any) {
        alert(`Sync Failed: ${e.message}`);
    } finally {
        setIsSyncing(false);
    }
  };

  const activeData = activeTab === 'sales' ? salesData : customerData;
  const activeSummary = activeTab === 'sales' ? processSummarySales : processSummaryCustomer;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-green-600 p-2 rounded-lg">
               <Sheet className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Zeavita <span className="text-green-600">ETL</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            {appState !== AppState.UPLOAD && (
                <button 
                  onClick={() => setAppState(AppState.UPLOAD)}
                  className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                    เริ่มใหม่
                </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        
        {appState === AppState.UPLOAD && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center mb-10 max-w-xl">
               <h2 className="text-4xl font-extrabold text-slate-900 mb-4">ระบบจัดการข้อมูล Zeavita</h2>
               <p className="text-lg text-slate-600">
                 อัปโหลดไฟล์ข้อมูลดิบ ระบบจะทำความสะอาด, สรุปยอดขายและลูกค้า, และซิงค์ไปยัง Google Sheets อัตโนมัติ
               </p>
            </div>
            <FileUploader onDataLoaded={handleDataLoaded} className="max-w-2xl mx-auto" label="คลิกเพื่ออัปโหลดไฟล์ หรือลากไฟล์มาวางที่นี่" />
          </div>
        )}

        {(appState === AppState.PREVIEW || appState === AppState.PROCESSED) && rawSheet && activeData && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-full">
            
            {/* Sidebar Controls */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm sticky top-24">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">ขั้นตอนการทำงาน</h3>
                
                <div className="space-y-4">
                   {appState === AppState.PREVIEW && (
                       <button
                         onClick={handleRunETL}
                         disabled={isProcessing}
                         className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 rounded-lg transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                       >
                         {isProcessing ? <DatabaseZap className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4 fill-current" />}
                         {isProcessing ? "กำลังประมวลผล..." : "1. เริ่มประมวลผลข้อมูล"}
                       </button>
                   )}

                   {appState === AppState.PROCESSED && (
                     <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                         <div className="p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-100 flex gap-2 mb-4">
                             <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-600" />
                             ประมวลผลเสร็จสิ้น
                         </div>
                         
                         <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ตรวจสอบความถูกต้อง</h3>
                         <button
                             onClick={handleAutoAnomalyCheck}
                             disabled={isCheckingAnomalies}
                             className={`w-full flex items-center justify-center gap-2 font-medium py-3 rounded-lg transition-all shadow-md text-sm mb-4 ${
                                isCheckingAnomalies 
                                    ? 'bg-amber-100 text-amber-700 cursor-wait' 
                                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                             }`}
                         >
                             {isCheckingAnomalies ? <RotateCcw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                             {isCheckingAnomalies ? "กำลังตรวจสอบ..." : "2. ตรวจสอบความผิดปกติ"}
                         </button>

                         <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ซิงค์ข้อมูลทั้งหมด</h3>
                         
                         <button
                            onClick={handleSyncToCloud}
                            disabled={isSyncing}
                            className={`
                                w-full flex items-center justify-center gap-2 font-medium py-3 rounded-lg transition-all shadow-md text-sm
                                ${isSyncing 
                                    ? 'bg-green-100 text-green-700 cursor-wait' 
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }
                            `}
                         >
                            {isSyncing ? <CloudUpload className="w-4 h-4 animate-bounce" /> : <CloudUpload className="w-4 h-4" />}
                            {isSyncing ? "กำลังซิงค์..." : "3. ซิงค์ลง Google Sheet"}
                         </button>

                         {syncResult && (
                             <div className={`text-xs p-2 rounded border whitespace-pre-wrap ${syncResult.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                 {syncResult.msg}
                             </div>
                         )}

                         <div className="pt-4 border-t border-slate-100">
                             <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">ตัวเลือกเพิ่มเติม</h3>
                            
                            <a 
                                href={TARGET_SHEET_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-green-50 text-slate-600 hover:text-green-700 border border-slate-200 text-sm font-medium py-2 rounded-lg transition-colors mb-2"
                            >
                                <ExternalLink className="w-4 h-4" />
                                เปิด Google Sheet
                            </a>

                             <button 
                                onClick={handleCopyToClipboard}
                                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors shadow-sm"
                            >
                                <Copy className="w-4 h-4" />
                                คัดลอก {activeTab === 'sales' ? 'ยอดขาย' : 'ลูกค้า'}
                            </button>
                            
                             <button 
                                onClick={handleExportCSV}
                                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium py-2 rounded-lg transition-colors shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                ดาวน์โหลด CSV
                            </button>
                         </div>

                         <button 
                           onClick={handleReset}
                           className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 text-xs py-2 mt-2"
                         >
                            <RotateCcw className="w-3 h-3" />
                            เริ่มใหม่
                         </button>
                     </div>
                   )}
                </div>
              </div>

            </div>

            {/* Main Data View */}
            <div className="lg:col-span-3 flex flex-col h-[600px] lg:h-auto">
              <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <LayoutTemplate className="w-5 h-5 text-slate-500" />
                    {appState === AppState.PREVIEW ? "ข้อมูลดิบ (Original Data): " : (
                        activeTab === 'sales' ? "ข้อมูลยอดขาย (Cleaned)" : "ข้อมูลลูกค้า (Cleaned)"
                    )}
                    <span className="text-xs font-normal text-slate-400 ml-2 bg-slate-100 px-2 py-0.5 rounded-full">
                        {activeData.length} แถว
                    </span>
                 </h2>

                 {appState === AppState.PROCESSED && (
                     <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('sales')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'sales' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <ShoppingCart className="w-4 h-4" />
                            ยอดขาย
                        </button>
                        <button 
                            onClick={() => setActiveTab('customer')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'customer' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Users className="w-4 h-4" />
                            ลูกค้า
                        </button>
                     </div>
                 )}
              </div>

              {activeSummary && (
                <div className="mb-4 bg-green-50 border border-green-100 p-4 rounded-lg animate-in fade-in">
                   <p className="text-xs text-green-800 font-mono whitespace-pre-wrap leading-relaxed">{activeSummary}</p>
                </div>
              )}

              <DataGrid data={activeData} highlight={appState === AppState.PROCESSED} />
            </div>

          </div>
        )}

      </main>
    </div>
  );
};

export default App;
