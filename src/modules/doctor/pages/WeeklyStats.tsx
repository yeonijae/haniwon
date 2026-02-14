/**
 * 주간통계 페이지
 * StatisticsApp을 주간 모드로 렌더링 (embedded)
 */

import StatisticsApp from '../../statistics/StatisticsApp';

interface WeeklyStatsProps {
  selectedDate?: string;
}

export default function WeeklyStats({ selectedDate }: WeeklyStatsProps) {
  return <StatisticsApp defaultPeriod="weekly" embedded controlledDate={selectedDate} />;
}
