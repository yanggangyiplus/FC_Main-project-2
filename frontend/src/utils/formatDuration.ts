/**
 * duration(분)을 읽기 쉬운 형식으로 변환
 * 예: 50분, 1시간, 2시간 30분, 2일 3시간, 4일 2시간 20분
 */
export function formatDuration(minutes: number): string {
  if (minutes < 0) {
    return '0분';
  }
  
  if (minutes === 0) {
    return '0분';
  }
  
  const days = Math.floor(minutes / (24 * 60));
  const remainingAfterDays = minutes % (24 * 60);
  const hours = Math.floor(remainingAfterDays / 60);
  const mins = remainingAfterDays % 60;
  
  const parts: string[] = [];
  
  if (days > 0) {
    parts.push(`${days}일`);
  }
  
  if (hours > 0) {
    parts.push(`${hours}시간`);
  }
  
  if (mins > 0 || parts.length === 0) {
    parts.push(`${mins}분`);
  }
  
  return parts.join(' ');
}

