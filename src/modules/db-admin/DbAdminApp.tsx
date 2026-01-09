/**
 * DB Admin 메인 앱
 * MSSQL / PostgreSQL 통합 데이터베이스 관리자
 */

import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import {
  ThemeToggle,
  DatabaseSelector,
  TableList,
  ColumnSchema,
  SearchBuilder,
  DataTable,
  Pagination,
  SqlQueryPanel,
  SchemaEditorModal,
  TableCreateModal,
} from './components';
import { getColumns, getTableData, getTableCount } from './lib/api';
import type { DbType, ColumnInfo, QueryResult, SortInfo, Pagination as PaginationType } from './types';
import './styles/themes.css';

type ViewMode = 'table' | 'sql';

function DbAdminContent() {
  const { theme } = useTheme();

  // State
  const [dbType, setDbType] = useState<DbType>('postgres');
  const [database, setDatabase] = useState<string>('haniwon');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [data, setData] = useState<QueryResult>({ columns: [], rows: [], rowCount: 0 });
  const [sort, setSort] = useState<SortInfo | null>(null);
  const [whereClause, setWhereClause] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationType>({ page: 1, pageSize: 100, totalRows: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [loading, setLoading] = useState(false);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [schemaEditTable, setSchemaEditTable] = useState<string | null>(null);
  const [tablesRefreshKey, setTablesRefreshKey] = useState(0);

  // DB Type 변경 시 초기화
  useEffect(() => {
    setSelectedTable(null);
    setColumns([]);
    setData({ columns: [], rows: [], rowCount: 0 });
    setSort(null);
    setWhereClause('');
    setPagination({ page: 1, pageSize: 100, totalRows: 0 });
  }, [dbType]);

  // 테이블 선택 시 컬럼/데이터 로드
  useEffect(() => {
    if (selectedTable) {
      loadColumns();
      loadData();
      loadCount();
    }
  }, [selectedTable, dbType, database]);

  // 정렬/페이지/검색 변경 시 데이터 리로드
  useEffect(() => {
    if (selectedTable) {
      loadData();
      loadCount();
    }
  }, [sort, pagination.page, pagination.pageSize, whereClause]);

  const loadColumns = async () => {
    if (!selectedTable) return;
    setColumnsLoading(true);
    try {
      const cols = await getColumns(dbType, selectedTable, database);
      setColumns(cols);
    } catch (error) {
      console.error('Failed to load columns:', error);
    } finally {
      setColumnsLoading(false);
    }
  };

  const loadData = async () => {
    if (!selectedTable) return;
    setLoading(true);
    try {
      const result = await getTableData(dbType, selectedTable, {
        database,
        limit: pagination.pageSize,
        offset: (pagination.page - 1) * pagination.pageSize,
        orderBy: sort?.column,
        orderDir: sort?.direction,
        where: whereClause,
      });
      setData(result);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCount = async () => {
    if (!selectedTable) return;
    try {
      const count = await getTableCount(dbType, selectedTable, { database, where: whereClause });
      setPagination((prev) => ({ ...prev, totalRows: count }));
    } catch (error) {
      console.error('Failed to load count:', error);
    }
  };

  const handleDbTypeChange = (type: DbType) => {
    setDbType(type);
    setDatabase(type === 'postgres' ? 'haniwon' : 'MasterDB');
  };

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setSort(null);
    setWhereClause('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSort = (column: string) => {
    setSort((prev) => {
      if (prev?.column === column) {
        return prev.direction === 'ASC'
          ? { column, direction: 'DESC' }
          : null;
      }
      return { column, direction: 'ASC' };
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSearch = (where: string) => {
    setWhereClause(where);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearSearch = () => {
    setWhereClause('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setPagination((prev) => ({ ...prev, pageSize, page: 1 }));
  };

  // 사이드바에서 스키마 편집 클릭 시
  const handleSchemaEditFromSidebar = (tableName: string) => {
    setSchemaEditTable(tableName);
  };

  // 테이블 생성 완료 후
  const handleTableCreated = (tableName: string) => {
    setTablesRefreshKey((prev) => prev + 1);
    setSelectedTable(tableName);
  };

  // 스키마 에디터에 사용할 테이블명 (사이드바에서 열었을 때 vs 메인에서 열었을 때)
  const schemaEditorTableName = schemaEditTable || selectedTable;

  return (
    <div className={`db-admin ${theme}`}>
      <div className="db-admin-layout">
        {/* Sidebar */}
        <aside className="db-admin-sidebar">
          <DatabaseSelector
            dbType={dbType}
            database={database}
            onDbTypeChange={handleDbTypeChange}
            onDatabaseChange={setDatabase}
          />
          <TableList
            key={tablesRefreshKey}
            dbType={dbType}
            database={database}
            selectedTable={selectedTable}
            onTableSelect={handleTableSelect}
            onCreateTable={() => setShowCreateTable(true)}
            onSchemaEdit={handleSchemaEditFromSidebar}
          />
        </aside>

        {/* Main Content */}
        <main className="db-admin-main">
          {/* Header */}
          <header className="db-admin-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                DB Admin
              </h1>
              <span className={`db-type-badge ${dbType}`}>
                {dbType === 'mssql' ? 'MSSQL' : 'PostgreSQL'}
              </span>
              {selectedTable && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  / {selectedTable}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* View Mode Toggle */}
              <div className="theme-toggle">
                <button
                  className={`theme-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                >
                  테이블
                </button>
                <button
                  className={`theme-toggle-btn ${viewMode === 'sql' ? 'active' : ''}`}
                  onClick={() => setViewMode('sql')}
                >
                  SQL
                </button>
              </div>

              <ThemeToggle />
            </div>
          </header>

          {/* Content */}
          <div className="db-admin-content">
            {viewMode === 'table' ? (
              <>
                {/* Column Schema */}
                {selectedTable && (
                  <div className="column-schema-wrapper">
                    <ColumnSchema columns={columns} loading={columnsLoading} />
                    {dbType === 'postgres' && (
                      <button
                        className="schema-edit-btn"
                        onClick={() => setShowSchemaEditor(true)}
                        disabled={columnsLoading}
                      >
                        스키마 편집
                      </button>
                    )}
                  </div>
                )}

                {/* Search Builder */}
                {selectedTable && columns.length > 0 && (
                  <SearchBuilder
                    columns={columns}
                    dbType={dbType}
                    onSearch={handleSearch}
                    onClear={handleClearSearch}
                  />
                )}

                {/* Data Table */}
                <DataTable
                  data={data}
                  sort={sort}
                  onSort={handleSort}
                  loading={loading}
                  dbType={dbType}
                  tableName={selectedTable}
                  columnInfo={columns}
                  onDataUpdate={loadData}
                />

                {/* Pagination */}
                {selectedTable && data.rows.length > 0 && (
                  <Pagination
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    executionTime={data.executionTime}
                  />
                )}
              </>
            ) : (
              <SqlQueryPanel dbType={dbType} />
            )}
          </div>
        </main>
      </div>

      {/* Schema Editor Modal (메인 영역에서 열었을 때) */}
      {showSchemaEditor && selectedTable && (
        <SchemaEditorModal
          tableName={selectedTable}
          columns={columns}
          onClose={() => setShowSchemaEditor(false)}
          onSchemaChange={() => {
            loadColumns();
            loadData();
          }}
        />
      )}

      {/* Schema Editor Modal (사이드바에서 열었을 때) */}
      {schemaEditTable && (
        <SchemaEditorModal
          tableName={schemaEditTable}
          columns={schemaEditTable === selectedTable ? columns : []}
          onClose={() => setSchemaEditTable(null)}
          onSchemaChange={() => {
            if (schemaEditTable === selectedTable) {
              loadColumns();
              loadData();
            }
            setTablesRefreshKey((prev) => prev + 1);
          }}
        />
      )}

      {/* Table Create Modal */}
      {showCreateTable && (
        <TableCreateModal
          onClose={() => setShowCreateTable(false)}
          onTableCreated={handleTableCreated}
        />
      )}
    </div>
  );
}

export default function DbAdminApp() {
  return (
    <ThemeProvider>
      <DbAdminContent />
    </ThemeProvider>
  );
}
