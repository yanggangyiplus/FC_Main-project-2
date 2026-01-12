"""
이메일 발송 서비스
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime
import os

logger = logging.getLogger(__name__)


class EmailService:
    """이메일 발송 서비스"""
    
    @staticmethod
    def send_email(
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        이메일 발송
        
        Args:
            to_email: 수신자 이메일
            subject: 제목
            html_content: HTML 본문
            text_content: 텍스트 본문 (선택사항)
        
        Returns:
            발송 성공 여부
        """
        try:
            # SMTP 설정 (환경 변수에서 가져오기)
            smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USER", "")
            smtp_password = os.getenv("SMTP_PASSWORD", "")
            smtp_from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user)
            
            # SMTP 설정이 없으면 발송하지 않음
            if not smtp_user or not smtp_password:
                logger.warning("[EMAIL] SMTP 설정이 없어 이메일을 발송할 수 없습니다.")
                return False
            
            # 이메일 메시지 생성
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = smtp_from_email
            msg['To'] = to_email
            
            # 텍스트 본문 추가
            if text_content:
                text_part = MIMEText(text_content, 'plain', 'utf-8')
                msg.attach(text_part)
            
            # HTML 본문 추가
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # SMTP 서버 연결 및 발송
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()  # TLS 암호화
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
            
            logger.info(f"[EMAIL] 이메일 발송 성공: {to_email}, 제목: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"[EMAIL] 이메일 발송 실패: {to_email}, 오류: {e}", exc_info=True)
            return False
    
    @staticmethod
    def send_notification_email(
        to_email: str,
        todo_title: str,
        todo_date: str,
        todo_time: Optional[str] = None,
        reminder_time: Optional[str] = None,
        todo_location: Optional[str] = None,
        todo_category: Optional[str] = None,
        todo_checklist: Optional[list] = None,
        todo_memo: Optional[str] = None
    ) -> bool:
        """
        일정 알림 이메일 발송
        
        Args:
            to_email: 수신자 이메일
            todo_title: 일정 제목
            todo_date: 일정 날짜
            todo_time: 일정 시간 (선택사항)
            reminder_time: 알림 시간 (예: "30분 전")
            todo_location: 장소 (선택사항)
            todo_category: 카테고리 (선택사항)
            todo_checklist: 체크리스트 (선택사항)
            todo_memo: 메모 (선택사항)
        
        Returns:
            발송 성공 여부
        """
        # 이메일 제목
        if reminder_time:
            subject = f"일정 알림: {todo_title} ({reminder_time})"
        else:
            subject = f"일정 알림: {todo_title}"
        
        # 알림 시간 포맷팅
        reminder_info = f"{reminder_time}" if reminder_time else ""
        
        # 시간 정보 포맷팅
        time_info = ""
        if todo_time:
            time_info = f"<p><strong>시간:</strong> {todo_time}</p>"
        
        # 장소 정보
        location_info = ""
        if todo_location:
            location_info = f"<p><strong>장소:</strong> {todo_location}</p>"
        
        # 카테고리 정보
        category_info = ""
        if todo_category:
            category_info = f"<p><strong>카테고리:</strong> {todo_category}</p>"
        
        # 체크리스트 정보
        checklist_info = ""
        if todo_checklist and len(todo_checklist) > 0:
            checklist_items = "".join([f"<li>{item}</li>" for item in todo_checklist if item.strip()])
            if checklist_items:
                checklist_info = f"<p><strong>체크리스트:</strong></p><ul style='margin: 8px 0; padding-left: 20px;'>{checklist_items}</ul>"
        
        # 메모 정보
        memo_info = ""
        if todo_memo and todo_memo.strip():
            memo_info = f"<p><strong>메모:</strong> {todo_memo}</p>"
        
        # HTML 본문
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .container {{
                    background-color: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 24px;
                }}
                .header {{
                    background: linear-gradient(to right, #FF9B82, #FFB499);
                    color: white;
                    padding: 16px;
                    border-radius: 8px 8px 0 0;
                    margin: -24px -24px 24px -24px;
                }}
                .content {{
                    margin: 20px 0;
                }}
                .info-box {{
                    background-color: #f9fafb;
                    border-left: 4px solid #FF9B82;
                    padding: 12px 16px;
                    margin: 16px 0;
                    border-radius: 4px;
                }}
                .footer {{
                    margin-top: 24px;
                    padding-top: 16px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 12px;
                    color: #6b7280;
                    text-align: center;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 style="margin: 0; color: white;">일정 알림</h2>
                </div>
                <div class="content">
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">
                        Always Plan에서 일정을 알려드립니다.
                    </p>
                    <h3 style="color: #1f2937; margin-top: 0;">
                        <strong>{todo_title}</strong> 일정의 {reminder_info}입니다.
                    </h3>
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
                        일정을 확인해주세요.
                    </p>
                    <div class="info-box">
                        <p style="margin: 8px 0;"><strong>날짜:</strong> {todo_date}</p>
                        {time_info}
                        {location_info}
                        {category_info}
                        {checklist_info}
                        {memo_info}
                    </div>
                </div>
                <div class="footer">
                    <p>이 이메일은 Always Plan에서 자동으로 발송되었습니다.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # 텍스트 본문
        checklist_text = ""
        if todo_checklist and len(todo_checklist) > 0:
            checklist_items = [item for item in todo_checklist if item.strip()]
            if checklist_items:
                checklist_text = "\n체크리스트:\n" + "\n".join([f"- {item}" for item in checklist_items])
        
        location_text = f"장소: {todo_location}\n" if todo_location else ""
        category_text = f"카테고리: {todo_category}\n" if todo_category else ""
        memo_text = f"메모: {todo_memo}\n" if todo_memo and todo_memo.strip() else ""
        time_text = f"시간: {todo_time}\n" if todo_time else ""
        
        text_content = f"""Always Plan에서 일정을 알려드립니다.

{todo_title} 일정의 {reminder_info}입니다.
일정을 확인해주세요.

일정 상세 정보:
날짜: {todo_date}
{time_text}{location_text}{category_text}{checklist_text}{memo_text}
---
이 이메일은 Always Plan에서 자동으로 발송되었습니다.
        """
        
        return EmailService.send_email(to_email, subject, html_content, text_content)

