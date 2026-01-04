import { useState, useEffect } from 'react';
import type { PortalUser } from '@shared/types';

const API_BASE = import.meta.env.VITE_MSSQL_API_URL || 'http://192.168.0.173:3100';

interface Database {
  name: string;
  id: number;
}

interface TableInfo {
  name: string;
  rows: number;
  schema: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  max_length: number;
  is_nullable: boolean;
  is_primary: boolean;
}

interface QueryResult {
  columns: string[];
  rows: any[][];
  message?: string;
  error?: string;
}

interface DbAdminAppProps {
  user: PortalUser;
}

function DbAdminApp({ user }: DbAdminAppProps) {
  // State
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('MasterDB');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [tableData, setTableData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SQL Query
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize] = useState(100);

  // Search
  const [tableSearch, setTableSearch] = useState('');

  // Load databases on mount
  useEffect(() => {
    fetchDatabases();
  }, []);

  // Load tables when database changes
  useEffect(() => {
    if (selectedDb) {
      fetchTables();
      setSelectedTable('');
      setColumns([]);
      setTableData(null);
    }
  }, [selectedDb]);

  // Load columns and data when table changes
  useEffect(() => {
    if (selectedTable) {
      fetchColumns();
      fetchTableData();
      setPage(0);
    }
  }, [selectedTable]);

  // Refetch data when page changes
  useEffect(() => {
    if (selectedTable) {
      fetchTableData();
    }
  }, [page]);

  async function executeQuery(sql: string): Promise<QueryResult> {
    const response = await fetch(`${API_BASE}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    return response.json();
  }

  async function fetchDatabases() {
    try {
      const result = await executeQuery(`
        SELECT name, database_id as id
        FROM sys.databases
        WHERE database_id > 4
        ORDER BY name
      `);
      if (result.rows) {
        setDatabases(result.rows.map(r => ({ name: r[0], id: r[1] })));
      }
    } catch (err) {
      setError('데이터베이스 목록 조회 실패');
    }
  }

  async function fetchTables() {
    setLoading(true);
    setError(null);
    try {
      const result = await executeQuery(`
        SELECT
          t.name,
          p.rows,
          s.name as schema_name
        FROM ${selectedDb}.sys.tables t
        JOIN ${selectedDb}.sys.schemas s ON t.schema_id = s.schema_id
        JOIN ${selectedDb}.sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
        ORDER BY t.name
      `);
      if (result.rows) {
        setTables(result.rows.map(r => ({
          name: r[0],
          rows: r[1] || 0,
          schema: r[2]
        })));
      }
    } catch (err) {
      setError('테이블 목록 조회 실패');
    } finally {
      setLoading(false);
    }
  }

  async function fetchColumns() {
    try {
      const result = await executeQuery(`
        SELECT
          c.name,
          t.name as type_name,
          c.max_length,
          c.is_nullable,
          CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END as is_primary
        FROM ${selectedDb}.sys.columns c
        JOIN ${selectedDb}.sys.types t ON c.user_type_id = t.user_type_id
        JOIN ${selectedDb}.sys.tables tb ON c.object_id = tb.object_id
        LEFT JOIN (
          SELECT ic.object_id, ic.column_id
          FROM ${selectedDb}.sys.index_columns ic
          JOIN ${selectedDb}.sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
          WHERE i.is_primary_key = 1
        ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
        WHERE tb.name = '${selectedTable}'
        ORDER BY c.column_id
      `);
      if (result.rows) {
        setColumns(result.rows.map(r => ({
          name: r[0],
          type: r[1],
          max_length: r[2],
          is_nullable: r[3],
          is_primary: r[4] === 1
        })));
      }
    } catch (err) {
      console.error('컬럼 조회 실패:', err);
    }
  }

  async function fetchTableData() {
    setLoading(true);
    try {
      const offset = page * pageSize;
      const result = await executeQuery(`
        SELECT * FROM ${selectedDb}.dbo.[${selectedTable}]
        ORDER BY (SELECT NULL)
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      `);
      setTableData(result);
    } catch (err) {
      setTableData({ columns: [], rows: [], error: '데이터 조회 실패' });
    } finally {
      setLoading(false);
    }
  }

  async function runCustomQuery() {
    if (!sqlQuery.trim()) return;

    // 보안: SELECT만 허용
    const trimmed = sqlQuery.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT')) {
      setQueryResult({ columns: [], rows: [], error: 'SELECT 쿼리만 실행 가능합니다.' });
      return;
    }

    setQueryLoading(true);
    try {
      const result = await executeQuery(sqlQuery);
      setQueryResult(result);
    } catch (err) {
      setQueryResult({ columns: [], rows: [], error: '쿼리 실행 실패' });
    } finally {
      setQueryLoading(false);
    }
  }

  // Filter tables by search
  const filteredTables = tables.filter(t =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex">
      {/* Sidebar - Database & Tables */}
      <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Database Selector */}
        <div className="p-3 border-b border-gray-700">
          <label className="text-xs text-gray-400 block mb-1">Database</label>
          <select
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
            className="w-full bg-gray-700 text-white text-sm px-2 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            {databases.map(db => (
              <option key={db.id} value={db.name}>{db.name}</option>
            ))}
          </select>
        </div>

        {/* Table Search */}
        <div className="p-3 border-b border-gray-700">
          <input
            type="text"
            placeholder="테이블 검색..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="w-full bg-gray-700 text-white text-sm px-2 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Tables List */}
        <div className="flex-1 overflow-y-auto">
          {loading && !selectedTable && (
            <div className="p-4 text-center text-gray-500">로딩중...</div>
          )}
          {filteredTables.map(table => (
            <div
              key={table.name}
              onClick={() => setSelectedTable(table.name)}
              className={`px-3 py-2 cursor-pointer border-b border-gray-700/50 hover:bg-gray-700 ${
                selectedTable === table.name ? 'bg-blue-600/30 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="text-sm font-medium truncate">{table.name}</div>
              <div className="text-xs text-gray-500">{table.rows.toLocaleString()} rows</div>
            </div>
          ))}
        </div>

        {/* Table Count */}
        <div className="p-2 border-t border-gray-700 text-xs text-gray-500 text-center">
          {filteredTables.length} / {tables.length} tables
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🗄️</span>
            <div>
              <h1 className="text-lg font-bold">DB Admin</h1>
              <p className="text-xs text-gray-400">MSSQL Database Viewer (Read-Only)</p>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            {selectedDb} {selectedTable && `/ ${selectedTable}`}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedTable ? (
            /* No table selected - Show SQL Query Panel */
            <div className="flex-1 flex flex-col p-4">
              <div className="mb-3">
                <label className="text-sm text-gray-400 block mb-1">SQL Query (SELECT only)</label>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="SELECT * FROM MasterDB.dbo.Customer WHERE ..."
                  className="w-full h-32 bg-gray-800 text-white font-mono text-sm p-3 rounded border border-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
              <div className="mb-4">
                <button
                  onClick={runCustomQuery}
                  disabled={queryLoading}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {queryLoading ? '실행중...' : '실행 (Ctrl+Enter)'}
                </button>
              </div>

              {/* Query Result */}
              {queryResult && (
                <div className="flex-1 overflow-auto bg-gray-800 rounded border border-gray-700">
                  {queryResult.error ? (
                    <div className="p-4 text-red-400">{queryResult.error}</div>
                  ) : (
                    <>
                      <div className="text-xs text-gray-500 p-2 border-b border-gray-700">
                        {queryResult.rows?.length || 0} rows
                      </div>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-700 sticky top-0">
                          <tr>
                            {queryResult.columns?.map((col, i) => (
                              <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-300 border-r border-gray-600 last:border-r-0">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows?.map((row, i) => (
                            <tr key={i} className="border-t border-gray-700 hover:bg-gray-700/50">
                              {row.map((cell, j) => (
                                <td key={j} className="px-3 py-1.5 text-xs border-r border-gray-700/50 last:border-r-0 max-w-xs truncate">
                                  {cell === null ? <span className="text-gray-500 italic">NULL</span> : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

              {!queryResult && (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📝</div>
                    <div>왼쪽에서 테이블을 선택하거나</div>
                    <div>위에서 SQL 쿼리를 실행하세요</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Table Selected - Show Structure & Data */
            <>
              {/* Columns Panel */}
              <div className="bg-gray-800 border-b border-gray-700 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">컬럼 구조</span>
                  <span className="text-xs text-gray-500">({columns.length} columns)</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {columns.map(col => (
                    <span
                      key={col.name}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                        col.is_primary ? 'bg-yellow-600/30 text-yellow-300' : 'bg-gray-700 text-gray-300'
                      }`}
                      title={`${col.type}(${col.max_length}) ${col.is_nullable ? 'NULL' : 'NOT NULL'}`}
                    >
                      {col.is_primary && <span>🔑</span>}
                      <span className="font-medium">{col.name}</span>
                      <span className="text-gray-500">{col.type}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">로딩중...</div>
                ) : tableData?.error ? (
                  <div className="p-8 text-center text-red-400">{tableData.error}</div>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-800 sticky top-0 z-10">
                      <tr>
                        <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 border-r border-gray-700 w-12 bg-gray-800">#</th>
                        {tableData?.columns?.map((col, i) => (
                          <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-300 border-r border-gray-700 last:border-r-0 whitespace-nowrap bg-gray-800">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-gray-900">
                      {tableData?.rows?.map((row, i) => (
                        <tr key={i} className={`border-t border-gray-700/50 hover:bg-gray-700/50 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-850'}`}>
                          <td className="px-2 py-1.5 text-center text-xs text-gray-500 border-r border-gray-700/50 bg-gray-800/50">
                            {page * pageSize + i + 1}
                          </td>
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-1.5 text-xs border-r border-gray-700/30 last:border-r-0 max-w-xs truncate text-gray-200">
                              {cell === null ? (
                                <span className="text-gray-500 italic">NULL</span>
                              ) : typeof cell === 'object' ? (
                                JSON.stringify(cell)
                              ) : (
                                String(cell)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {tables.find(t => t.name === selectedTable)?.rows.toLocaleString()} total rows
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1 bg-gray-700 text-sm rounded disabled:opacity-50 hover:bg-gray-600"
                  >
                    ← Prev
                  </button>
                  <span className="text-sm text-gray-400">
                    Page {page + 1}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!tableData?.rows || tableData.rows.length < pageSize}
                    className="px-3 py-1 bg-gray-700 text-sm rounded disabled:opacity-50 hover:bg-gray-600"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DbAdminApp;
