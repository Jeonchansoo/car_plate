import React, { useState, useEffect } from 'react';
import { User, CarRecord, ColumnDef } from '../types';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { usePressAndHoldSpeech } from '../hooks/usePressAndHoldSpeech';
import { requestMicrophonePermission, checkMicrophonePermission } from '../utils/microphonePermission';
import {
  DEFAULT_COLUMNS,
  INITIAL_RECORDS,
  getNameCol,
  getCarNumberCol,
  getThirdCol,
  getCarNumberValue,
  extractLastFourDigits,
} from '../constants';

const SearchPortal: React.FC<{ user: User }> = ({ user }) => {
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<CarRecord[]>(INITIAL_RECORDS);
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [results, setResults] = useState<CarRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isTextSearchMode, setIsTextSearchMode] = useState(false);

  const {
    status: speechStatus,
    isListening,
    rawTranscript,
    digits: speechDigits,
    error: speechError,
    startListening,
    stopListening,
  } = useSpeechRecognition({ lang: 'ko-KR' });

  const {
    status: pressAndHoldStatus,
    isListening: isPressAndHoldListening,
    rawTranscript: pressAndHoldTranscript,
    digits: pressAndHoldDigits,
    error: pressAndHoldError,
    handleMouseDown,
    handleMouseUp,
    handleTouchStart,
    handleTouchEnd,
  } = usePressAndHoldSpeech({ lang: 'ko-KR' });

  useEffect(() => {
    const saved = localStorage.getItem('car_records');
    if (saved) {
      setRecords(JSON.parse(saved));
    }
    const savedCols = localStorage.getItem('car_columns');
    if (savedCols) {
      setColumns(JSON.parse(savedCols));
    }

    // 자동 마이크 권한 요청 (사용자 경험 향상)
    const initializeMicrophone = async () => {
      try {
        const permissionState = await checkMicrophonePermission();
        
        if (permissionState === 'prompt') {
          console.log('마이크 권한이 필요합니다. 음성 입력 버튼을 클릭하면 권한을 요청합니다.');
        } else if (permissionState === 'denied') {
          console.log('마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.');
        }
      } catch (error) {
        console.log('마이크 권한 확인 중 오류:', error);
      }
    };

    initializeMicrophone();
  }, []);

  const handleVoiceInputClick = async () => {
    if (speechStatus === 'unsupported') return;
    
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      console.log('마이크 권한이 필요합니다.');
    }
    
    if (isListening) {
      stopListening();
    } else {
      setQuery('');
      setHasSearched(false);
      startListening();
    }
  };

  const handlePressAndHoldStart = async () => {
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      console.log('마이크 권한이 필요합니다.');
    }
    handleMouseDown();
  };

  const runSearch = (value: string) => {
    setHasSearched(true);

    const searchDigits = value.replace(/[^0-9]/g, '');
    if (!searchDigits) {
      setResults([]);
      return;
    }

    const filtered = records.filter(record => {
      const carNumber = getCarNumberValue(record, columns);
      if (!carNumber) return false;
      
      const lastFour = extractLastFourDigits(carNumber);
      
      if (searchDigits.length === 4) {
        return lastFour === searchDigits;
      }
      
      return lastFour.startsWith(searchDigits);
    });

    setResults(filtered);
  };

  const runTextSearch = (value: string) => {
    setHasSearched(true);
    
    if (!value.trim()) {
      setResults([]);
      return;
    }

    const searchValue = value.toLowerCase().trim();
    
    const filtered = records.filter(record => {
      return Object.values(record).some(fieldValue => {
        if (fieldValue === null || fieldValue === undefined) return false;
        const fieldString = String(fieldValue).toLowerCase();
        return fieldString.includes(searchValue);
      });
    });

    setResults(filtered);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    runTextSearch(query);
  };

  useEffect(() => {
    if (speechDigits && speechDigits !== query) {
      setQuery(speechDigits);
      runSearch(speechDigits);
    }
  }, [speechDigits]);

  useEffect(() => {
    if (pressAndHoldDigits && pressAndHoldDigits !== query) {
      setQuery(pressAndHoldDigits);
      runSearch(pressAndHoldDigits);
    }
  }, [pressAndHoldDigits]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-4 text-white shadow-xl shadow-blue-200">
        <div className="mb-3">
          <h2 className="text-lg font-bold">안녕하세요, {user.name}님!</h2>
          <p className="text-blue-100 text-xs mt-1">{columns.map(c => c.label).join(', ')} 등 문자나 숫자를 입력하여 차주 정보 조회</p>
        </div>

        <form onSubmit={handleSearch} className="relative w-full">
          <input
            type="text"
            placeholder={isTextSearchMode ? "문자로 조회 중입니다... 검색어를 입력하세요" : "차량번호 뒷자리 4자리 입력 (예: 3734)"}
            className="w-full pl-10 pr-24 py-3 rounded-xl text-slate-900 text-2xl font-bold text-center tracking-[0.15em] outline-none focus:ring-4 focus:ring-blue-400/50 shadow-lg placeholder:text-slate-400 placeholder:font-normal placeholder:text-[9px] placeholder:text-center placeholder:tracking-normal"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            onClick={() => {
              if (speechStatus === 'unsupported') return;
              if (isListening) {
                stopListening();
              } else {
                startListening();
              }
            }}
            className={`absolute left-2 top-2 bottom-2 w-8 flex items-center justify-center rounded-lg border text-xs font-semibold transition active:scale-95 ${speechStatus === 'unsupported'
                ? 'bg-slate-500/40 border-slate-400/60 text-slate-200 cursor-not-allowed'
                : isListening
                  ? 'bg-red-500 border-red-400 text-white shadow-md shadow-red-300/60'
                  : 'bg-white/15 border-white/60 text-white hover:bg-white/25'
              }`}
            aria-label={isListening ? '음성 인식 중지' : '음성으로 입력'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-500 transition active:scale-95"
          >
            조회하기
          </button>
        </form>

        {/* 직접 입력 / 음성 입력 토글 버튼 영역 */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (hasSearched) {
                setQuery('');
                setHasSearched(false);
                setResults([]);
                setIsTextSearchMode(false);
              } else if (query.trim()) {
                setIsTextSearchMode(true);
                runTextSearch(query);
              }
            }}
            className={`py-3 rounded-lg font-semibold text-sm shadow-sm transition flex items-center justify-center gap-1 ${
              hasSearched
                ? 'bg-red-500 text-white hover:bg-red-600'
                : query.trim()
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-[#C0FFFF] text-slate-800 hover:bg-[#B0FFFF]'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
              <path d="M8 11h6"/>
            </svg>
            {query.trim() ? '검색중' : '검색'}
          </button>
          <button
            type="button"
            onClick={handleVoiceInputClick}
            className={`py-3 rounded-lg font-semibold text-sm shadow-sm transition flex items-center justify-center gap-1 ${speechStatus === 'unsupported'
                ? 'bg-slate-500/60 text-slate-200 cursor-not-allowed'
                : isListening
                  ? 'bg-red-500 text-white'
                  : 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            숫자음성
          </button>
        </div>

        <div className="mt-2 text-xs space-y-1 min-h-[1.2rem]">
          {speechStatus === 'unsupported' && (
            <p className="text-yellow-100/90">
              이 브라우저에서는 음성 인식(Web Speech API)이 지원되지 않습니다. 최신 Chrome 또는 Edge를
              사용해 주세요.
            </p>
          )}
          {pressAndHoldStatus === 'unsupported' && speechStatus !== 'unsupported' && (
            <p className="text-yellow-100/90">
              이 브라우저에서는 음성 인식(Web Speech API)이 지원되지 않습니다. 최신 Chrome 또는 Edge를
              사용해 주세요.
            </p>
          )}
          {(speechError || pressAndHoldError) && (
            <p className="text-red-100">
              음성 인식 오류: <span className="underline underline-offset-2">{speechError || pressAndHoldError}</span>
            </p>
          )}
          {(rawTranscript || pressAndHoldTranscript) && !speechError && !pressAndHoldError && (
            <p className="text-blue-100/90">
              들은 내용: <span className="font-semibold">"{rawTranscript || pressAndHoldTranscript}"</span>
              {(speechDigits || pressAndHoldDigits) && (
                <span className="ml-2">
                  → 해석된 번호판 뒷자리: <span className="font-bold">{speechDigits || pressAndHoldDigits}</span>
                </span>
              )}
            </p>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">조회 결과</h3>
          <span className="text-sm text-slate-500">총 {results.length}건</span>
        </div>

        <div className="divide-y">
          {results.length > 0 ? (
            results.map((record) => {
              // 위치(인덱스) 기반으로 컬럼 역할 결정
              const nameColDef = getNameCol(columns);       // columns[0] = 이름
              const carColDef = getCarNumberCol(columns);    // columns[1] = 차량번호
              const thirdColDef = getThirdCol(columns);      // columns[2] = 세 번째 컬럼

              const displayName = nameColDef ? record[nameColDef.id] : '';
              const carNumber = carColDef ? String(record[carColDef.id] || '') : '';
              const displayThird = thirdColDef ? record[thirdColDef.id] : '';

              // 처음 3개 컬럼 이외의 추가 컬럼
              const extraColumns = columns.slice(3);
              const extraWithValues = extraColumns.filter(col => {
                const v = record[col.id];
                return v !== undefined && v !== null && String(v).trim() !== '';
              });
              const extraCount = extraWithValues.length;
              const extraGridClass =
                extraCount <= 1 ? 'grid grid-cols-1 gap-1' : 'grid grid-cols-2 gap-1';

              return (
                <div key={record.id} className="p-2 space-y-1 hover:bg-blue-50/30 transition border-b-2 border-slate-300 shadow-sm">
                  {/* 컬럼1(이름), 컬럼3(세 번째) - 모바일에서도 가로로 표시 */}
                  <div className="grid grid-cols-12 gap-1 min-w-0 items-stretch">
                    {/* 첫 번째 컬럼 (이름 역할) */}
                    <div className="col-span-4 flex flex-col items-center justify-center py-1 px-1 bg-white rounded border border-slate-200 min-w-0">
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5 text-center">{nameColDef?.label || '이름'}</div>
                      <div className="text-xl font-black text-slate-900 text-center truncate w-full">{displayName}</div>
                    </div>

                    {/* 세 번째 컬럼 (출입증/분류 등 역할) */}
                    {displayThird && (
                      <div className="col-span-8 flex flex-col items-center justify-center py-1 px-1 bg-blue-50 rounded border border-blue-200 min-w-0">
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5 text-center">{thirdColDef?.label || ''}</div>
                        <div className="text-2xl font-black text-blue-700 text-center truncate w-full">{displayThird}</div>
                      </div>
                    )}
                  </div>

                  {/* 두 번째 컬럼 (차량 번호 역할) + 4번째 이후 수동 추가 컬럼은 번호판 아래 박스에 표시 */}
                  <div className="bg-slate-100 px-2 py-1 rounded border border-slate-200">
                    <div className="text-[8px] text-slate-400 font-bold uppercase mb-0.5 text-center tracking-[0.2em]">{carColDef?.label || 'Vehicle Number'}</div>
                    <div className="text-4xl font-black text-slate-800 tracking-wider whitespace-nowrap text-center">{carNumber}</div>
                    {extraCount > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-300/80 rounded-b-lg bg-white/60 px-1.5 py-1.5">
                        <div className={extraGridClass}>
                          {extraWithValues.map((col, idx) => {
                            const isLastOdd =
                              extraCount >= 2 && idx === extraCount - 1 && extraCount % 2 === 1;
                            return (
                              <div
                                key={col.id}
                                className={`flex flex-col items-center justify-center py-1 px-1 rounded-md border border-slate-200 bg-white min-w-0 ${
                                  isLastOdd ? 'col-span-2' : ''
                                }`}
                              >
                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5 text-center w-full truncate">
                                  {col.label}
                                </div>
                                <div className="text-xl font-black text-slate-900 text-center truncate w-full">
                                  {String(record[col.id])}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-20 text-center">
              {hasSearched ? (
                <div className="space-y-3">
                  <div className="text-slate-300 flex justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                  </div>
                  <p className="text-slate-500 font-medium">검색 결과가 없습니다.</p>
                  <p className="text-slate-400 text-sm">번호를 다시 확인해 주세요.</p>
                </div>
              ) : (
                <div className="text-slate-400">조회하실 차량의 번호를 입력해 주세요.</div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Suggested Search Section for Demo */}
      {!hasSearched && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {['3734', '2625', '1234', '7889'].map(num => (
            <button
              key={num}
              onClick={() => { setQuery(num); setHasSearched(false); setIsTextSearchMode(false); }}
              className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:text-blue-600 transition text-sm font-medium text-slate-600 text-center shadow-sm"
            >
              "{num}" 검색해보기
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchPortal;
