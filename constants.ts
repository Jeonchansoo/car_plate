import { CarRecord, ColumnDef } from './types';

/**
 * 위치(인덱스) 기반 컬럼 역할 규칙
 * ─────────────────────────────────────
 * columns[0] = 첫 번째 컬럼 (이름 역할) — 라벨을 '이름', '성함', '차주' 등 자유롭게 변경 가능
 * columns[1] = 두 번째 컬럼 (차량번호 역할) — 라벨을 '차량 번호', '넘버', '플레이트' 등 자유롭게 변경 가능
 * columns[2] = 세 번째 컬럼 (분류 역할) — 라벨을 '출입증', '분류', '구분' 등 자유롭게 변경 가능
 * columns[3+] = 추가 컬럼
 *
 * ⚠️ 라벨(label)은 자유롭게 바꿔도 되지만, id는 데이터 키이므로 변경하면 안 됩니다.
 *    id는 내부적으로만 사용되며 사용자에게 노출되지 않습니다.
 */

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { id: 'col_name', label: '이름' },
  { id: 'col_carNumber', label: '차량 번호' },
  { id: 'col_pass', label: '출입증' }
];

export const INITIAL_RECORDS: CarRecord[] = [
  { id: 1, col_name: '홍길동', col_carNumber: '24머 3734', col_pass: '[1] 상주 000' },
  { id: 2, col_name: '오감자', col_carNumber: '31구 2625', col_pass: '[1] 상주 001' },
  { id: 3, col_name: '김갑동', col_carNumber: '102다 3734', col_pass: '[1] 상주 002' },
  { id: 4, col_name: '이을숙', col_carNumber: '12사 1234', col_pass: '[1] 상주 003' },
  { id: 5, col_name: '지소연', col_carNumber: '50두 9888', col_pass: '[1] 상주 004' },
  { id: 6, col_name: '카리나', col_carNumber: '98사 1235', col_pass: '[1] 상주 205' },
  { id: 7, col_name: '전봇대', col_carNumber: '72카 4252', col_pass: '[1] 상주 120' },
  { id: 8, col_name: '이세리나', col_carNumber: '101자 7889', col_pass: '[1] 상주 301' },
];

/**
 * 위치 기반 컬럼 헬퍼 함수들
 * 컬럼의 라벨이 뭐든 상관없이, 배열 위치(인덱스)로 역할을 결정
 */
export function getNameCol(columns: ColumnDef[]): ColumnDef | undefined {
  return columns[0]; // 첫 번째 컬럼 = 이름 역할
}

export function getCarNumberCol(columns: ColumnDef[]): ColumnDef | undefined {
  return columns[1]; // 두 번째 컬럼 = 차량번호 역할
}

export function getThirdCol(columns: ColumnDef[]): ColumnDef | undefined {
  return columns[2]; // 세 번째 컬럼
}

/**
 * 차량번호 값을 위치 기반으로 추출
 */
export function getCarNumberValue(record: CarRecord, columns: ColumnDef[]): string {
  const carCol = getCarNumberCol(columns);
  if (carCol && record[carCol.id] != null) return String(record[carCol.id]);
  return '';
}

/**
 * 차량번호 컬럼 ID를 위치 기반으로 반환
 */
export function getCarNumberColumnId(columns: ColumnDef[]): string | null {
  const carCol = getCarNumberCol(columns);
  return carCol ? carCol.id : null;
}

/**
 * 차량번호 문자열에서 끝에서 4자리 숫자를 추출
 * '24머 3734' → '3734'
 * '102다 3734' → '3734'
 */
export function extractLastFourDigits(carNum: string): string {
  if (!carNum) return '';
  const allDigits = carNum.replace(/[^0-9]/g, '');
  if (allDigits.length >= 4) {
    return allDigits.slice(-4);
  }
  return allDigits;
}
