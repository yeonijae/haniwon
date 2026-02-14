/**
 * 월간통계 페이지
 * StatisticsApp을 월간 모드로 렌더링 (embedded)
 */

import StatisticsApp from '../../statistics/StatisticsApp';

interface MonthlyStatsProps {
  selectedYear?: number;
  selectedMonth?: number;
}

export default function MonthlyStats({ selectedYear, selectedMonth }: MonthlyStatsProps) {
  return <StatisticsApp defaultPeriod="monthly" embedded controlledYear={selectedYear} controlledMonth={selectedMonth} />;
}
