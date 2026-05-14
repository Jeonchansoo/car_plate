import React, { useState, useEffect } from 'react';
import { CarRecord, User, UserStatus, UserRole, ColumnDef } from '../types';
import * as XLSX from 'xlsx';
import { DEFAULT_COLUMNS, INITIAL_RECORDS } from '../constants';

/**
 * 한글이 깨졌는지 감지하는 함수
 * - 치환문자(U+FFFD), 제어문자, 의미없는 특수조합 등이 있으면 깨진 것으로 판단
 */
function hasGarbledKorean(text: string): boolean {
  // U+FFFD 치환 문자가 있으면 깨진 것
  if (text.includes('\uFFFD')) return true;
  // 일반적이지 않은 제어 문자 범위가 다수 포함되면
  const controlChars = text.match(/[\x80-\x9F]/g);
  if (controlChars && controlChars.length > 2) return true;
  return false;
}

/**
 * 업로드된 헤더를 기존 컬럼에 위치(인덱스) 기반으로 매핑
 * - 업로드 파일의 첫 번째 열 → columns[0]의 id
 * - 업로드 파일의 두 번째 열 → columns[1]의 id
 * - 업로드 파일의 세 번째 열 → columns[2]의 id
 * - 그 이상의 열 → 새 컬럼 자동 추가
 *
 * 이렇게 하면 CSV/엑셀 헤더 이름이 무엇이든 상관없이 위치로 매핑됩니다.
 */
function mapHeadersByPosition(
  headerRow: string[],
  existingColumns: ColumnDef[]
): { headerToColId: Record<string, string>; updatedColumns: ColumnDef[] } {
  const newCols = [...existingColumns];
  const headerToColId: Record<string, string> = {};

  headerRow.forEach((header, idx) => {
    if (!header || header.toLowerCase() === 'id') return;

    if (idx < newCols.length) {
      // 기존 컬럼 위치에 매핑 (라벨은 업로드 파일의 헤더로 업데이트)
      headerToColId[header] = newCols[idx].id;
    } else {
      // 기존 컬럼 수보다 많은 열이면 새 컬럼 추가
      // 먼저 같은 label이 이미 있는지 확인
      const existingByLabel = newCols.find(c => c.label === header);
      if (existingByLabel) {
        headerToColId[header] = existingByLabel.id;
      } else {
        const newId = 'col_' + Date.now() + '_' + idx;
        headerToColId[header] = newId;
        newCols.push({ id: newId, label: header });
      }
    }
  });

  return { headerToColId, updatedColumns: newCols };
}

const AdminDashboard: React.FC = () => {
  const [records, setRecords] = useState<CarRecord[]>([]);
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [users, setUsers] = useState<User[]>([
    { id: 'u1', name: '김철수', email: 'chulsu@test.com', role: UserRole.USER, status: UserStatus.PENDING, createdAt: '2024-03-20' },
    { id: 'u2', name: '이영희', email: 'younghee@test.com', role: UserRole.USER, status: UserStatus.PENDING, createdAt: '2024-03-21' },
  ]);

  const [newRecordVals, setNewRecordVals] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'records' | 'users'>('records');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [newColumnName, setNewColumnName] = useState('');

  useEffect(() => {
    const savedRecords = localStorage.getItem('car_records');
    setRecords(savedRecords ? JSON.parse(savedRecords) : INITIAL_RECORDS);
    const savedCols = localStorage.getItem('car_columns');
    if (savedCols) {
      setColumns(JSON.parse(savedCols));
    }
  }, []);

  const saveRecords = (newRecords: CarRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem('car_records', JSON.stringify(newRecords));
  };

  const saveColumns = (newCols: ColumnDef[]) => {
    setColumns(newCols);
    localStorage.setItem('car_columns', JSON.stringify(newCols));
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const nextId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
    const record: CarRecord = { id: nextId, ...newRecordVals };
    saveRecords([...records, record]);
    setNewRecordVals({});
  };

  /** 기존 행의 셀 수정 (새로 추가한 컬럼 값 포함) */
  const handleRecordCellChange = (recordId: number, colId: string, value: string) => {
    saveRecords(
      records.map(r => (r.id === recordId ? { ...r, [colId]: value } : r)),
    );
  };

  // 전체 삭제 시 수동등록/속성관리도 초기화
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      alert('삭제할 항목을 선택해주세요.');
      return;
    }

    const isFullDelete = selectedIds.length === records.length;

    if (confirm(`선택한 ${selectedIds.length}개의 데이터를 삭제하시겠습니까?${isFullDelete ? '\n\n⚠️ 전체 데이터를 삭제하면 속성 관리도 기본값으로 초기화됩니다.' : ''}`)) {
      if (isFullDelete) {
        saveRecords([]);
        saveColumns(DEFAULT_COLUMNS);
        setNewRecordVals({});
        localStorage.removeItem('car_records');
        localStorage.removeItem('car_columns');
      } else {
        saveRecords(records.filter(r => !selectedIds.includes(r.id)));
      }
      setSelectedIds([]);
    }
  };

  // CSV/엑셀 업로드
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (isCSV) {
      const tryEncodings = ['utf-8', 'euc-kr', 'cp949', 'utf-16le'];
      let attemptIndex = 0;

      const tryReadWithEncoding = () => {
        if (attemptIndex >= tryEncodings.length) {
          alert('파일을 읽을 수 없습니다. 인코딩을 확인해주세요.');
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          let text = event.target?.result as string;
          text = text.replace(/^\uFEFF/, '');

          if (hasGarbledKorean(text)) {
            attemptIndex++;
            tryReadWithEncoding();
          } else {
            processCSVText(text);
          }
        };
        
        reader.onerror = () => {
          attemptIndex++;
          tryReadWithEncoding();
        };

        reader.readAsText(file, tryEncodings[attemptIndex]);
      };

      tryReadWithEncoding();
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { 
            type: 'array',
            codepage: 949
          });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          processUploadedData(json);
        } catch (error) {
          console.error('엑셀 파일 읽기 오류:', error);
          alert('엑셀 파일을 읽는 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
        }
      };
      reader.onerror = () => {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      };
      reader.readAsArrayBuffer(file);
    }

    e.target.value = '';
  };

  const processCSVText = (text: string) => {
    try {
      const cleanText = text.replace(/^\uFEFF/, '').trim();
      const workbook = XLSX.read(cleanText, { 
        type: 'string',
        codepage: 949
      });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      processUploadedData(json);
    } catch (error) {
      console.error('CSV 파싱 오류:', error);
      alert('CSV 파일을 파싱하는 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
    }
  };

  /**
   * 업로드 데이터 처리 - 위치(인덱스) 기반 매핑
   * CSV/엑셀의 열 순서가 곧 컬럼 위치입니다.
   * 헤더 이름이 뭐든 상관없이 첫 번째 열 → columns[0], 두 번째 열 → columns[1] 순으로 매핑
   */
  const processUploadedData = (json: any[][]) => {
    if (json.length === 0) return;

    // id 열 제외한 헤더 추출
    const rawHeaders = json[0].map((h: any) => String(h || '').trim());
    const idColIndex = rawHeaders.findIndex(h => h.toLowerCase() === 'id');
    const headerRow = rawHeaders.filter(h => h && h.toLowerCase() !== 'id');

    // 위치 기반으로 헤더를 기존 컬럼에 매핑
    const { headerToColId, updatedColumns } = mapHeadersByPosition(headerRow, columns);
    saveColumns(updatedColumns);

    const newFromUpload: CarRecord[] = [];
    const currentMaxId = records.length > 0 ? Math.max(...records.map(r => r.id)) : 0;
    let nextId = currentMaxId + 1;

    for (let i = 1; i < json.length; i++) {
      const row = json[i];
      if (row && row.length > 0) {
        const record: CarRecord = { id: nextId++ };
        rawHeaders.forEach((h: string, idx: number) => {
          if (h.toLowerCase() === 'id') {
            record.id = parseInt(row[idx]) || record.id;
          } else {
            const colId = headerToColId[h];
            if (colId) {
              record[colId] = row[idx] != null ? String(row[idx]).trim() : '';
            }
          }
        });
        newFromUpload.push(record);
      }
    }
    saveRecords([...records, ...newFromUpload]);
    alert(`${newFromUpload.length}개의 데이터가 추가되었습니다.`);
  };

  const handleAddColumn = () => {
    if (!newColumnName.trim()) {
      alert('추가할 속성명을 입력해주세요.');
      return;
    }
    const newId = 'col_' + Date.now();
    saveColumns([...columns, { id: newId, label: newColumnName.trim() }]);
    setNewColumnName('');
  };

  const handleUpdateColumnLabel = (id: string, newLabel: string) => {
    saveColumns(columns.map(c => c.id === id ? { ...c, label: newLabel } : c));
  };

  const handleDeleteColumn = (id: string) => {
    if (confirm('이 속성을 삭제하시겠습니까? 데이터 테이블에서 이 열이 제거됩니다.')) {
      saveColumns(columns.filter(c => c.id !== id));
    }
  };

  const handleApproveUser = (id: string) => {
    setUsers(users.map(u => u.id === id ? { ...u, status: UserStatus.APPROVED } : u));
    alert('사용자가 승인되었습니다.');
  };

  const allSelected = records.length > 0 && selectedIds.length === records.length;

  return (
    <div className="space-y-6">
      <div className="flex bg-white p-1 rounded-xl border border-slate-200 w-full md:w-fit mb-8 shadow-sm">
        <button
          onClick={() => setActiveTab('records')}
          className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-bold transition text-sm ${activeTab === 'records' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          DB 관리
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-bold transition text-sm ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          사용자 승인 ({users.filter(u => u.status === UserStatus.PENDING).length})
        </button>
      </div>

      {activeTab === 'records' ? (
        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">수동 데이터 등록</h3>
              <form onSubmit={handleAddRecord} className="space-y-4">
                {columns.map(col => (
                  <input
                    key={'input_' + col.id}
                    type="text"
                    value={newRecordVals[col.id] || ''}
                    onChange={(e) => setNewRecordVals({ ...newRecordVals, [col.id]: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder={col.label}
                  />
                ))}
                <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded-lg font-bold text-sm hover:bg-slate-800 transition">
                  등록하기
                </button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-2 text-sm">속성 관리</h3>
              <p className="text-[10px] text-slate-400 mb-3">⚠️ 라벨(이름)만 변경됩니다. 기존 데이터는 그대로 유지됩니다.</p>
              <div className="space-y-3 mb-4">
                {columns.map((col, idx) => (
                  <div key={col.id} className="flex gap-2 items-center w-full">
                    <span className="text-[10px] text-slate-300 font-mono w-4 text-center flex-shrink-0">{idx + 1}</span>
                    <input
                      value={col.label}
                      onChange={e => handleUpdateColumnLabel(col.id, e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded text-sm w-full min-w-0 outline-none focus:border-blue-500"
                      placeholder="속성명"
                    />
                    <button onClick={() => handleDeleteColumn(col.id)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded text-xs font-bold hover:bg-red-100 transition whitespace-nowrap flex-shrink-0">
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 w-full">
                <input
                  value={newColumnName}
                  onChange={e => setNewColumnName(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-full min-w-0 outline-none focus:border-blue-500"
                  placeholder="새 속성명 입력..."
                  onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); }}
                />
                <button onClick={handleAddColumn} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition whitespace-nowrap flex-shrink-0">
                  추가
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-2 text-sm">대량 업로드 (.csv / .xlsx)</h3>
              <p className="text-[10px] text-slate-400 mb-2">파일의 열 순서가 위 속성 순서와 동일하게 매핑됩니다.</p>
              <label className="relative flex flex-col items-center justify-center w-full h-24 border-2 border-slate-100 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition overflow-hidden">
                <span className="text-xs text-slate-400 font-medium text-center z-10 pointer-events-none">
                  파일 선택<br />
                  (CSV, 엑셀)
                </span>
                <input
                  type="file"
                  accept=".csv, text/csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .xls, application/vnd.ms-excel"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                />
              </label>
            </div>



          </div>

          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">전체 차량 데이터 ({records.length})</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (allSelected) setSelectedIds([]);
                    else setSelectedIds(records.map(r => r.id));
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 transition"
                >
                  {allSelected ? '전체 해제' : '전체 선택'}
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition disabled:opacity-50"
                  disabled={selectedIds.length === 0}
                >
                  선택항목 삭제 ({selectedIds.length})
                </button>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left min-w-max">
                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-6 py-4 font-bold w-12">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(records.map(r => r.id));
                          else setSelectedIds([]);
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-4 font-bold">ID</th>
                    {columns.map(col => (
                      <th key={'th_' + col.id} className="px-6 py-4 font-bold">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <tr key={r.id} className={`hover:bg-blue-50/20 transition group ${selectedIds.includes(r.id) ? 'bg-blue-50/10' : ''}`}>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds([...selectedIds, r.id]);
                            else setSelectedIds(selectedIds.filter(id => id !== r.id));
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{r.id}</td>
                      {columns.map(col => (
                        <td key={'td_' + col.id} className="px-4 py-2 align-middle min-w-[10rem]">
                          <input
                            type="text"
                            value={r[col.id] != null ? String(r[col.id]) : ''}
                            onChange={e => handleRecordCellChange(r.id, col.id, e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={col.label}
                            aria-label={`${col.label} (${r.id}행)`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 2} className="px-6 py-12 text-center text-slate-400">데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b">
            <h3 className="font-bold text-slate-900 text-sm">회원가입 요청</h3>
          </div>
          <div className="divide-y">
            {users.filter(u => u.status === UserStatus.PENDING).map(user => (
              <div key={user.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-slate-900">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.email} · {user.createdAt}</div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => handleApproveUser(user.id)} className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">승인</button>
                  <button className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">거절</button>
                </div>
              </div>
            ))}
            {users.filter(u => u.status === UserStatus.PENDING).length === 0 && (
              <div className="p-12 text-center text-slate-400 text-sm">모든 요청이 처리되었습니다.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
