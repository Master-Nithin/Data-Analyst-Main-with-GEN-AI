import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileSpreadsheet, Brain, TrendingUp, Database, Settings, Key, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

// Type Definitions
interface DataRow extends Array<string> {}

interface ColumnAnalysis {
  name: string;
  totalValues: number;
  numericValues: number;
  isNumeric: boolean;
  completeness: string;
}

interface Statistics {
  totalRows: number;
  totalColumns: number;
  dataPoints: number;
  columnAnalysis?: ColumnAnalysis[];
  numericColumns?: ColumnAnalysis[];
}

interface ChartDataPoint {
  index: number;
  [key: string]: number;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

type ActiveTab = 'upload' | 'settings';

const DataAnalysisAgent: React.FC = () => {
  const [data, setData] = useState<DataRow[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [aiInsights, setAiInsights] = useState<string>('');
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState<string>('');
  const [stats, setStats] = useState<Statistics>({
    totalRows: 0,
    totalColumns: 0,
    dataPoints: 0
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const COLORS: string[] = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb7185'];

  // Load saved API key on component mount
  useEffect(() => {
    console.log('Component mounted - ready for API key input');
  }, []);

  const saveApiKey = (): void => {
    if (geminiApiKey.trim()) {
      showSuccess('API key saved successfully!');
    }
  };

  const showSuccess = (message: string): void => {
    setError('');
    console.log('Success:', message);
  };

  const showError = (message: string): void => {
    setError(message);
    setLoading(false);
    setAnalyzing(false);
  };

  const parseCSV = (text: string): DataRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');

    try {
      let parsedData: DataRow[];
      
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        parsedData = parseCSV(text);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        showError('Excel file support requires additional libraries. Please use CSV format for now.');
        return;
      } else {
        showError('Unsupported file format. Please use CSV files.');
        return;
      }

      if (parsedData && parsedData.length > 0) {
        const newHeaders = parsedData[0];
        const newData = parsedData.slice(1);
        setHeaders(newHeaders);
        setData(newData);
        analyzeData(newHeaders, newData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      showError(`Error reading file: ${errorMessage}`);
    }
  };

  const loadGoogleSheet = async (): Promise<void> => {
    if (!googleSheetsUrl.trim()) {
      showError('Please enter a Google Sheets URL');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let csvUrl = googleSheetsUrl;
      if (googleSheetsUrl.includes('/edit')) {
        csvUrl = googleSheetsUrl.replace('/edit#gid=', '/export?format=csv&gid=');
        csvUrl = csvUrl.replace('/edit', '/export?format=csv');
      }

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch Google Sheet. Make sure it\'s publicly viewable.');
      }

      const csvText = await response.text();
      const parsedData = parseCSV(csvText);
      
      if (parsedData && parsedData.length > 0) {
        const newHeaders = parsedData[0];
        const newData = parsedData.slice(1);
        setHeaders(newHeaders);
        setData(newData);
        analyzeData(newHeaders, newData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      showError(`Error loading Google Sheet: ${errorMessage}`);
    }
  };

  const analyzeData = (headers: string[], data: DataRow[]): void => {
    if (!data || data.length === 0) return;

    // Calculate basic statistics
    const basicStats: Statistics = {
      totalRows: data.length,
      totalColumns: headers.length,
      dataPoints: data.length * headers.length
    };

    // Analyze columns
    const columnAnalysis: ColumnAnalysis[] = headers.map((header, index) => {
      const values = data.map(row => row[index]).filter(val => val && val.trim() !== '');
      const numericValues = values.filter(val => !isNaN(parseFloat(val)));
      
      return {
        name: header,
        totalValues: values.length,
        numericValues: numericValues.length,
        isNumeric: numericValues.length > values.length * 0.7,
        completeness: (values.length / data.length * 100).toFixed(1)
      };
    });

    // Find numeric columns and create chart data
    const numericColumns = columnAnalysis.filter(col => col.isNumeric);
    let chartData: ChartDataPoint[] = [];

    if (numericColumns.length > 0) {
      chartData = data.slice(0, 20).map((row, index) => {
        const point: ChartDataPoint = { index: index + 1 };
        numericColumns.forEach(col => {
          const colIndex = headers.indexOf(col.name);
          const value = parseFloat(row[colIndex]);
          point[col.name] = isNaN(value) ? 0 : value;
        });
        return point;
      });
    }

    const updatedStats = { ...basicStats, columnAnalysis, numericColumns };
    setStats(updatedStats);
    setChartData(chartData);
    setLoading(false);

    // Generate AI insights if API key is available
    if (geminiApiKey.trim()) {
      generateAIInsights(headers, data, updatedStats);
    }
  };

  const generateAIInsights = async (headers: string[], data: DataRow[], stats: Statistics): Promise<void> => {
    if (!geminiApiKey.trim()) {
      showError('Please add your Gemini API key to get AI insights');
      return;
    }

    setAnalyzing(true);

    try {
      const fullData = data.map(row => 
  headers.reduce((obj: Record<string, string>, header, idx) => {
    obj[header] = row[idx] || '';
    return obj;
  }, {})
);

     const prompt = `
You are a senior data analyst. Analyze the dataset and provide insights with a strong focus on **comparisons and relationships** between columns.

### Dataset Overview
- Total Rows: ${stats.totalRows}
- Total Columns: ${stats.totalColumns}
- Headers: ${headers.join(', ')}

### Column Analysis
${stats.columnAnalysis?.map(col => 
  `- ${col.name}: ${col.isNumeric ? 'Numeric' : 'Text'} | Completeness: ${col.completeness}% | Total Values: ${col.totalValues}`
).join('\n')}

### Sample Data (first 5 rows)
${JSON.stringify(fullData, null, 2)}

### Your Task
1. **Comparisons & Rankings**
   - Identify **who/what is earning more** (if there's a salary, income, or numeric column).  
   - Rank the top and bottom values for key numeric columns.  
   - Highlight any big gaps or inequalities.  

2. **Relationships Between Variables**
   - Show if higher earnings are linked to other columns (e.g., age, role, department, city, education).  
   - Compare categories (e.g., which department earns more, which region spends more, etc.).  

3. **Trends & Patterns**
   - Detect patterns across the dataset (e.g., does income rise with experience? Do certain groups perform better?).  

4. **Actionable Insights**
   - Summarize in plain language: *"People in X group earn 20% more than Y group"*.  
   - Suggest what kind of questions a business can ask from this dataset.  

### Output Format
Provide insights in **markdown** with:
- Headings for each section
- Bullet points for findings
- Simple comparative statements (e.g., "Group A earns more than Group B").
`;

      // Updated API call with correct endpoint and headers
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API Error:', errorData);
        throw new Error(`API request failed: ${response.status} ${response.statusText}. Check your API key and ensure it's valid.`);
      }

      const result: GeminiResponse = await response.json();
      const aiResponse = result.candidates[0]?.content?.parts[0]?.text || 'No insights generated';
      setAiInsights(aiResponse);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      showError(`Error generating AI insights: ${errorMessage}`);
      console.error('Full error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const renderDataPreview = () => {
    if (!data || data.length === 0) return null;

    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center">
          <Database className="mr-2 w-5 h-5" /> Data Preview
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                {headers.map((header, idx) => (
                  <th key={idx} className="px-4 py-3 text-left font-medium text-gray-300">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, idx) => (
                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/50">
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-4 py-3 text-gray-400">
                      {cell || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 10 && (
            <p className="text-gray-500 text-sm mt-3">
              Showing 10 of {data.length} rows
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderStats = () => {
    if (!stats.totalRows) return null;

    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center">
          <TrendingUp className="mr-2 w-5 h-5" /> Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-semibold text-blue-400">{stats.totalRows.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">Total Rows</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-semibold text-green-400">{stats.totalColumns}</div>
            <div className="text-gray-400 text-sm">Columns</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-2xl font-semibold text-yellow-400">{stats.dataPoints?.toLocaleString()}</div>
            <div className="text-gray-400 text-sm">Data Points</div>
          </div>
        </div>
        
        {stats.numericColumns && stats.numericColumns.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-gray-300 mb-3">Numeric Columns:</h4>
            <div className="flex flex-wrap gap-2">
              {stats.numericColumns.map((col, idx) => (
                <span key={idx} className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-sm border border-blue-600/30">
                  {col.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderChart = () => {
    if (!chartData || chartData.length === 0) return null;

    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-medium text-white mb-4">Visualization</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="index" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '0.5rem',
                  color: '#F9FAFB'
                }}
              />
              {stats.numericColumns?.slice(0, 3).map((col, idx) => (
                <Line 
                  key={idx}
                  type="monotone" 
                  dataKey={col.name} 
                  stroke={COLORS[idx]} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">
            Data Analysis Agent
          </h1>
          <p className="text-gray-400">Upload your data and get intelligent insights</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800 rounded-lg p-1 border border-gray-700">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                activeTab === 'upload' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Upload className="inline mr-2 w-4 h-4" />
              Upload
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                activeTab === 'settings' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Settings className="inline mr-2 w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center">
              <Key className="mr-2 w-5 h-5" /> API Configuration
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Gemini API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
                  />
                  <button
                    onClick={saveApiKey}
                    disabled={!geminiApiKey.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 mb-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* File Upload */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                  <FileSpreadsheet className="mr-2 w-5 h-5" /> Upload File
                </h3>
                <div 
                  className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-700/30"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mx-auto mb-4 w-10 h-10 text-gray-500" />
                  <p className="text-gray-300 mb-2">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-500">CSV files supported</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Google Sheets */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Google Sheets</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={googleSheetsUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGoogleSheetsUrl(e.target.value)}
                    placeholder="Paste Google Sheets URL here"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
                  />
                  <button
                    onClick={loadGoogleSheet}
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : null}
                    Load Sheet
                  </button>
                  <p className="text-sm text-gray-500">
                    Sheet must be publicly viewable
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 mb-6 flex items-center">
            <AlertCircle className="text-red-400 mr-2 w-5 h-5" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* Loading States */}
        {loading && (
          <div className="text-center py-16">
            <Loader2 className="animate-spin mx-auto mb-4 w-10 h-10 text-blue-500" />
            <p className="text-gray-400">Processing your data...</p>
          </div>
        )}

        {/* Results */}
        {data && !loading && (
          <>
            {renderDataPreview()}
            {renderStats()}
            {renderChart()}

            {/* AI Insights Section */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white flex items-center">
                  <Brain className="mr-2 w-5 h-5" /> AI Insights
                </h3>
                {!geminiApiKey.trim() && (
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="text-sm bg-yellow-600/20 text-yellow-400 px-3 py-1 rounded-full hover:bg-yellow-600/30 transition-colors border border-yellow-600/30"
                  >
                    Add API Key
                  </button>
                )}
              </div>

              {analyzing && (
                <div className="text-center py-8">
                  <Loader2 className="animate-spin mx-auto mb-4 w-6 h-6 text-blue-500" />
                  <p className="text-gray-400">Generating AI insights...</p>
                </div>
              )}

              {aiInsights && !analyzing && (
                <div className="bg-gray-700 rounded-lg p-6">
                  <pre className="whitespace-pre-wrap text-gray-300 font-sans text-sm leading-relaxed">
                    {aiInsights}
                  </pre>
                </div>
              )}

              {!aiInsights && !analyzing && geminiApiKey.trim() && data && (
                <button
                  onClick={() => generateAIInsights(headers, data, stats)}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <Brain className="mr-2 w-4 h-4" />
                  Generate AI Insights
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DataAnalysisAgent;