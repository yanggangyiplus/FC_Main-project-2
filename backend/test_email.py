"""
이메일 발송 테스트 스크립트

사용법:
    python test_email.py <수신자_이메일> [SMTP_USER] [SMTP_PASSWORD] [SMTP_HOST] [SMTP_PORT]

예시:
    python test_email.py test@example.com
    python test_email.py test@example.com your-email@gmail.com your-password
    python test_email.py test@example.com your-email@gmail.com your-password smtp.gmail.com 587
"""
import os
import sys

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.email_service import EmailService

def test_email(to_email: str = None, smtp_user: str = None, smtp_password: str = None, 
               smtp_host: str = None, smtp_port: int = None):
    """테스트 이메일 발송"""
    
    # 명령줄 인자 또는 환경 변수에서 설정 가져오기
    smtp_user = smtp_user or os.getenv("SMTP_USER", "")
    smtp_password = smtp_password or os.getenv("SMTP_PASSWORD", "")
    smtp_host = smtp_host or os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = smtp_port or int(os.getenv("SMTP_PORT", "587"))
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)
    
    print("=" * 50)
    print("이메일 발송 테스트")
    print("=" * 50)
    print(f"SMTP Host: {smtp_host}")
    print(f"SMTP Port: {smtp_port}")
    print(f"SMTP User: {smtp_user}")
    print(f"SMTP Password: {'*' * len(smtp_password) if smtp_password else '(설정되지 않음)'}")
    print(f"수신자: {to_email or '(입력 필요)'}")
    print("=" * 50)
    
    if not smtp_user or not smtp_password:
        print("\n❌ 오류: SMTP 설정이 없습니다.")
        print("\n사용법:")
        print("  python test_email.py <수신자_이메일> [SMTP_USER] [SMTP_PASSWORD] [SMTP_HOST] [SMTP_PORT]")
        print("\n또는 환경 변수 설정:")
        print("  export SMTP_USER=your-email@gmail.com")
        print("  export SMTP_PASSWORD=your-password")
        print("  export SMTP_HOST=smtp.gmail.com")
        print("  export SMTP_PORT=587")
        print("  python test_email.py <수신자_이메일>")
        return False
    
    if not to_email:
        print("\n❌ 오류: 수신자 이메일 주소가 필요합니다.")
        print("\n사용법:")
        print("  python test_email.py <수신자_이메일>")
        return False
    
    # 환경 변수 설정
    os.environ["SMTP_HOST"] = smtp_host
    os.environ["SMTP_PORT"] = str(smtp_port)
    os.environ["SMTP_USER"] = smtp_user
    os.environ["SMTP_PASSWORD"] = smtp_password
    os.environ["SMTP_FROM_EMAIL"] = smtp_from_email
    
    print(f"\n📧 {to_email}로 테스트 이메일을 발송합니다...")
    
    # 테스트 이메일 발송
    success = EmailService.send_notification_email(
        to_email=to_email,
        todo_title="테스트 일정",
        todo_date="2024년 1월 15일",
        todo_time="14:00",
        reminder_time="30분 전"
    )
    
    if success:
        print("\n✅ 이메일 발송 성공!")
        print(f"   수신자: {to_email}")
        return True
    else:
        print("\n❌ 이메일 발송 실패")
        print("   로그를 확인하세요.")
        return False

if __name__ == "__main__":
    try:
        # 명령줄 인자 파싱
        if len(sys.argv) < 2:
            print(__doc__)
            sys.exit(1)
        
        to_email = sys.argv[1]
        smtp_user = sys.argv[2] if len(sys.argv) > 2 else None
        smtp_password = sys.argv[3] if len(sys.argv) > 3 else None
        smtp_host = sys.argv[4] if len(sys.argv) > 4 else None
        smtp_port = int(sys.argv[5]) if len(sys.argv) > 5 else None
        
        test_email(to_email, smtp_user, smtp_password, smtp_host, smtp_port)
    except KeyboardInterrupt:
        print("\n\n테스트가 취소되었습니다.")
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        test_email()
    except KeyboardInterrupt:
        print("\n\n테스트가 취소되었습니다.")
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

